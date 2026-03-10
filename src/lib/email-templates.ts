function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#18181b;border-radius:12px;border:1px solid #27272a;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #27272a;">
              <span style="font-size:20px;font-weight:700;color:#a3e635;letter-spacing:-0.5px;">KeyHub</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #27272a;text-align:center;">
              <p style="margin:0;font-size:12px;color:#52525b;">
                You received this email because of your KeyHub account settings.
              </p>
              <p style="margin:8px 0 0;font-size:12px;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings" style="color:#71717a;text-decoration:underline;">Notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:10px 24px;background-color:#84cc16;color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">${text}</a>`
}

export function emailVerificationEmail(name: string, verifyUrl: string): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafafa;">Verify your email</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Hi ${escapeHtml(name || 'there')}, thanks for signing up for KeyHub! Please verify your email address
      by clicking the button below.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      This link expires in 24 hours.
    </p>
    ${button('Verify Email', verifyUrl)}
    <p style="margin:16px 0 0;font-size:12px;color:#52525b;">
      If you didn&rsquo;t create a KeyHub account, you can safely ignore this email.
    </p>
  `)
}

export function welcomeEmail(name: string): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafafa;">Welcome to KeyHub, ${escapeHtml(name)}!</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Your account is ready. KeyHub gives you a single API gateway for all your AI providers &mdash;
      manage keys, track costs, and monitor usage from one dashboard.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Here&rsquo;s how to get started:
    </p>
    <ol style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#a1a1aa;">
      <li>Add your AI provider API keys (OpenAI, Anthropic, Google, Mistral)</li>
      <li>Generate a platform key to use as your unified API key</li>
      <li>Point your code to KeyHub&rsquo;s endpoint and start making requests</li>
    </ol>
    ${button('Go to Dashboard', `${baseUrl()}/dashboard`)}
  `)
}

export function orgInviteEmail(
  orgName: string,
  inviterName: string,
  acceptUrl: string,
  expiryDate: string,
): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafafa;">You&rsquo;re invited to join ${escapeHtml(orgName)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      <strong style="color:#e4e4e7;">${escapeHtml(inviterName)}</strong> has invited you to join
      <strong style="color:#e4e4e7;">${escapeHtml(orgName)}</strong> on KeyHub.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      This invitation expires on <strong style="color:#e4e4e7;">${expiryDate}</strong>.
    </p>
    ${button('Accept Invitation', acceptUrl)}
    <p style="margin:16px 0 0;font-size:12px;color:#52525b;">
      If you don&rsquo;t have a KeyHub account, you&rsquo;ll be prompted to create one.
    </p>
  `)
}

export function budgetThresholdEmail(
  currentSpend: number,
  limit: number,
  period: string,
  usageUrl: string,
): string {
  const percent = Math.round((currentSpend / limit) * 100)
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafafa;">Budget Alert: ${percent}% Used</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Your ${period} spend has reached
      <strong style="color:#facc15;">$${currentSpend.toFixed(2)}</strong>
      of your
      <strong style="color:#e4e4e7;">$${limit.toFixed(2)}</strong> limit.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#27272a;border-radius:4px;overflow:hidden;">
          <div style="width:${Math.min(percent, 100)}%;height:8px;background-color:${percent >= 95 ? '#ef4444' : '#facc15'};border-radius:4px;"></div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Review your usage to avoid hitting your budget limit.
    </p>
    ${button('View Usage', usageUrl)}
  `)
}

export function budgetExhaustedEmail(
  currentSpend: number,
  limit: number,
  period: string,
): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ef4444;">Budget Exhausted</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Your ${period} spend has reached
      <strong style="color:#ef4444;">$${currentSpend.toFixed(2)}</strong>,
      exceeding your
      <strong style="color:#e4e4e7;">$${limit.toFixed(2)}</strong> limit.
    </p>
    <div style="padding:16px;background-color:#450a0a;border:1px solid #7f1d1d;border-radius:8px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#fca5a5;">
        If you have hard cap enabled, API requests will be blocked until the next ${period} period begins
        or you increase your budget limit.
      </p>
    </div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Update your budget in <strong style="color:#e4e4e7;">Settings &gt; Budget</strong> to continue using KeyHub.
    </p>
  `)
}

export function anomalyAlertEmail(
  type: string,
  metric: string,
  threshold: string,
  actual: string,
  logsUrl: string,
): string {
  const typeLabels: Record<string, string> = {
    request_volume: 'Request Volume Spike',
    cost_spike: 'Cost Spike',
    error_rate: 'High Error Rate',
    key_dominance: 'Key Dominance Alert',
  }
  const label = typeLabels[type] || type

  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#facc15;">Anomaly Detected: ${label}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      An unusual pattern was detected on your KeyHub account.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="padding:16px;background-color:#1c1c1e;border:1px solid #27272a;border-radius:8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#71717a;">Type</td>
              <td style="padding:4px 0;font-size:13px;color:#e4e4e7;text-align:right;">${label}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#71717a;">Metric</td>
              <td style="padding:4px 0;font-size:13px;color:#e4e4e7;text-align:right;">${metric}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#71717a;">Threshold</td>
              <td style="padding:4px 0;font-size:13px;color:#e4e4e7;text-align:right;">${threshold}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#71717a;">Actual</td>
              <td style="padding:4px 0;font-size:13px;color:#facc15;text-align:right;font-weight:600;">${actual}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      This could indicate a leaked key, a runaway loop, or a provider outage.
      Review your recent activity immediately.
    </p>
    ${button('View Logs', logsUrl)}
  `)
}

export function keyRotationReminderEmail(
  provider: string,
  daysSinceRotation: number,
): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafafa;">Key Rotation Reminder</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Your <strong style="color:#e4e4e7;">${provider}</strong> provider key
      was last rotated <strong style="color:#facc15;">${daysSinceRotation} days ago</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Regular key rotation reduces the risk of unauthorized access from leaked or compromised keys.
      Visit your Provider Keys page to update this key.
    </p>
    ${button('Rotate Key', `${baseUrl()}/provider-keys`)}
  `)
}

export function keyExpiryWarningEmail(
  keyLabel: string,
  expiresAt: string,
): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#facc15;">Platform Key Expiring Soon</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Your platform key <strong style="color:#e4e4e7;">&ldquo;${keyLabel}&rdquo;</strong>
      is set to expire on <strong style="color:#facc15;">${expiresAt}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
      Once expired, all API requests using this key will be rejected with a 403 error.
      Generate a new key or extend the expiration date to avoid service disruption.
    </p>
    ${button('Manage Keys', `${baseUrl()}/platform-keys`)}
  `)
}
