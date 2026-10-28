#!/usr/bin/env python3
"""
Pulsar Phases 4–6 — HTTP acceptance battery (Phoenix line).

Phase 4: lead registry (provenance enforced, demo/simulated refused),
       dedupe (NPI / phone / name+address), suppressions (incl. at import),
       deterministic enrichment with named rules, LinkedIn assisted flow
       (prepare + log outcome; send-connection still 501).
Phase 5: notes only from real transcripts, rule-extracted action items ->
       tasks, tasks completed only by explicit human action, daily stats
       counted from records and reconciled to a hand count, zero day.
Phase 6: email sequences through the mailer — with no key the delivery is
       honestly 'not_configured' and the enrollment does NOT advance; with
       a (mock) Resend endpoint a 3-step sequence delivers with real
       provider message ids and completes; pause stops sends; a suppressed
       address receives nothing; plan send caps enforced; Resend webhook
       signature verification + bounce/complaint handling.

Instance A (:3241) — no GEMINI/RESEND keys, no webhook secret.
Instance B (:3242) — RESEND_API_KEY + RESEND_API_URL pointing at a local
       mock Resend server (:3243) + RESEND_WEBHOOK_SECRET set.

Run from the project root:  python3 tests-phase4-6.py
Exits non-zero if any hard check fails.
"""
import base64
import hashlib
import hmac as hmac_mod
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_A = 3241
PORT_B = 3242
PORT_MOCK = 3243
WEBHOOK_SECRET = "whsec_" + base64.b64encode(b"battery-webhook-secret-0123456789").decode()

RESULTS = []
SKIPS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail and not cond else ""))


def skip(name, why):
    SKIPS.append(name)
    print(f"[SKIP] {name} — {why}")


def req(method, port, path, body=None, token=None, timeout=25):
    url = f"http://127.0.0.1:{port}{path}"
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


def req_raw(port, path, body_bytes, headers, timeout=15):
    url = f"http://127.0.0.1:{port}{path}"
    r = urllib.request.Request(url, data=body_bytes, method="POST")
    for k, v in headers.items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8", "replace"))
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
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=3) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(1)
    return False


def kill_port(port):
    subprocess.run(["fuser", "-k", f"{port}/tcp"], capture_output=True)
    time.sleep(1)


def boot(port, extra_env):
    subprocess.run(["rm", "-rf", os.path.join(ROOT, "server-data")])
    env = {k: v for k, v in os.environ.items()
           if k not in ("GEMINI_API_KEY", "RESEND_API_KEY", "RESEND_API_URL",
                        "RESEND_WEBHOOK_SECRET", "TEST_AUTH_SECRET",
                        "NODE_ENV", "BRIEFING_RECIPIENT_EMAIL",
                        "DEMO_MODE", "AI_DAILY_QUOTA_PER_USER")}
    env["OWNER_EMAILS"] = "owner-test@example.com"
    env["PORT"] = str(port)
    env.update(extra_env)
    log = open(f"/tmp/pulsar-phase46-{port}.log", "w")
    proc = subprocess.Popen(["npx", "tsx", "tests/test-server.ts"], cwd=ROOT, env=env,
                            stdout=log, stderr=subprocess.STDOUT)
    if not wait_health(port):
        raise RuntimeError(f"instance on :{port} failed to boot; see /tmp/pulsar-phase46-{port}.log")
    print(f"instance up on :{port} (pid {proc.pid})")
    return proc


# --- mock Resend API ---------------------------------------------------------

MOCK_SENT = []


