#!/usr/bin/env python3
"""
Pulsar Phases 1–3 — HTTP acceptance battery (Phoenix line).

Covers the companion prompt's Part 3 acceptance checks plus the Part 2
stats endpoint shape:
  - /api/admin/* : 401 signed out, 403 non-owner, 200 owner
  - signup flow   : fresh user lands pending_approval -> 403 ACCOUNT_NOT_ACTIVE
                    on a feature endpoint -> approve with Trial -> active
  - plan gates    : Trial user -> 403 PLAN_FEATURE_NOT_INCLUDED on /api/call/*
                    Growth user passes; plan limit -> 403 PLAN_LIMIT_REACHED
  - master admins : stored list grants access; remove-self -> 409
  - audit log     : admin actions appear
  - dashboard     : snapshot sync -> stats shape for 7d/30d/90d, invalid range
                    -> 400, workspace isolation, honest zero state

Run from the project root:  python3 tests-phase1-3.py
Exits non-zero if any hard check fails.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 3221

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail and not cond else ""))


def req(method, path, body=None, token=None, timeout=20):
    url = f"http://127.0.0.1:{PORT}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", "replace")
            try:
                return resp.status, json.loads(text)
            except Exception:
                return resp.status, {"_raw": text}
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(text)
        except Exception:
            return e.code, {"_raw": text}


def mint(overrides=None):
    out = subprocess.run(
        ["node", "tests/mint-token.mjs", json.dumps(overrides or {})],
        cwd=ROOT, capture_output=True, text=True, timeout=30,
    )
    assert out.returncode == 0, f"mint failed: {out.stderr}"
    return out.stdout.strip()


def wait_health(timeout=90):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            status, _ = req("GET", "/api/health", timeout=3)
            if status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def kill_port(port):
    subprocess.run(["fuser", "-k", f"{port}/tcp"], capture_output=True)
    time.sleep(1)


def main():
    subprocess.run(["node", "tests/gen-test-keys.mjs"], cwd=ROOT, check=True,
                   capture_output=True, text=True)
    # clean slate (platform state lives in the same persisted store)
    subprocess.run(["rm", "-rf", os.path.join(ROOT, "server-data")])

    env = {k: v for k, v in os.environ.items()
           if k not in ("GEMINI_API_KEY", "RESEND_API_KEY", "TEST_AUTH_SECRET",
                        "NODE_ENV", "BRIEFING_RECIPIENT_EMAIL",
                        "DEMO_MODE", "AI_DAILY_QUOTA_PER_USER")}
    env["OWNER_EMAILS"] = "owner-test@example.com"
    env["PORT"] = str(PORT)
    log = open("/tmp/pulsar-phase13.log", "w")
    proc = subprocess.Popen(["npx", "tsx", "tests/test-server.ts"], cwd=ROOT, env=env,
                            stdout=log, stderr=subprocess.STDOUT)
    try:
        if not wait_health():
            raise RuntimeError("instance failed to boot; see /tmp/pulsar-phase13.log")
        print(f"instance up on :{PORT} (pid {proc.pid})")

        owner = mint()  # owner-test@example.com / user-123
        nonowner = mint({"email": "outsider@example.com", "sub": "outsider-1"})
        fresh = mint({"email": "fresh@example.com", "sub": "fresh-1"})

        # --- auth gates on the new surface ---------------------------------
        s, _ = req("GET", "/api/admin/users")
        check("GET /api/admin/users signed out -> 401", s == 401, f"got {s}")
        s, _ = req("GET", "/api/admin/users", token=nonowner)
        check("GET /api/admin/users non-owner -> 403", s == 403, f"got {s}")
        s, _ = req("GET", "/api/dashboard/stats?range=7d")
        check("GET /api/dashboard/stats signed out -> 401", s == 401, f"got {s}")
        s, _ = req("GET", "/api/me/access")
        check("GET /api/me/access signed out -> 401", s == 401, f"got {s}")

        # --- /api/me/access shapes ------------------------------------------
        s, b = req("GET", "/api/me/access", token=owner)
        acc = b.get("access", {})
        check("owner /api/me/access -> master_admin + active + all features",
              s == 200 and acc.get("role") == "master_admin" and acc.get("status") == "active"
              and acc.get("isMasterAdmin") is True and acc.get("features", {}).get("call_studio") is True,
              f"got {s} {acc}")

        s, b = req("GET", "/api/me/access", token=fresh)
        acc = b.get("access", {})
        check("fresh signup /api/me/access -> pending_approval, no features",
              s == 200 and acc.get("status") == "pending_approval" and acc.get("planId") is None
              and all(v is False for v in acc.get("features", {}).values()),
              f"got {s} {acc}")

        # --- pending user is blocked from feature endpoints -----------------
        s, b = req("POST", "/api/leads/npi-search", {"city": "Austin"}, token=fresh)
        check("pending user POST /api/leads/npi-search -> 403 ACCOUNT_NOT_ACTIVE",
              s == 403 and b.get("error") == "ACCOUNT_NOT_ACTIVE", f"got {s} {b}")

        # --- approval flow ----------------------------------------------------
        s, b = req("GET", "/api/admin/signup-requests", token=owner)
        reqs = b.get("requests", [])
        check("signup-requests lists the fresh user",
              s == 200 and any(r.get("uid") == "fresh-1" for r in reqs), f"got {s} {reqs}")

        s, b = req("POST", "/api/admin/signup-requests/fresh-1/approve", {"planId": "trial"}, token=owner)
        usr = b.get("user", {})
        check("approve fresh user with Trial -> active + plan trial",
              s == 200 and usr.get("status") == "active" and usr.get("planId") == "trial"
              and usr.get("approvedBy") == "owner-test@example.com", f"got {s} {b}")
        check("approval email honestly reports not_configured (no RESEND_API_KEY)",
              b.get("approvalEmail", {}).get("status") == "not_configured", f"got {b.get('approvalEmail')}")

        s, b = req("GET", "/api/me/access", token=fresh)
        acc = b.get("access", {})
        check("approved user access: Trial features on, call_studio off",
              acc.get("status") == "active" and acc.get("features", {}).get("lead_discovery") is True
              and acc.get("features", {}).get("call_studio") is False
              and acc.get("limits", {}).get("leadsPerMonth") == 100, f"got {acc}")

        # --- plan feature gate --------------------------------------------------
        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hello"}, token=fresh)
        check("Trial user POST /api/call/ai-turn -> 403 PLAN_FEATURE_NOT_INCLUDED",
              s == 403 and b.get("error") == "PLAN_FEATURE_NOT_INCLUDED" and b.get("feature") == "call_studio",
              f"got {s} {b}")

        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hello"}, token=owner)
        check("owner POST /api/call/ai-turn -> 200 (master-admin bypass)",
              s == 200 and b.get("success") is True, f"got {s} {b}")

        # --- admin-created user adopts plan on first sign-in --------------------
        s, b = req("POST", "/api/admin/users",
                   {"email": "growth@example.com", "displayName": "Growth User", "planId": "growth", "role": "user"},
                   token=owner)
        check("admin create user -> 201 active growth, invite honestly not_configured",
              s == 201 and b.get("user", {}).get("status") == "active"
              and b.get("user", {}).get("planId") == "growth"
              and b.get("invite", {}).get("status") == "not_configured", f"got {s} {b}")

        growth = mint({"email": "growth@example.com", "sub": "growth-1"})
        s, b = req("GET", "/api/me/access", token=growth)
        acc = b.get("access", {})
        check("invited user first sign-in adopts record: active + Growth + call_studio",
              s == 200 and acc.get("status") == "active" and acc.get("planId") == "growth"
              and acc.get("features", {}).get("call_studio") is True, f"got {s} {acc}")

        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "pricing please"}, token=growth)
        check("Growth user POST /api/call/ai-turn -> 200", s == 200 and b.get("success") is True, f"got {s} {b}")

        # --- duplicate create -> 409 ---------------------------------------------
        s, _ = req("POST", "/api/admin/users", {"email": "growth@example.com"}, token=owner)
        check("duplicate admin create -> 409", s == 409, f"got {s}")

        # --- plans ----------------------------------------------------------------
        s, b = req("GET", "/api/admin/plans", token=owner)
        plans = {p["id"]: p for p in b.get("plans", [])}
        check("GET /api/admin/plans seeds trial/starter/growth",
              s == 200 and set(plans) >= {"trial", "starter", "growth"}
              and plans["trial"]["limits"]["leadsPerMonth"] == 100
              and plans["growth"]["features"]["call_studio"] is True, f"got {s}")

        s, b = req("PUT", "/api/admin/plans/trial",
                   {"limits": {"leadsPerMonth": 0}}, token=owner)
        check("PUT plan trial leadsPerMonth=0 -> 200", s == 200 and b.get("plan", {}).get("limits", {}).get("leadsPerMonth") == 0,
              f"got {s} {b}")

        s, b = req("POST", "/api/leads/scrape", {}, token=fresh)
        check("Trial user at limit 0 -> 403 PLAN_LIMIT_REACHED",
              s == 403 and b.get("error") == "PLAN_LIMIT_REACHED" and b.get("limit") == 0,
              f"got {s} {b}")

        s, _ = req("PUT", "/api/admin/plans/trial",
                   {"limits": {"leadsPerMonth": 100}}, token=owner)
        check("plan limit restored", s == 200, f"got {s}")

        s, b = req("PUT", "/api/admin/plans/trial", {"features": {"bogus_feature": True}}, token=owner)
        check("PUT plan with unknown feature key -> 400", s == 400, f"got {s}")

        # --- master admin list ------------------------------------------------------
        s, b = req("GET", "/api/admin/config/master-admins", token=owner)
        check("master-admins: env owner is effective (break-glass)",
              s == 200 and "owner-test@example.com" in b.get("effective", [])
              and "owner-test@example.com" in b.get("env", []), f"got {s} {b}")

        s, b = req("PUT", "/api/admin/config/master-admins",
                   {"emails": ["second@example.com"]}, token=owner)
        check("owner adds stored master admin -> 200",
              s == 200 and "second@example.com" in b.get("stored", []), f"got {s} {b}")

        second = mint({"email": "second@example.com", "sub": "second-1"})
        s, _ = req("GET", "/api/admin/users", token=second)
        check("stored master admin can call /api/admin/*", s == 200, f"got {s}")

        s, b = req("PUT", "/api/admin/config/master-admins", {"emails": []}, token=second)
        check("stored admin removing themselves -> 409",
              s == 409, f"got {s} {b}")

        s, b = req("PUT", "/api/admin/config/master-admins", {"emails": []}, token=owner)
        check("env owner clears stored list (still effective via env) -> 200",
              s == 200 and b.get("stored") == [] and "owner-test@example.com" in b.get("effective", []),
              f"got {s} {b}")

        s, _ = req("GET", "/api/admin/users", token=second)
        check("removed stored admin loses /api/admin/* -> 403", s == 403, f"got {s}")

        # --- disable / re-enable ------------------------------------------------------
        s, b = req("GET", "/api/admin/users", token=owner)
        growth_rec = next((u for u in b.get("users", []) if u.get("email") == "growth@example.com"), {})
        growth_uid = growth_rec.get("uid")
        check("users list contains adopted growth user under real uid",
              growth_uid == "growth-1", f"got {growth_rec}")

        s, _ = req("PATCH", f"/api/admin/users/{growth_uid}", {"status": "disabled"}, token=owner)
        check("PATCH disable growth user -> 200", s == 200, f"got {s}")
        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hi"}, token=growth)
        check("disabled user next API call -> 403 ACCOUNT_NOT_ACTIVE",
              s == 403 and b.get("error") == "ACCOUNT_NOT_ACTIVE", f"got {s} {b}")
        s, _ = req("PATCH", f"/api/admin/users/{growth_uid}", {"status": "active"}, token=owner)
        check("PATCH re-enable growth user -> 200", s == 200, f"got {s}")
        s, _ = req("POST", "/api/call/ai-turn", {"userSpeech": "hi"}, token=growth)
        check("re-enabled user passes again", s == 200, f"got {s}")

        s, _ = req("PATCH", "/api/admin/users/user-123", {"status": "disabled"}, token=owner)
        check("admin cannot disable themselves -> 409", s == 409, f"got {s}")

        # --- audit log ------------------------------------------------------------------
        s, b = req("GET", "/api/admin/audit?limit=100", token=owner)
        actions = [e.get("action") for e in b.get("entries", [])]
        check("audit log records admin actions",
              s == 200 and "user.create" in actions and "signup.approve" in actions
              and "plan.update" in actions and "master_admins.update" in actions
              and "user.update" in actions, f"got {actions}")

        # --- dashboard stats --------------------------------------------------------------
        today = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        s, b = req("POST", "/api/dashboard/snapshot", {
            "leads": [
                {"id": "l1", "status": "Ready for Call", "createdAt": today},
                {"id": "l2", "status": "Audit Scheduled", "createdAt": today, "lastContacted": today},
                {"id": "l3", "status": "Voicemail"}
            ],
            "callSessions": [{"at": today, "outcome": "answered"}],
            "tasks": [{"id": "t1", "dueAt": today, "completed": False}]
        }, token=owner)
        check("owner snapshot sync -> counts",
              s == 200 and b.get("counts", {}).get("leads") == 3 and b.get("counts", {}).get("callSessions") == 1,
              f"got {s} {b}")

        for rng, days in (("7d", 7), ("30d", 30), ("90d", 90)):
            s, b = req("GET", f"/api/dashboard/stats?range={rng}", token=owner)
            st = b.get("stats", {})
            ok = (s == 200 and st.get("kpis", {}).get("totalLeads", {}).get("value") == 3
                  and st.get("kpis", {}).get("qualifiedLeads", {}).get("value") == 1
                  and len(st.get("leadsOverTime", [])) == days
                  and st.get("callActivity", {}).get("simulated") is True
                  and st.get("callActivity", {}).get("caption") == "Call Studio sessions"
                  and any(f.get("stage") == "Ready for Call" and f.get("count") == 1 for f in st.get("funnel", [])))
            check(f"stats shape + values for range {rng}", ok, f"got {s} {json.dumps(st)[:300]}")

        s, _ = req("GET", "/api/dashboard/stats?range=5d", token=owner)
        check("invalid range -> 400", s == 400, f"got {s}")

        s, b = req("GET", "/api/dashboard/stats?range=7d", token=growth)
        st = b.get("stats", {})
        check("workspace isolation: other user sees zeros, not owner's records",
              s == 200 and st.get("kpis", {}).get("totalLeads", {}).get("value") == 0
              and st.get("snapshotUpdatedAt") is None, f"got {s} {st.get('kpis')}")

        s, b = req("GET", "/api/dashboard/stats?range=7d&workspaceId=ws_pulsar_master", token=growth)
        check("non-admin cannot read another workspace's stats -> 403", s == 403, f"got {s}")

    finally:
        kill_port(PORT)
        proc.wait(timeout=10)

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n==== Phases 1-3 battery: {len(RESULTS) - len(failed)} passed, {len(failed)} failed ====")
    if failed:
        print("FAILED:", *failed, sep="\n  ")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
