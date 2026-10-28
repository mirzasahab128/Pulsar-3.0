#!/usr/bin/env python3
"""
Pulsar Access Gateway — HTTP acceptance battery (Phoenix line).

Covers the Request Access flow added to mirror the RCM Copilot gateway:
  - POST /api/me/access-request: 401 signed out
  - validation: empty org -> 400 ORGANIZATION_REQUIRED, unknown plan ->
    400 UNKNOWN_PLAN, missing terms acceptance -> 400
  - a pending user can submit details; they land on the platform record
    and appear in the admin Signup Approvals queue (org + requested plan)
  - submitting details grants nothing by itself: feature endpoints stay
    403 ACCOUNT_NOT_ACTIVE until an admin approves
  - approval with the requested plan activates the account on that plan
  - non-admins cannot read the approvals queue (403)

Run from the project root:  python3 tests-access-gateway.py
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
PORT = 3225

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
    subprocess.run(["rm", "-rf", os.path.join(ROOT, "server-data")])

    env = {k: v for k, v in os.environ.items()
           if k not in ("GEMINI_API_KEY", "RESEND_API_KEY", "TEST_AUTH_SECRET",
                        "NODE_ENV", "BRIEFING_RECIPIENT_EMAIL",
                        "DEMO_MODE", "AI_DAILY_QUOTA_PER_USER")}
    env["OWNER_EMAILS"] = "owner-test@example.com"
    env["PORT"] = str(PORT)
    log = open("/tmp/pulsar-access-gateway.log", "w")
    proc = subprocess.Popen(["npx", "tsx", "tests/test-server.ts"], cwd=ROOT, env=env,
                            stdout=log, stderr=subprocess.STDOUT)
    try:
        if not wait_health():
            raise RuntimeError("instance failed to boot; see /tmp/pulsar-access-gateway.log")
        print(f"instance up on :{PORT} (pid {proc.pid})")

        owner = mint()  # owner-test@example.com / user-123
        fresh = mint({"email": "fresh@example.com", "sub": "fresh-1"})
        terms = "2026-10-23T07:00:00.000Z"

        s, b = req("POST", "/api/me/access-request",
                   {"organization": "Org", "requestedPlanId": None, "termsAcceptedAt": terms})
        check("access-request signed out -> 401", s == 401, f"got {s}")

        s, b = req("GET", "/api/me/access", token=fresh)
        check("fresh signup lands pending_approval",
              s == 200 and b.get("access", {}).get("status") == "pending_approval", f"got {s} {b}")

        s, b = req("POST", "/api/me/access-request",
                   {"organization": "  ", "requestedPlanId": None, "termsAcceptedAt": terms}, token=fresh)
        check("empty organization -> 400 ORGANIZATION_REQUIRED",
              s == 400 and b.get("error") == "ORGANIZATION_REQUIRED", f"got {s} {b}")

        s, b = req("POST", "/api/me/access-request",
                   {"organization": "Org", "requestedPlanId": "platinum", "termsAcceptedAt": terms}, token=fresh)
        check("unknown plan -> 400 UNKNOWN_PLAN",
              s == 400 and b.get("error") == "UNKNOWN_PLAN", f"got {s} {b}")

        s, b = req("POST", "/api/me/access-request",
                   {"organization": "Org", "requestedPlanId": "growth", "termsAcceptedAt": ""}, token=fresh)
        check("missing terms acceptance -> 400 TERMS_ACCEPTANCE_REQUIRED",
              s == 400 and b.get("error") == "TERMS_ACCEPTANCE_REQUIRED", f"got {s} {b}")

        s, b = req("POST", "/api/me/access-request",
                   {"organization": "RevCycle Health System", "requestedPlanId": "growth",
                    "termsAcceptedAt": terms}, token=fresh)
        user = b.get("user", {})
        check("pending user can submit access-request -> 200",
              s == 200 and b.get("success") is True, f"got {s} {b}")
        check("record carries organization + accessRequest",
              user.get("organization") == "RevCycle Health System"
              and user.get("accessRequest", {}).get("requestedPlanId") == "growth"
              and user.get("accessRequest", {}).get("termsAcceptedAt") == terms,
              f"user={user}")
        check("submission alone grants nothing (still pending)",
              user.get("status") == "pending_approval" and user.get("planId") is None, f"user={user}")

        s, b = req("POST", "/api/call/ai-turn", {"userSpeech": "hello"}, token=fresh)
        check("pending user still gated on feature endpoint -> 403 ACCOUNT_NOT_ACTIVE",
              s == 403 and b.get("error") == "ACCOUNT_NOT_ACTIVE", f"got {s} {b}")

        s, b = req("GET", "/api/admin/signup-requests", token=fresh)
        check("non-admin cannot read approvals queue -> 403", s == 403, f"got {s}")

        s, b = req("GET", "/api/admin/signup-requests", token=owner)
        reqs = b.get("requests", [])
        mine = [r for r in reqs if r.get("email") == "fresh@example.com"]
        check("approvals queue shows org + requested plan",
              s == 200 and len(mine) == 1
              and mine[0].get("accessRequest", {}).get("organization") == "RevCycle Health System"
              and mine[0].get("accessRequest", {}).get("requestedPlanId") == "growth",
              f"got {s} {reqs}")

        s, b = req("POST", "/api/admin/signup-requests/fresh-1/approve", {"planId": "growth"}, token=owner)
        check("approve with the requested plan -> 200",
              s == 200 and b.get("user", {}).get("status") == "active"
              and b.get("user", {}).get("planId") == "growth", f"got {s} {b}")

        s, b = req("GET", "/api/me/access", token=fresh)
        check("approved user access is active on Growth",
              s == 200 and b.get("access", {}).get("status") == "active"
              and b.get("access", {}).get("planId") == "growth", f"got {s} {b}")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        kill_port(PORT)

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    if failed:
        print("FAILED:", *failed, sep="\n  ")
        sys.exit(1)


if __name__ == "__main__":
    main()