class MockResend(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        if self.path == "/emails":
            try:
                payload = json.loads(body.decode("utf-8", "replace"))
            except Exception:
                payload = {}
            MOCK_SENT.append(payload)
            out = json.dumps({"id": f"mock-msg-{len(MOCK_SENT)}"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass


def sign_webhook(msg_id, body_bytes):
    ts = str(int(time.time()))
    key = base64.b64decode(WEBHOOK_SECRET[len("whsec_"):])
    signed = f"{msg_id}.{ts}.".encode() + body_bytes
    sig = base64.b64encode(hmac_mod.new(key, signed, hashlib.sha256).digest()).decode()
    return {"svix-id": msg_id, "svix-timestamp": ts, "svix-signature": f"v1,{sig}",
            "Content-Type": "application/json"}


# --- instance A ---------------------------------------------------------------

def run_instance_a(owner, fresh):
    print("\n=== Instance A (no keys configured) ===")
    # auth gates
    s, _ = req("GET", PORT_A, "/api/leads/registry")
    check("A: GET /api/leads/registry signed out -> 401", s == 401, f"got {s}")
    s, _ = req("POST", PORT_A, "/api/leads/ingest", {"leads": []})
    check("A: POST /api/leads/ingest signed out -> 401", s == 401, f"got {s}")
    s, _ = req("POST", PORT_A, "/api/sequences/tick", {}, token=None)
    check("A: POST /api/sequences/tick signed out -> 401", s == 401, f"got {s}")

    # ingest: provenance / dedupe / rejection (owner workspace)
    batch = [
        {"practiceName": "Lakeside Cardiology Associates", "doctorName": "Dr. Priya Nair",
         "title": "Practice Administrator", "specialty": "Cardiology",
         "phone": "(512) 555-0142", "email": "admin@lakesidecardio.example",
         "address": "100 Lake Way, Austin, TX 78701", "state": "TX",
         "npiNumber": "1234567893", "source": "CMS NPI Registry (Verified)",
         "provenance": {"source": "CMS NPI Registry (NPPES)", "sourceId": "1234567893",
                        "retrievedAt": "2026-10-23T10:00:00.000Z"}},
        {"practiceName": "Lakeside Cardiology Associates", "doctorName": "Dr. Priya Nair",
         "phone": "512-555-0142", "email": "other@lakeside.example",
         "address": "100 Lake Way, Austin, TX 78701", "source": "csv_import"},
        {"practiceName": "Sourceless Clinic", "email": "x@sourceless.example"},
        {"practiceName": "Demo Practice", "source": "demo", "simulated": True,
         "email": "demo@demo.example"},
        {"practiceName": "Riverside Pathology Lab", "doctorName": "Dr. Owen Hart",
         "specialty": "Pathology", "email": "lab@riversidepath.example",
         "phone": "(737) 555-0119", "address": "9 River Rd, Austin, TX 78704",
         "state": "TX", "source": "csv_import"},
    ]
    s, b = req("POST", PORT_A, "/api/leads/ingest", {"leads": batch}, token=owner)
    outcomes = [r.get("outcome") for r in b.get("results", [])]
    check("A: ingest batch outcomes created/duplicate/rejected/rejected/created",
          s == 200 and outcomes == ["created", "duplicate", "rejected", "rejected", "created"],
          f"got {s} {outcomes}")
    created_master = b.get("created", 0)

    s, b = req("GET", PORT_A, "/api/leads/registry", token=owner)
    leads = b.get("leads", [])
    check("A: registry holds exactly the 2 created leads", s == 200 and len(leads) == 2, f"got {len(leads)}")
    check("A: every registry lead carries source + sourceId + retrievedAt",
          all(l.get("provenance", {}).get("source") and l.get("provenance", {}).get("sourceId")
              and l.get("provenance", {}).get("retrievedAt") for l in leads))
    lakeside = next((l for l in leads if l["practiceName"].startswith("Lakeside")), None)
    riverside = next((l for l in leads if l["practiceName"].startswith("Riverside")), None)

    # suppressions: add -> ingest matching lead is flagged; delete is master-only
    s, b = req("POST", PORT_A, "/api/suppressions",
               {"identifierType": "email", "identifier": "block@path.example", "reason": "opt_out"}, token=owner)
    sup_id = b.get("suppression", {}).get("id")
    check("A: suppression created", s == 201 and bool(sup_id), f"got {s} {b}")
    s, b = req("POST", PORT_A, "/api/leads/ingest",
               {"leads": [{"practiceName": "Blocked Path Group", "email": "block@path.example",
                           "specialty": "Pathology", "source": "csv_import"}]}, token=owner)
    check("A: suppressed-at-import lead is created but flagged suppressed",
          s == 200 and b.get("results", [{}])[0].get("suppressed") is True, f"got {b}")
    created_master += b.get("created", 0)
    s, _ = req("DELETE", PORT_A, f"/api/suppressions/{sup_id}", token=fresh)
    check("A: suppression delete by non-master -> 403", s == 403, f"got {s}")
    s, _ = req("DELETE", PORT_A, f"/api/suppressions/{sup_id}", token=owner)
    check("A: suppression delete by master -> 200", s == 200, f"got {s}")

    # enrichment: named rules, nothing invented
    s, b = req("POST", PORT_A, "/api/leads/enrich", {}, token=owner)
    enriched = b.get("leads", [])
    lake_e = next((l for l in enriched if l["id"] == (lakeside or {}).get("id")), None)
    rules = [r.get("rule") for r in (lake_e or {}).get("enrichment", {}).get("rulesApplied", [])]
    check("A: enrich applies named rules (specialty-fit, registry-verified-identity)",
          s == 200 and "specialty-fit" in rules and "registry-verified-identity" in rules, f"got {rules}")
    check("A: enrichment invents no EHR/volume/pain-point fields",
          all("ehrSystem" not in (l.get("enrichment") or {}) and l.get("ehrSystem") is None for l in enriched))

    # LinkedIn assisted flow
    s, b = req("POST", PORT_A, "/api/linkedin/assist/prepare",
               {"prospect": {"fullName": "Dr. Priya Nair", "practice": "Lakeside Cardiology Associates",
                             "linkedInUrl": "https://linkedin.com/in/example", "specialty": "Cardiology"}},
               token=owner)
    assist = b.get("assist", {})
    check("A: assist prepare -> template draft naming the prospect",
          s == 201 and assist.get("draftSource") == "template" and "Priya" in assist.get("draftMessage", ""),
          f"got {s} {assist.get('draftSource')}")
    s, b = req("POST", PORT_A, f"/api/linkedin/assist/{assist.get('id')}/log-outcome",
               {"outcome": "sent_manually"}, token=owner)
    check("A: assist outcome logged", s == 200 and b.get("assist", {}).get("status") == "sent_manually", f"got {s}")
    s, b = req("POST", PORT_A, f"/api/linkedin/assist/{assist.get('id')}/log-outcome",
               {"outcome": "teleported"}, token=owner)
    check("A: invalid outcome -> 400", s == 400, f"got {s}")
    s, b = req("POST", PORT_A, "/api/linkedin/send-connection",
               {"prospectName": "Dr. Priya Nair"}, token=owner)
    check("A: send-connection still 501 not_connected (no simulated sends)",
          s == 501 and b.get("status") == "not_connected", f"got {s} {b}")

    # Phase 5: notes from a real transcript -> tasks -> counted stats
    transcript = ("Rep: Thanks for taking the call.\n"
                  "Prospect: Denials are killing us this quarter.\n"
                  "Action: Send the audit checklist by Friday\n"
                  "Prospect: Please send over the fee schedule too.\n"
                  "Rep: Will do.")
    s, b = req("POST", PORT_A, "/api/notes/from-transcript",
               {"leadId": (lakeside or {}).get("id"), "transcript": transcript, "title": "Discovery call"},
               token=owner)
    note = b.get("note", {})
    tasks_created = b.get("tasksCreated", [])
    check("A: transcript note is deterministic without a Gemini key (summary null, nothing invented)",
          s == 201 and note.get("summarySource") == "deterministic" and note.get("summary") is None,
          f"got {s} {note.get('summarySource')}")
    check("A: rule-extracted action items became 2 tasks",
          len(tasks_created) == 2 and all(t.get("status") == "open" for t in tasks_created),
          f"got {len(tasks_created)}")
    check("A: note stores the transcript it came from",
          note.get("transcript") == transcript)
    s, b = req("POST", PORT_A, "/api/notes/from-transcript", {"transcript": "   "}, token=owner)
    check("A: empty transcript -> 400", s == 400, f"got {s}")

    task_id = tasks_created[0]["id"] if tasks_created else None
    s, b = req("PATCH", PORT_A, f"/api/tasks/{task_id}", {"status": "done"}, token=owner)
    check("A: task completed only via explicit PATCH, stamped with actor",
          s == 200 and b.get("task", {}).get("status") == "done"
          and b.get("task", {}).get("completedBy") == "owner-test@example.com", f"got {s} {b.get('task')}")

    # NPI live ingest (hand-verification against CMS) — skip-tolerant
    npi_created = 0
    try:
        s, b = req("POST", PORT_A, "/api/leads/npi-search",
                   {"state": "TX", "taxonomy_description": "Cardiology", "limit": 25}, token=owner, timeout=40)
        npi_leads = b.get("leads", []) if s == 200 else []
        if not npi_leads:
            raise RuntimeError(f"npi-search returned {s}")
        s2, b2 = req("POST", PORT_A, "/api/leads/ingest", {"leads": npi_leads}, token=owner)
        npi_created = b2.get("created", 0)
        check("A: live NPI results ingest into the registry with provenance",
              s2 == 200 and npi_created > 0, f"created={npi_created}")
        sample = next((l for l in npi_leads if l.get("npiNumber")), None)
        if sample:
            url = f"https://npiregistry.cms.hhs.gov/api/?version=2.1&number={sample['npiNumber']}"
            with urllib.request.urlopen(url, timeout=30) as resp:
                cms = json.loads(resp.read().decode())
            entry = (cms.get("results") or [{}])[0]
            basic = entry.get("basic", {})
            cms_name = (basic.get("organization_name") or
                        f"{basic.get('first_name', '')} {basic.get('last_name', '')}").strip()
            check("A: hand-verification — ingested practice name matches the live CMS record",
                  cms_name.split()[0].lower() in sample["practiceName"].lower()
                  or sample["practiceName"].split()[0].lower() in cms_name.lower(),
                  f"cms='{cms_name}' lead='{sample['practiceName']}'")
    except Exception as e:
        skip("A: live NPI ingest + hand-verification", f"CMS registry unreachable from sandbox: {e}")
    created_master += npi_created

    # daily stats reconcile to the hand count for the master workspace
    today = time.strftime("%Y-%m-%d", time.gmtime())
    s, b = req("GET", PORT_A, f"/api/briefing/daily-stats?date={today}", token=owner)
    counts = b.get("stats", {}).get("counts", {})
    check("A: daily stats leadsIngested reconciles to hand count",
          counts.get("leadsIngested") == created_master,
          f"stats={counts.get('leadsIngested')} hand={created_master}")
    check("A: daily stats notes/tasks reconcile (1 note, 2 created, 1 completed)",
          counts.get("notesCreated") == 1 and counts.get("tasksCreated") == 2
          and counts.get("tasksCompleted") == 1, f"got {counts}")
    s, b = req("GET", PORT_A, "/api/briefing/daily-stats?date=2020-01-01", token=owner)
    check("A: zero-activity day returns genuine zeros and says so",
          b.get("stats", {}).get("hasActivity") is False
          and all(v == 0 for v in b.get("stats", {}).get("counts", {}).values()), f"got {b.get('stats')}")

    # plan gates on the new surface
    s, _ = req("GET", PORT_A, "/api/me/access", token=fresh)
    s, b = req("POST", PORT_A, "/api/leads/ingest", {"leads": []}, token=fresh)
    check("A: pending-approval user -> 403 ACCOUNT_NOT_ACTIVE on ingest",
          s == 403 and b.get("error") == "ACCOUNT_NOT_ACTIVE", f"got {s} {b}")
    s, b = req("GET", PORT_A, "/api/admin/signup-requests", token=owner)
    fresh_uid = next((u["uid"] for u in b.get("requests", []) if u.get("email") == "fresh@example.com"), "fresh-1")
    s, b = req("POST", PORT_A, f"/api/admin/signup-requests/{fresh_uid}/approve",
               {"planId": "trial"}, token=owner)
    check("A: owner approves fresh user onto Trial", s == 200, f"got {s}")
    s, b = req("POST", PORT_A, "/api/sequences",
               {"name": "Trial seq", "steps": [{"subject": "s", "body": "b"}]}, token=fresh)
    check("A: Trial plan (no campaigns) -> 403 PLAN_FEATURE_NOT_INCLUDED on sequence create",
          s == 403 and b.get("error") == "PLAN_FEATURE_NOT_INCLUDED", f"got {s} {b}")
    s, b = req("GET", PORT_A, "/api/leads/registry?workspaceId=ws_pulsar_master", token=fresh)
    check("A: another workspace's registry -> 403", s == 403, f"got {s}")

    # Phase 6 without a mailer key: honest not_configured, no advancement
    s, b = req("POST", PORT_A, "/api/sequences",
               {"name": "No-key sequence", "timezone": "UTC",
                "steps": [{"subject": "Hello {{practiceName}}", "body": "Hi {{firstName}}",
                           "delayDays": 0, "windowStart": "00:00", "windowEnd": "23:59"}]}, token=owner)
    seq_id = b.get("sequence", {}).get("id")
    check("A: sequence created (draft)", s == 201 and b.get("sequence", {}).get("status") == "draft", f"got {s}")
    s, b = req("POST", PORT_A, f"/api/sequences/{seq_id}/enroll",
               {"leadIds": [(riverside or {}).get("id")]}, token=owner)
    check("A: enrollment created", s == 200 and b.get("results", [{}])[0].get("outcome") == "enrolled", f"got {b}")
    s, b = req("PATCH", PORT_A, f"/api/sequences/{seq_id}", {"status": "active"}, token=owner)
    check("A: sequence activated", s == 200 and b.get("sequence", {}).get("status") == "active", f"got {s}")
    s, b = req("POST", PORT_A, "/api/sequences/tick", {}, token=owner)
    summ = b.get("summary", {})
    check("A: tick with no Resend key -> not_configured, nothing sent",
          summ.get("notConfigured") == 1 and summ.get("sent") == 0, f"got {summ}")
    s, b = req("GET", PORT_A, f"/api/sequences/deliveries?sequenceId={seq_id}", token=owner)
    dlv = b.get("deliveries", [])
    check("A: delivery record is honest (not_configured, no message id)",
          len(dlv) == 1 and dlv[0].get("status") == "not_configured" and dlv[0].get("providerMessageId") is None,
          f"got {dlv}")
    s, b = req("GET", PORT_A, "/api/sequences", token=owner)
    enr = next((e for sq in b.get("sequences", []) if sq["id"] == seq_id for e in sq.get("enrollments", [])), {})
    check("A: enrollment did NOT advance on a send that never happened",
          enr.get("currentStep") == 0 and enr.get("status") == "active", f"got {enr}")

    # webhook without a secret -> honest 503
    s, b = req("POST", PORT_A, "/api/webhooks/resend", {"type": "email.delivered", "data": {"email_id": "x"}})
    check("A: webhook without RESEND_WEBHOOK_SECRET -> 503 not_configured",
          s == 503 and b.get("status") == "not_configured", f"got {s} {b}")


# --- instance B ---------------------------------------------------------------

def run_instance_b(owner, growth):
    print("\n=== Instance B (mock Resend + webhook secret) ===")
    # growth user: sign in + approve onto Growth (all features)
    req("GET", PORT_B, "/api/me/access", token=growth)
    s, b = req("GET", PORT_B, "/api/admin/signup-requests", token=owner)
    growth_uid = next((u["uid"] for u in b.get("requests", []) if u.get("email") == "growth@example.com"), "growth-1")
    s, b = req("POST", PORT_B, f"/api/admin/signup-requests/{growth_uid}/approve",
               {"planId": "growth"}, token=owner)
    check("B: growth user approved onto Growth plan", s == 200, f"got {s}")

    lead_seq = [0]

    def make_lead(email, name):
        lead_seq[0] += 1
        s, b = req("POST", PORT_B, "/api/leads/ingest",
                   {"leads": [{"practiceName": name, "doctorName": "Dr. Test Person",
                               "specialty": "Cardiology", "email": email,
                               "phone": f"(512) 555-01{lead_seq[0]:02d}", "source": "csv_import"}]}, token=growth)
        assert s == 200 and b["results"][0]["outcome"] == "created", f"lead ingest failed: {b}"
        return b["results"][0]["leadId"]

    def make_sequence(name, steps, lead_ids):
        s, b = req("POST", PORT_B, "/api/sequences",
                   {"name": name, "timezone": "UTC", "steps": steps}, token=growth)
        assert s == 201, f"sequence create failed: {b}"
        seq_id = b["sequence"]["id"]
        s, b = req("POST", PORT_B, f"/api/sequences/{seq_id}/enroll",
                   {"leadIds": lead_ids}, token=growth)
        assert s == 200 and all(r["outcome"] == "enrolled" for r in b["results"]), f"enroll failed: {b}"
        s, b = req("PATCH", PORT_B, f"/api/sequences/{seq_id}", {"status": "active"}, token=growth)
        assert s == 200, f"activate failed: {b}"
        return seq_id

    step = lambda subj: {"subject": subj, "body": "Hi {{firstName}} from ThriveMed.",
                         "delayDays": 0, "windowStart": "00:00", "windowEnd": "23:59"}

    # 3-step sequence delivers with real (mock) provider ids and completes
    lead1 = make_lead("one@mock.example", "Mock Cardiology One")
    seq3 = make_sequence("Three-step", [step("Step 1"), step("Step 2"), step("Step 3")], [lead1])
    for i in range(3):
        s, b = req("POST", PORT_B, "/api/sequences/tick", {}, token=growth)
        assert b.get("summary", {}).get("sent") == 1, f"tick {i+1} did not send: {b}"
    s, b = req("GET", PORT_B, f"/api/sequences/deliveries?sequenceId={seq3}", token=growth)
    dlv = b.get("deliveries", [])
    check("B: 3-step sequence delivered 3 times with provider message ids",
          len(dlv) == 3 and all(d.get("status") == "sent" and str(d.get("providerMessageId", "")).startswith("mock-msg-") for d in dlv),
          f"got {[(d.get('status'), d.get('providerMessageId')) for d in dlv]}")
    # (The mock also received the plan-approval email for the growth user —
    # a real mailer send from the Phases 1–3 approval flow, correctly so.)
    to_lead = [m for m in MOCK_SENT if m.get("to") == ["one@mock.example"]]
    check("B: mock Resend received exactly 3 sequence sends, addressed to the lead",
          len(to_lead) == 3, f"got {len(to_lead)} of {len(MOCK_SENT)} total")
    s, b = req("GET", PORT_B, "/api/sequences", token=growth)
    enr = next((e for sq in b.get("sequences", []) if sq["id"] == seq3 for e in sq.get("enrollments", [])), {})
    check("B: enrollment completed after the final step",
          enr.get("status") == "completed" and enr.get("currentStep") == 3, f"got {enr}")
    first_msg_id = dlv[-1].get("providerMessageId")  # deliveries are newest-first

    # webhook: delivered event with a valid signature updates the record
    body = json.dumps({"type": "email.delivered", "data": {"email_id": first_msg_id}}).encode()
    s, b = req_raw(PORT_B, "/api/webhooks/resend", body, sign_webhook("evt-delivered", body))
    check("B: signed delivered webhook accepted and matched",
          s == 200 and b.get("matched") is True, f"got {s} {b}")
    s, b = req("GET", PORT_B, f"/api/sequences/deliveries?sequenceId={seq3}", token=growth)
    updated = next((d for d in b.get("deliveries", []) if d.get("providerMessageId") == first_msg_id), {})
    check("B: delivery status progressed to delivered",
          updated.get("status") == "delivered", f"got {updated.get('status')}")
    s, b = req_raw(PORT_B, "/api/webhooks/resend", body,
                   {"svix-id": "evt-bad", "svix-timestamp": str(int(time.time())),
                    "svix-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                    "Content-Type": "application/json"})
    check("B: webhook with a bad signature -> 400", s == 400, f"got {s}")

    # pause stops future sends within one tick
    lead2 = make_lead("two@mock.example", "Mock Cardiology Two")
    seq_p = make_sequence("Pausable", [step("Only step")], [lead2])
    s, b = req("PATCH", PORT_B, f"/api/sequences/{seq_p}", {"status": "paused"}, token=growth)
    before = len(MOCK_SENT)
    s, b = req("POST", PORT_B, "/api/sequences/tick", {}, token=growth)
    s2, b2 = req("GET", PORT_B, f"/api/sequences/deliveries?sequenceId={seq_p}", token=growth)
    check("B: paused sequence sends nothing",
          len(MOCK_SENT) == before and len(b2.get("deliveries", [])) == 0,
          f"mock {before}->{len(MOCK_SENT)}, deliveries {len(b2.get('deliveries', []))}")

    # suppressed address receives nothing (suppression added after enrollment)
    lead3 = make_lead("three@mock.example", "Mock Cardiology Three")
    seq_s = make_sequence("Suppressible", [step("Only step")], [lead3])
    s, b = req("POST", PORT_B, "/api/suppressions",
               {"identifierType": "email", "identifier": "three@mock.example", "reason": "opt_out"}, token=growth)
    assert s == 201, f"suppression failed: {b}"
    before = len(MOCK_SENT)
    s, b = req("POST", PORT_B, "/api/sequences/tick", {}, token=growth)
    s2, b2 = req("GET", PORT_B, f"/api/sequences/deliveries?sequenceId={seq_s}", token=growth)
    dlv_s = b2.get("deliveries", [])
    check("B: suppressed recipient gets no send; attempt recorded as skipped_suppressed",
          len(MOCK_SENT) == before and len(dlv_s) == 1 and dlv_s[0].get("status") == "skipped_suppressed",
          f"mock {before}->{len(MOCK_SENT)}, dlv {dlv_s}")

    # bounce webhook suppresses the address and stops the enrollment
    lead4 = make_lead("four@mock.example", "Mock Cardiology Four")
    seq_b = make_sequence("Bounceable", [step("Step A"), step("Step B")], [lead4])
    s, b = req("POST", PORT_B, "/api/sequences/tick", {}, token=growth)
    assert b.get("summary", {}).get("sent") == 1, f"bounce setup tick failed: {b}"
    s, b = req("GET", PORT_B, f"/api/sequences/deliveries?sequenceId={seq_b}", token=growth)
    bounce_id = b["deliveries"][0]["providerMessageId"]
    body = json.dumps({"type": "email.bounced", "data": {"email_id": bounce_id}}).encode()
    s, b = req_raw(PORT_B, "/api/webhooks/resend", body, sign_webhook("evt-bounce", body))
    check("B: signed bounce webhook accepted", s == 200 and b.get("matched") is True, f"got {s} {b}")
    s, b = req("GET", PORT_B, "/api/suppressions", token=growth)
    check("B: bounced address is now on the suppression list",
          any(x.get("identifier") == "four@mock.example" and x.get("reason") == "bounce"
              for x in b.get("suppressions", [])), f"got {b.get('suppressions')}")
    s, b = req("GET", PORT_B, "/api/sequences", token=growth)
    enr_b = next((e for sq in b.get("sequences", []) if sq["id"] == seq_b for e in sq.get("enrollments", [])), {})
    check("B: bounced enrollment stopped (step B will never send)",
          enr_b.get("status") == "stopped" and enr_b.get("stopReason") == "bounced", f"got {enr_b}")

    # plan send cap: growth usage so far = 4 sends; cap the plan at 4
    s, b = req("PUT", PORT_B, "/api/admin/plans/growth", {"limits": {"sendsPerMonth": 4}}, token=owner)
    assert s == 200, f"plan cap failed: {b}"
    lead5 = make_lead("five@mock.example", "Mock Cardiology Five")
    seq_l = make_sequence("Capped", [step("Only step")], [lead5])
    before = len(MOCK_SENT)
    s, b = req("POST", PORT_B, "/api/sequences/tick", {}, token=growth)
    check("B: plan send cap stops further sends (planLimitReached)",
          b.get("summary", {}).get("planLimitReached") is True and len(MOCK_SENT) == before,
          f"got {b.get('summary')} mock {before}->{len(MOCK_SENT)}")
    s, b = req("PUT", PORT_B, "/api/admin/plans/growth", {"limits": {"sendsPerMonth": 10000}}, token=owner)
    check("B: plan cap restored", s == 200, f"got {s}")


def main():
    subprocess.run(["node", "tests/gen-test-keys.mjs"], cwd=ROOT, check=True,
                   capture_output=True, text=True)
    owner = mint()  # owner-test@example.com / user-123
    fresh = mint({"email": "fresh@example.com", "sub": "fresh-1"})
    growth = mint({"email": "growth@example.com", "sub": "growth-1"})

    mock_server = ThreadingHTTPServer(("127.0.0.1", PORT_MOCK), MockResend)
    threading.Thread(target=mock_server.serve_forever, daemon=True).start()

    proc_a = boot(PORT_A, {})
    try:
        run_instance_a(owner, fresh)
    finally:
        kill_port(PORT_A)
        proc_a.wait(timeout=10)

    proc_b = boot(PORT_B, {
        "RESEND_API_KEY": "mock-resend-key",
        "RESEND_API_URL": f"http://127.0.0.1:{PORT_MOCK}",
        "RESEND_WEBHOOK_SECRET": WEBHOOK_SECRET,
    })
    try:
        run_instance_b(owner, growth)
    finally:
        kill_port(PORT_B)
        proc_b.wait(timeout=10)
        mock_server.shutdown()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n==== Phases 4-6 battery: {len(RESULTS) - len(failed)} passed, {len(failed)} failed, {len(SKIPS)} skipped ====")
    if failed:
        print("FAILED:", *failed, sep="\n  ")
    if SKIPS:
        print("SKIPPED:", *SKIPS, sep="\n  ")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
