#!/usr/bin/env python3
"""
Pulsar Admin Command Center — HTTP acceptance battery (Phoenix line).

Covers the deltas built on top of the Phases 1–3 platform:
  - PUT /api/admin/users/:uid/access : per-user feature overrides —
    grant unlocks exactly one extra area for a Trial user, revoke blocks
    a plan feature, clearing an override restores the plan default, and
    /api/me/access reflects the effective features + raw overrides
  - GET /api/admin/overview          : counts by status/plan, pending
    count, master-admin count, recent audit entries
  - POST /api/admin/users/:uid/password-reset : honest mail state
    (not_configured without RESEND_API_KEY) + audit entry
  - DELETE /api/admin/users/:uid     : record gone, the deleted identity
    is rejected (403 ACCOUNT_NOT_ACTIVE) on its next feature call,
    audit entry carries the target email
  - guardrails                       : self-delete 409, self-disable 409,
    demoting a master_admin record 409, removing yourself as the last
    stored master admin 409
  - audit log                        : create / access_update (grant,
    revoke, clear) / password_reset / delete / update entries present

Run from the project root:  python3 tests-admin-command-center.py
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
PORT = 3251

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


def audit_entries(token):
    s, b = req("GET", "/api/admin/audit?limit=200", token=token)
    assert s == 200, f"audit fetch failed: {s}"
    return b.get("entries", [])


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
    log = open("/tmp/pulsar-admincc.log", "w")
    proc = subprocess.Popen(["npx", "tsx", "tests/test-server.ts"], cwd=ROOT, env=env,
                            stdout=log, stderr=subprocess.STDOUT)
    try:
        if not wait_health():
            raise RuntimeError("instance failed to boot; see /tmp/pulsar-admincc.log")
        print(f"instance up on :{PORT} (pid {proc.pid})")

        owner = mint()  # owner-test@example.com / user-123
        outsider = mint({"email": "outsider@example.com", "sub": "outsider-1"})

        # Owner record exists (uid user-123) for the guardrail checks.
        s, _ = req("GET", "/api/me/access", token=owner)
        check("owner /api/me/access -> 200 (record ensured)", s == 200, f"got {s}")

        # --- overview gates -------------------------------------------------
        s, _ = req("GET", "/api/admin/overview")
        check("GET /api/admin/overview signed out -> 401", s == 401, f"got {s}")
        s, _ = req("GET", "/api/admin/overview", token=outsider)
        check("GET /api/admin/overview non-admin -> 403", s == 403, f"got {s}")

        # --- seed users: Trial + Starter via admin create --------------------
        s, b = req("POST", "/api/admin/users",
                   {"email": "trial@example.com", "displayName": "Trial User", "planId": "trial"},
                   token=owner)
        check("admin create Trial user -> 201", s == 201 and b.get("user", {}).get("planId") == "trial",
              f"got {s} {b}")
        s, b = req("POST", "/api/admin/users",
                   {"email": "starter@example.com", "displayName": "Starter User", "planId": "starter"},
                   token=owner)
        check("admin create Starter user -> 201", s == 201 and b.get("user", {}).get("planId") == "starter",
              f"got {s} {b}")

        trial = mint({"email": "trial@example.com", "sub": "trial-1"})
        starter = mint({"email": "starter@example.com", "sub": "starter-1"})
        s, _ = req("GET", "/api/me/access", token=trial)    # adopts record as trial-1
        check("trial user sign-in adopts record", s == 200, f"got {s}")
        s, _ = req("GET", "/api/me/access", token=starter)  # adopts record as starter-1
        check("starter user sign-in adopts record", s == 200, f"got {s}")

        # A pending signup for the overview counts.
        pending = mint({"email": "pending@example.com", "sub": "pending-1"})
        s, b = req("GET", "/api/me/access", token=pending)
        check("fresh signup lands pending_approval",
              s == 200 and b.get("access", {}).get("status") == "pending_approval", f"got {s} {b}")

        # --- override gates ---------------------------------------------------
        s, _ = req("PUT", "/api/admin/users/trial-1/access", {"call_studio": True}, token=outsider)
        check("PUT access as non-admin -> 403", s == 403, f"got {s}")
        s, _ = req("PUT", "/api/admin/users/trial-1/access", {"bogus_feature": True}, token=owner)
        check("PUT access with unknown feature key -> 400", s == 400, f"got {s}")
        s, _ = req("PUT", "/api/admin/users/trial-1/access", {"call_studio": "yes"}, token=owner)
        check("PUT access with non-boolean value -> 400", s == 400, f"got {s}")
        s, _ = req("PUT", "/api/admin/users/nope-404/access", {"call_studio": True}, token=owner)
        check("PUT access for unknown user -> 404", s == 404, f"got {s}")

        # Baseline: Trial has no call_studio.
        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hello"}, token=trial)
        check("baseline: Trial POST /api/call/ai-turn -> 403 PLAN_FEATURE_NOT_INCLUDED",
              s == 403 and b.get("error") == "PLAN_FEATURE_NOT_INCLUDED", f"got {s} {b}")

        # GRANT call_studio -> exactly that area unlocks.
        s, b = req("PUT", "/api/admin/users/trial-1/access", {"call_studio": True}, token=owner)
        check("grant call_studio -> 200 + override stored",
              s == 200 and b.get("user", {}).get("featureOverrides", {}).get("call_studio") is True,
              f"got {s} {b}")
        s, b = req("GET", "/api/me/access", token=trial)
        acc = b.get("access", {})
        check("/api/me/access reflects grant (call_studio on, briefing off, overrides echoed)",
              acc.get("features", {}).get("call_studio") is True
              and acc.get("features", {}).get("daily_briefing") is False
              and acc.get("featureOverrides", {}).get("call_studio") is True,
              f"got {acc}")
        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hello"}, token=trial)
        check("grant lifts the feature gate but NOT plan limits (Trial callsPerMonth=0 -> PLAN_LIMIT_REACHED)",
              s == 403 and b.get("error") == "PLAN_LIMIT_REACHED" and b.get("limitKind") == "calls",
              f"got {s} {b}")
        s, b = req("PUT", "/api/admin/plans/trial", {"limits": {"callsPerMonth": 5}}, token=owner)
        check("raise Trial call limit -> 200", s == 200 and b.get("plan", {}).get("limits", {}).get("callsPerMonth") == 5,
              f"got {s} {b}")
        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hello"}, token=trial)
        check("granted Trial user POST /api/call/ai-turn -> 200", s == 200 and b.get("success") is True,
              f"got {s} {b}")
        s, _ = req("PUT", "/api/admin/plans/trial", {"limits": {"callsPerMonth": 0}}, token=owner)
        check("restore Trial call limit", s == 200, f"got {s}")
        s, b = req("POST", "/api/briefing/generate", {}, token=trial)
        check("grant unlocks exactly one area: daily_briefing still 403",
              s == 403 and b.get("error") == "PLAN_FEATURE_NOT_INCLUDED", f"got {s} {b}")

        # REVOKE a Starter plan feature (npi_search) -> that endpoint blocks.
        s, b = req("PUT", "/api/admin/users/starter-1/access", {"npi_search": False}, token=owner)
        check("revoke npi_search -> 200 + override stored",
              s == 200 and b.get("user", {}).get("featureOverrides", {}).get("npi_search") is False,
              f"got {s} {b}")
        s, b = req("GET", "/api/me/access", token=starter)
        check("/api/me/access reflects revoke (npi_search off, campaigns still on)",
              b.get("access", {}).get("features", {}).get("npi_search") is False
              and b.get("access", {}).get("features", {}).get("campaigns") is True,
              f"got {b.get('access')}")
        s, b = req("POST", "/api/leads/npi-search", {"city": "Austin"}, token=starter)
        check("revoked Starter POST /api/leads/npi-search -> 403 PLAN_FEATURE_NOT_INCLUDED",
              s == 403 and b.get("error") == "PLAN_FEATURE_NOT_INCLUDED" and b.get("feature") == "npi_search",
              f"got {s} {b}")

        # CLEAR the override -> plan default (on) restored.
        s, b = req("PUT", "/api/admin/users/starter-1/access", {"npi_search": None}, token=owner)
        check("clear override -> 200 + override removed",
              s == 200 and "npi_search" not in (b.get("user", {}).get("featureOverrides") or {}),
              f"got {s} {b}")
        s, b = req("GET", "/api/me/access", token=starter)
        check("after clear, /api/me/access shows plan default (npi_search on)",
              b.get("access", {}).get("features", {}).get("npi_search") is True,
              f"got {b.get('access')}")

        # --- overview counts ---------------------------------------------------
        s, b = req("GET", "/api/admin/users", token=owner)
        users = b.get("users", [])
        s2, b2 = req("GET", "/api/admin/overview", token=owner)
        ov = b2.get("overview", {})
        by_status = ov.get("byStatus", {})
        by_plan = ov.get("byPlan", {})
        check("overview: totalUsers matches the users list",
              s2 == 200 and ov.get("totalUsers") == len(users) == 4,
              f"got total={ov.get('totalUsers')} users={len(users)}")
        check("overview: byStatus sums to total with 3 active + 1 pending",
              by_status.get("active") == 3 and by_status.get("pending_approval") == 1
              and by_status.get("disabled") == 0
              and sum(by_status.values()) == ov.get("totalUsers"),
              f"got {by_status}")
        check("overview: pendingApprovals matches byStatus",
              ov.get("pendingApprovals") == by_status.get("pending_approval") == 1, f"got {ov}")
        check("overview: byPlan counts trial/starter/none",
              by_plan.get("trial") == 1 and by_plan.get("starter") == 1 and by_plan.get("none") == 2
              and sum(by_plan.values()) == ov.get("totalUsers"), f"got {by_plan}")
        check("overview: masterAdminCount = 1 (env owner), env fallback active",
              ov.get("masterAdminCount") == 1 and ov.get("envFallbackActive") is True, f"got {ov}")
        check("overview: recentAudit present (<=10, newest first)",
              isinstance(ov.get("recentAudit"), list) and 0 < len(ov.get("recentAudit", [])) <= 10
              and ov["recentAudit"][0].get("action") is not None, f"got {ov.get('recentAudit')}")

        # --- password reset ------------------------------------------------------
        s, _ = req("POST", "/api/admin/users/trial-1/password-reset", {}, token=outsider)
        check("password-reset as non-admin -> 403", s == 403, f"got {s}")
        s, _ = req("POST", "/api/admin/users/nope-404/password-reset", {}, token=owner)
        check("password-reset for unknown user -> 404", s == 404, f"got {s}")
        s, b = req("POST", "/api/admin/users/trial-1/password-reset", {}, token=owner)
        check("password-reset -> 200 with honest not_configured mail state",
              s == 200 and b.get("reset", {}).get("status") == "not_configured", f"got {s} {b}")

        # --- delete semantics ------------------------------------------------------
        s, b = req("POST", "/api/admin/users",
                   {"email": "temp@example.com", "displayName": "Temp User", "planId": "starter"},
                   token=owner)
        check("admin create temp user -> 201", s == 201, f"got {s} {b}")
        temp = mint({"email": "temp@example.com", "sub": "temp-1"})
        s, b = req("GET", "/api/me/access", token=temp)
        check("temp user active on Starter before delete",
              s == 200 and b.get("access", {}).get("status") == "active"
              and b.get("access", {}).get("features", {}).get("npi_search") is True, f"got {s} {b}")

        s, b = req("DELETE", "/api/admin/users/temp-1", token=owner)
        check("DELETE temp user -> 200 platformRecordDeleted",
              s == 200 and b.get("platformRecordDeleted") is True, f"got {s} {b}")
        s, b = req("GET", "/api/admin/users", token=owner)
        check("deleted user absent from users list",
              s == 200 and not any(u.get("email") == "temp@example.com" for u in b.get("users", [])),
              f"got {s}")
        # The deleted identity presents its (still valid) token directly to a
        # gated endpoint — no /api/me/access first — and must be rejected.
        s, b = req("POST", "/api/leads/npi-search", {"city": "Austin"}, token=temp)
        check("deleted user next feature call -> 403 ACCOUNT_NOT_ACTIVE (deleted)",
              s == 403 and b.get("error") == "ACCOUNT_NOT_ACTIVE" and b.get("status") == "deleted",
              f"got {s} {b}")

        # --- guardrails --------------------------------------------------------------
        s, _ = req("DELETE", "/api/admin/users/user-123", token=owner)
        check("admin cannot delete themselves -> 409", s == 409, f"got {s}")
        s, _ = req("PATCH", "/api/admin/users/user-123", {"status": "disabled"}, token=owner)
        check("admin cannot disable themselves -> 409", s == 409, f"got {s}")
        s, b = req("PATCH", "/api/admin/users/user-123", {"role": "user"}, token=owner)
        check("demoting a master_admin record via PATCH -> 409", s == 409, f"got {s} {b}")

        s, b = req("PUT", "/api/admin/config/master-admins", {"emails": ["second@example.com"]}, token=owner)
        check("owner adds stored master admin -> 200",
              s == 200 and "second@example.com" in b.get("stored", []), f"got {s} {b}")
        second = mint({"email": "second@example.com", "sub": "second-1"})
        s, b = req("PUT", "/api/admin/config/master-admins", {"emails": []}, token=second)
        check("stored admin removing themselves (last stored) -> 409", s == 409, f"got {s} {b}")
        s, _ = req("PUT", "/api/admin/config/master-admins", {"emails": []}, token=owner)
        check("cleanup: owner clears stored list -> 200", s == 200, f"got {s}")

        # --- title: preexisting pick + custom + clear --------------------------
        s, b = req("PATCH", "/api/admin/users/trial-1", {"title": "Owner - Master Admin"}, token=owner)
        check("PATCH title (preexisting pick) -> 200 + stored",
              s == 200 and b.get("user", {}).get("title") == "Owner - Master Admin", f"got {s} {b}")
        s, b = req("PATCH", "/api/admin/users/trial-1", {"title": "Head of Growth"}, token=owner)
        check("PATCH title (custom) -> 200 + stored",
              s == 200 and b.get("user", {}).get("title") == "Head of Growth", f"got {s} {b}")
        s, b = req("GET", "/api/me/access", token=trial)
        check("/api/me/access carries displayName + title for the header",
              s == 200 and b.get("access", {}).get("title") == "Head of Growth"
              and b.get("access", {}).get("displayName") == "Trial User", f"got {s} {b}")
        s, _ = req("PATCH", "/api/admin/users/trial-1", {"title": "x" * 81}, token=owner)
        check("PATCH title over 80 chars -> 400", s == 400, f"got {s}")
        s, _ = req("PATCH", "/api/admin/users/trial-1", {"title": "Owner - Master Admin"}, token=outsider)
        check("PATCH title as non-admin -> 403", s == 403, f"got {s}")
        s, _ = req("PATCH", "/api/admin/users/nope-404", {"title": "Manager"}, token=owner)
        check("PATCH title for unknown user -> 404", s == 404, f"got {s}")
        s, b = req("PATCH", "/api/admin/users/trial-1", {"title": ""}, token=owner)
        check("PATCH title empty clears -> 200 + title absent",
              s == 200 and "title" not in b.get("user", {}), f"got {s} {b}")

        # --- audit completeness -------------------------------------------------------
        entries = audit_entries(owner)
        actions = [e.get("action") for e in entries]

        def has(action, target=None, detail_parts=()):
            for e in entries:
                if e.get("action") != action:
                    continue
                if target is not None and e.get("target") != target:
                    continue
                if all(p in (e.get("details") or "") for p in detail_parts):
                    return True
            return False

        check("audit: user.create entries present", has("user.create", "trial@example.com"), f"got {actions}")
        check("audit: grant entry (user.access_update, call_studio + granted)",
              has("user.access_update", "trial@example.com", ("call_studio", "granted")), f"got {entries}")
        check("audit: revoke entry (user.access_update, npi_search + revoked)",
              has("user.access_update", "starter@example.com", ("npi_search", "revoked")), f"got {entries}")
        check("audit: clear entry (user.access_update, npi_search + cleared)",
              has("user.access_update", "starter@example.com", ("npi_search", "cleared")), f"got {entries}")
        check("audit: password_reset entry for trial user",
              has("user.password_reset", "trial@example.com"), f"got {actions}")
        check("audit: delete entry carries target email",
              has("user.delete", "temp@example.com"), f"got {actions}")
        check("audit: master_admins.update entries present",
              has("master_admins.update"), f"got {actions}")
        check("audit: user.update entry carries title",
              has("user.update", "trial@example.com", ("title=",)), f"got {actions}")

    finally:
        kill_port(PORT)
        proc.wait(timeout=10)

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n==== Admin Command Center battery: {len(RESULTS) - len(failed)} passed, {len(failed)} failed ====")
    if failed:
        print("FAILED:", *failed, sep="\n  ")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
