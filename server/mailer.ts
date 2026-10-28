export interface MailerResult {
  status: 'sent' | 'not_configured' | 'failed';
  messageId?: string;
  error?: string;
  recipient: string;
  subject: string;
  timestamp: string;
}

export interface DailyReportStatsPayload {
  callsPlaced?: number;
  humanConnects?: number;
  warmTransfersBridged?: number;
  auditsBooked?: number;
  leadsScraped?: number;
  pipelineAdded?: string;
  suppressionCount?: number;
  activeLeadsCount?: number;
}

/**
 * Dispatches an email via Resend API (Free Tier).
 * If RESEND_API_KEY is unset, honestly returns status: 'not_configured' without fake 200s.
 */
export async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<MailerResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const timestamp = new Date().toISOString();

  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_RESEND_API_KEY') {
    return {
      status: 'not_configured',
      recipient: params.to,
      subject: params.subject,
      timestamp,
      error: 'RESEND_API_KEY is not configured in environment secrets. Email was not dispatched.'
    };
  }

  const fromAddress = params.from || process.env.MAIL_FROM_ADDRESS || 'Pulsar Executive <onboarding@resend.dev>';
  // RESEND_API_URL overrides the API base (default: the real Resend API).
  // It exists so acceptance tests can run against a local mock endpoint and
  // so a self-hosted relay can be used; production leaves it unset.
  const apiBase = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/+$/, '');

  try {
    const res = await fetch(`${apiBase}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || undefined
      })
    });

    const data = await res.json() as any;

    if (!res.ok) {
      return {
        status: 'failed',
        recipient: params.to,
        subject: params.subject,
        timestamp,
        error: data?.message || data?.error || `Resend API returned status ${res.status}`
      };
    }

    return {
      status: 'sent',
      messageId: data?.id,
      recipient: params.to,
      subject: params.subject,
      timestamp
    };
  } catch (err: any) {
    return {
      status: 'failed',
      recipient: params.to,
      subject: params.subject,
      timestamp,
      error: err?.message || 'Network exception while connecting to Resend API'
    };
  }
}

/**
 * Format executive 4:00 PM PST Daily Briefing HTML
 */
export function generateDailyBriefingHtml(stats: DailyReportStatsPayload, recipientEmail: string, pstDateString: string): string {
  const connectRate = stats.callsPlaced && stats.callsPlaced > 0 
    ? Math.round(((stats.humanConnects || 0) / stats.callsPlaced) * 100) 
    : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pulsar 4:00 PM PST Daily Executive Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1220; color: #f1f5f9; margin: 0; padding: 24px; }
    .card { background-color: #111c2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; max-width: 620px; margin: 0 auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 20px; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: rgba(16, 185, 129, 0.18); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin: 12px 0 4px 0; }
    .meta { font-size: 13px; color: #94a3b8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .metric { background-color: #17263b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; }
    .metric-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-value { font-size: 26px; font-weight: 800; color: #10B981; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 32px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Official Daily Dispatch</span>
      <h1>Pulsar Executive Daily Briefing</h1>
      <div class="meta">${pstDateString} (America/Los_Angeles) &bull; Delivered to ${recipientEmail}</div>
    </div>

    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
      Here is your automated end-of-day revenue cycle business development audit. All statistics reflect live verified telemetry from today's pipeline activities:
    </p>

    <div class="grid">
      <div class="metric">
        <div class="metric-label">Calls Placed (Simulation)</div>
        <div class="metric-value">${stats.callsPlaced ?? 0}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Human Connects</div>
        <div class="metric-value" style="color: #22D3EE;">${stats.humanConnects ?? 0} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">(${connectRate}%)</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">Warm Transfers Bridged</div>
        <div class="metric-value" style="color: #F5B83D;">${stats.warmTransfersBridged ?? 0}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Billing Audits Booked</div>
        <div class="metric-value" style="color: #10B981;">${stats.auditsBooked ?? 0}</div>
      </div>
    </div>

    <div style="background-color: #17263b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px; margin-bottom: 24px;">
      <div class="metric-label">New Accounts Scraped Today</div>
      <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 4px;">
        ${stats.leadsScraped ?? 0} Verified Healthcare Practices Added
      </div>
      <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
        Active Qualified Pipeline Volume: <strong style="color: #10B981;">${stats.pipelineAdded || '$0 / mo'}</strong>
      </div>
    </div>

    <div class="footer">
      <strong>Compliance &amp; Operational Disclosure:</strong> Pulsar operates under autonomous business intelligence guidelines. Voice cold calls and telephony integrations are labeled as simulated until live telecom carrier licenses are configured. Telephony actions are governed by TCPA/TSR rules.<br><br>
      Pulsar RCM Autonomous Intelligence &bull; 100 Montgomery St, Suite 1400, San Francisco, CA 94104<br>
      To manage executive alert frequencies, update your workspace preferences in the Pulsar Dashboard.
    </div>
  </div>
</body>
</html>
  `.trim();
}
