#!/usr/bin/env python3
"""
Pulsar Phase 0 — HTTP acceptance battery (Phoenix line).

Mirrors the audit's failing checks against the fixed build:
  A: main instance (test-server with stubbed cert source, real verification)
  B: NODE_ENV=test instance (C3 bypass must be gone)
  C: low AI-quota instance (M7)
Plus scheduler persistence across a restart (C8) and an SSRF listener probe.

Run from the project root:  python3 tests-phase0.py
Exits non-zero if any hard check fails. Environment-limited checks are
reported as SKIP (never silently passed).
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_A, PORT_B, PORT_C = 3211, 3212, 3213
LISTENER_PORT = 8899

RESULTS = []
LISTENER_HITS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail and not cond else ""))


def skip(name, why):
    RESULTS.append((name, None, why))
    print(f"[SKIP] {name} — {why}")


def req(method, port, path, body=None, token=None, headers=None, raw=None, timeout=20):
    url = f"http://127.0.0.1:{port}{path}"
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
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


def wait_health(port, timeout=90):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            status, _ = req("GET", port, "/api/health", timeout=3)
            if status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def boot(name, port, extra_env, script):
    env = {k: v for k, v in os.environ.items()
           if k not in ("GEMINI_API_KEY", "RESEND_API_KEY", "TEST_AUTH_SECRET",
                        "NODE_ENV", "OWNER_EMAILS", "BRIEFING_RECIPIENT_EMAIL",
                        "DEMO_MODE", "AI_DAILY_QUOTA_PER_USER")}
    env.update(extra_env)
    env["PORT"] = str(port)
    log = open(f"/tmp/pulsar-phase0-{name}.log", "w")
    proc = subprocess.Popen(
        ["npx", "tsx", script], cwd=ROOT, env=env,
        stdout=log, stderr=subprocess.STDOUT,
    )
    if not wait_health(port):
        raise RuntimeError(f"instance {name} failed to boot; see /tmp/pulsar-phase0-{name}.log")
    print(f"instance {name} up on :{port} (pid {proc.pid})")
    return proc


def kill_port(port):
    subprocess.run(["fuser", "-k", f"{port}/tcp"], capture_output=True)
    time.sleep(1)


class Listener(BaseHTTPRequestHandler):
    def do_POST(self):
        LISTENER_HITS.append(self.path)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_GET(self):
        LISTENER_HITS.append(self.path)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *a):
        pass


def main():
    subprocess.run(["node", "tests/gen-test-keys.mjs"], cwd=ROOT, check=True,
                   capture_output=True, text=True)
    # clean slate for persistence checks
    subprocess.run(["rm", "-rf", os.path.join(ROOT, "server-data")])

    listener = HTTPServer(("127.0.0.1", LISTENER_PORT), Listener)
    threading.Thread(target=listener.serve_forever, daemon=True).start()

    owner = mint()
    nonowner = mint({"email": "user@example.com", "sub": "user-999"})
    unverified_owner = mint({"email_verified": False})
    wrong_aud = mint({"aud": "another-project"})
    forged = None  # built below for instance B

    proc_a = boot("A", PORT_A, {"OWNER_EMAILS": "owner-test@example.com"},
                  "tests/test-server.ts")
    try:
        # --- auth gate ---
        s, _ = req("GET", PORT_A, "/api/scheduler/status")
        check("A2 protected route without token -> 401", s == 401, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/scheduler/status", token="garbage.token.here")
        check("A3 garbage token -> 401", s == 401, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/scheduler/status", token=owner)
        check("A4 owner token -> scheduler/status 200 (M4 owner-only)", s == 200, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/scheduler/status", token=nonowner)
        check("A5 non-owner token -> 403 on scheduler/status (M4)", s == 403, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/scheduler/status", token=unverified_owner)
        check("A6 owner email but email_verified=false -> 403 (C4)", s == 403, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/scheduler/status", token=wrong_aud)
        check("A7 wrong-audience token -> 401 (C4)", s == 401, f"got {s}")

        # --- crash class (C2) ---
        s, _ = req("POST", PORT_A, "/api/call/ai-turn",
                   {"agentConfig": {"objectionHandlers": "x"}}, token=owner)
        check("A8 audit crash repro 1 (ai-turn string objectionHandlers) -> 400", s == 400, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/health")
        check("A8b process alive after repro 1", s == 200)
        s, _ = req("POST", PORT_A, "/api/leads/scrape", {"specialty": 123}, token=owner)
        check("A9 audit crash repro 2 (scrape numeric specialty) -> 400", s == 400, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/health")
        check("A9b process alive after repro 2", s == 200)
        s, _ = req("POST", PORT_A, "/api/chat", token=owner, raw=b"{not json")
        check("A10 malformed JSON -> 400 JSON", s == 400, f"got {s}")
        s, _ = req("POST", PORT_A, "/api/chat", token=owner, raw=b"[1,2,3]")
        check("A11 array body -> 400", s == 400, f"got {s}")
        s, _ = req("POST", PORT_A, "/api/chat", {"messages": "not-an-array"}, token=owner)
        check("A11b wrong-typed messages -> 400", s == 400, f"got {s}")
        s, _ = req("GET", PORT_A, "/api/health")
        check("A11c process alive after malformed battery", s == 200)

        # --- fabrication sweep (C1) ---
        bodies = {}
        s, b = req("POST", PORT_A, "/api/leads/scrape", {}, token=owner)
        bodies["scrape"] = json.dumps(b)
        check("A12a scrape returns honest empty (no live source)",
              s == 200 and b.get("leads") == [] and b.get("status") == "no_live_source",
              f"got {s} {b.get('status')}")
        s, b = req("POST", PORT_A, "/api/leads/linkedin-search", {}, token=owner)
        bodies["linkedin-search"] = json.dumps(b)
        check("A12b linkedin-search returns honest empty",
              s == 200 and b.get("prospects") == [], f"got {s}")
        s, b = req("POST", PORT_A, "/api/briefing/generate", {}, token=owner)
        bodies["briefing"] = json.dumps(b)
        check("A12c briefing with no stats reports zeros",
              s == 200 and (b.get("stats") or {}).get("callsPlaced") == 0,
              f"got {s} stats={b.get('stats')}")
        s, b = req("POST", PORT_A, "/api/call/generate-notes", {}, token=owner)
        bodies["notes"] = json.dumps(b)
        check("A12d generate-notes without key -> not_configured",
              b.get("status") == "not_configured" and b.get("success") is False, f"got {b}")
        s, b = req("POST", PORT_A, "/api/audio/transcribe", {"base64Audio": "QUJD"}, token=owner)
        bodies["transcribe"] = json.dumps(b)
        check("A12e transcribe without key -> not_configured",
              b.get("status") == "not_configured" and b.get("success") is False, f"got {b}")
        joined = " ".join(bodies.values())
        check("A12f invented strings appear in NO response",
              "Austin Heart & Vascular Institute" not in joined
              and "Karen Abernathy" not in joined
              and "Dr. Vance" not in joined)
        check("A12g invented briefing metric '46' absent",
              (bodies["briefing"] and '"callsPlaced": 46' not in bodies["briefing"]
               and "46 Calls" not in bodies["briefing"]))

        # --- LinkedIn send (C6) ---
        s, b = req("POST", PORT_A, "/api/linkedin/send-connection",
                   {"prospectName": "Test Person", "practiceName": "Test Practice"}, token=owner)
        check("A13 send-connection -> 501 simulated:true success:false",
              s == 501 and b.get("simulated") is True and b.get("success") is False
              and b.get("error") == "LinkedIn sending is not connected",
              f"got {s} {b}")

        # --- smart-filter heuristic honesty (C1) ---
        s, b = req("POST", PORT_A, "/api/linkedin/smart-filter",
                   {"prospect": {"fullName": "Pat Admin", "headline": "Practice Administrator at Clinic"}},
                   token=owner)
        r = b.get("result") or {}
        check("A14 heuristic fallback labeled, no fabricated precision",
              r.get("source") == "heuristic" and r.get("confidence") is None
              and r.get("confidenceBand") in ("high", "low"), f"got {r}")

        # --- scheduler persistence (C8) + honest success (M5) ---
        s, _ = req("POST", PORT_A, "/api/scheduler/report-stats",
                   {"stats": {"callsPlaced": 99, "humanConnects": 44}}, token=owner)
        check("P1 report-stats accepted", s == 200, f"got {s}")
        s, b = req("POST", PORT_A, "/api/scheduler/config",
                   {"recipientEmail": "briefing-test@example.com", "scheduledTimePST": "09:30"},
                   token=owner)
        check("P2 owner can update scheduler config", s == 200, f"got {s}")
        s, b = req("POST", PORT_A, "/api/scheduler/trigger-now", {}, token=owner)
        check("P3 trigger-now without Resend key -> success:false (M5)",
              b.get("success") is False and b.get("status") == "not_configured", f"got {b}")
        s, b = req("GET", PORT_A, "/api/scheduler/status", token=owner)
        cfg = b.get("config") or {}
        check("P4 state visible before restart",
              cfg.get("recipientEmail") == "briefing-test@example.com"
              and cfg.get("scheduledTimePST") == "09:30"
              and (cfg.get("latestReportStats") or {}).get("callsPlaced") == 99
              and len(cfg.get("history") or []) >= 1, f"cfg={cfg}")
        # --- rate limiter XFF evasion (M3) ---
        got429 = False
        for i in range(130):
            s, _ = req("GET", PORT_A, "/api/scheduler/status", token=owner,
                       headers={"X-Forwarded-For": f"10.9.9.{i % 250}"})
            if s == 429:
                got429 = True
                break
        check("A15 rotating X-Forwarded-For cannot evade the rate limiter (M3)", got429)

        # --- SSRF + honest webhook receipts (C5) ---
        hits_before = len(LISTENER_HITS)
        s, b = req("POST", PORT_A, "/api/linkedin/crm-webhook-test",
                   {"webhookUrl": f"http://127.0.0.1:{LISTENER_PORT}/hook"}, token=owner)
        check("A16 webhook-test to loopback listener -> 400 (SSRF guard)", s == 400, f"got {s}")
        s, b = req("POST", PORT_A, "/api/linkedin/crm-webhook-sync",
                   {"webhookUrl": f"http://127.0.0.1:{LISTENER_PORT}/hook",
                    "events": [{"prospectName": "X"}]}, token=owner)
        check("A17 webhook-sync to loopback listener -> 400 (SSRF guard)", s == 400, f"got {s}")
        check("A17b listener received ZERO hits from guarded endpoints",
              len(LISTENER_HITS) == hits_before, f"hits={LISTENER_HITS[hits_before:]}")
        s, b = req("POST", PORT_A, "/api/linkedin/crm-webhook-test",
                   {"webhookUrl": "http://169.254.169.254/computeMetadata/v1/"}, token=owner)
        check("A18 webhook-test to cloud metadata IP -> 400", s == 400, f"got {s}")
        s, b = req("POST", PORT_A, "/api/linkedin/crm-webhook-test",
                   {"webhookUrl": "http://203.0.113.10:81/hook"}, token=owner, timeout=25)
        check("A19 dead public webhook reports failure, never a fake 200",
              b.get("success") is False and b.get("statusCode") != 200, f"got {b}")
        s, b = req("POST", PORT_A, "/api/linkedin/crm-webhook-test",
                   {"webhookUrl": "https://httpbin.org/post"}, token=owner, timeout=25)
        if b.get("statusCode") is None:
            skip("A20 webhook-test to real 200 endpoint", "httpbin unreachable from sandbox")
        else:
            check("A20 webhook-test to real endpoint reports its true 200",
                  b.get("success") is True and b.get("statusCode") == 200, f"got {b}")
        s, b = req("POST", PORT_A, "/api/linkedin/crm-webhook-sync",
                   {"webhookUrl": "https://httpbin.org/post",
                    "events": [{"prospectName": "Real Test", "status": "sent"}]}, token=owner, timeout=25)
        recs = b.get("records") or []
        if s != 200 or not recs or recs[0].get("deliveryStatusCode") is None:
            skip("A21 webhook-sync records the real delivery outcome",
                 f"public delivery endpoint unreachable/flaky from sandbox (status {s})")
        else:
            check("A21 webhook-sync records the real delivery outcome",
                  len(recs) == 1 and recs[0].get("deliveryStatus") == "delivered"
                  and recs[0].get("deliveredToWebhook") == "DELIVERED_200"
                  and recs[0].get("smartFilterScore") is None, f"got {recs}")

        # --- NPI honesty (M6) ---
        try:
            s, b = req("POST", PORT_A, "/api/leads/npi-search",
                       {"city": "Houston", "state": "TX", "limit": 3}, token=owner, timeout=30)
            leads = b.get("leads") or []
            if s == 200 and leads:
                lead = leads[0]
                est = lead.get("estimates") or {}
                check("A22 NPI records carry no invented enrichment (M6)",
                      lead.get("verified") is True
                      and "ehrSystem" not in lead
                      and est.get("estimated") is True
                      and est.get("ehrSystem") is None
                      and lead.get("phone") != "(555) 000-0000",
                      f"lead keys={sorted(lead.keys())}")
            else:
                skip("A22 NPI records carry no invented enrichment (M6)",
                     f"NPI registry unreachable from sandbox (status {s})")
        except Exception as e:
            skip("A22 NPI records carry no invented enrichment (M6)", str(e))

    finally:
        kill_port(PORT_A)

    # reboot A — state must survive (C8)
    proc_a2 = boot("A2", PORT_A, {"OWNER_EMAILS": "owner-test@example.com"},
                   "tests/test-server.ts")
    try:
        s, b = req("GET", PORT_A, "/api/scheduler/status", token=owner)
        cfg = b.get("config") or {}
        check("P5 scheduler config/stats/history SURVIVE a restart (C8)",
              s == 200
              and cfg.get("recipientEmail") == "briefing-test@example.com"
              and cfg.get("scheduledTimePST") == "09:30"
              and (cfg.get("latestReportStats") or {}).get("callsPlaced") == 99
              and len(cfg.get("history") or []) >= 1, f"cfg={cfg}")
    finally:
        kill_port(PORT_A)

    # --- instance B: test-mode bypass must not exist (C3) ---
    proc_b = boot("B", PORT_B,
                  {"NODE_ENV": "test", "TEST_AUTH_SECRET": "super-secret",
                   "OWNER_EMAILS": "owner-test@example.com"},
                  "server.ts")
    try:
        import base64
        def b64u(raw: bytes) -> str:
            return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
        now = int(time.time())
        header = b64u(json.dumps({"alg": "RS256", "kid": "whatever", "typ": "JWT"}).encode())
        payload = b64u(json.dumps({
            "sub": "attacker", "aud": "steam-antonym-9mn89",
            "iss": "https://securetoken.google.com/steam-antonym-9mn89",
            "iat": now, "exp": now + 3600,
            "email": "owner-test@example.com", "email_verified": True}).encode())
        forged = f"{header}.{payload}.AAAA"
        s, b = req("POST", PORT_B, "/api/scheduler/config",
                   {"recipientEmail": "attacker@example.com"}, token=forged, timeout=30)
        check("B1 self-minted JWT in NODE_ENV=test is rejected (C3)",
              s in (401, 503), f"got {s} {b}")
        s, _ = req("GET", PORT_B, "/api/health")
        check("B2 instance B alive after forged-token attempt", s == 200)
    finally:
        kill_port(PORT_B)

    # --- instance C: AI quota (M7) ---
    proc_c = boot("C", PORT_C,
                  {"OWNER_EMAILS": "owner-test@example.com", "AI_DAILY_QUOTA_PER_USER": "3"},
                  "tests/test-server.ts")
    try:
        codes = []
        for _ in range(4):
            s, b = req("POST", PORT_C, "/api/chat", {"messages": []}, token=owner)
            codes.append((s, b.get("error")))
        check("C1 per-user daily AI quota trips with 429 AI_QUOTA_EXCEEDED (M7)",
              codes[3][0] == 429 and codes[3][1] == "AI_QUOTA_EXCEEDED", f"codes={codes}")
    finally:
        kill_port(PORT_C)

    hard_fail = [r for r in RESULTS if r[1] is False]
    passed = [r for r in RESULTS if r[1] is True]
    skipped = [r for r in RESULTS if r[1] is None]
    print(f"\n==== Phase 0 battery: {len(passed)} passed, {len(hard_fail)} failed, {len(skipped)} skipped ====")
    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
