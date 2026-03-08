import { sendEmail } from '@/lib/email'

export type AdminAlertType =
  | 'user.signup'
  | 'user.suspended'
  | 'anomaly.detected'
  | 'key.leaked'
  | 'admin.login'
  | 'admin.login.failed'
  | 'maintenance.toggled'
  | 'audit.integrity_failure'

/**
 * Send an alert to the admin alert channels (email + optional Slack webhook).
 * Silently fails if channels are not configured.
 */
export async function sendAdminAlert(
  type: AdminAlertType,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const promises: Promise<void>[] = []

  // Email channel
  const adminEmail = process.env.ADMIN_ALERT_EMAIL
  if (adminEmail) {
    const subject = `[KeyHub Admin Alert] ${formatAlertType(type)}`
    const html = buildAlertEmailHtml(type, message, metadata)
    promises.push(
      sendEmail(adminEmail, subject, html).catch((err) => {
        console.error('[admin-alert] Failed to send email alert:', err)
      })
    )
  }

  // Slack webhook channel
  const slackWebhook = process.env.ADMIN_SLACK_WEBHOOK
  if (slackWebhook) {
    const slackPayload = {
      text: `*[${formatAlertType(type)}]*\n${message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:warning: Admin Alert: ${formatAlertType(type)}*\n\n${message}`,
          },
        },
        ...(metadata
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: Object.entries(metadata)
                    .map(([k, v]) => `*${k}:* ${String(v)}`)
                    .join('\n'),
                },
              },
            ]
          : []),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `KeyHub Admin | ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    }

    promises.push(
      fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      })
        .then((res) => {
          if (!res.ok) {
            console.error('[admin-alert] Slack webhook failed:', res.status)
          }
        })
        .catch((err) => {
          console.error('[admin-alert] Failed to send Slack alert:', err)
        })
    )
  }

  // If no channels configured, log to console
  if (!adminEmail && !slackWebhook) {
    console.log(`[admin-alert] ${formatAlertType(type)}: ${message}`, metadata ?? '')
  }

  await Promise.allSettled(promises)
}

function formatAlertType(type: AdminAlertType): string {
  const labels: Record<AdminAlertType, string> = {
    'user.signup': 'New User Signup',
    'user.suspended': 'User Suspended',
    'anomaly.detected': 'Anomaly Detected',
    'key.leaked': 'Key Leaked',
    'admin.login': 'Admin Login',
    'admin.login.failed': 'Failed Admin Login',
    'maintenance.toggled': 'Maintenance Mode Toggled',
    'audit.integrity_failure': 'Audit Integrity Failure',
  }
  return labels[type] || type
}

function buildAlertEmailHtml(
  type: AdminAlertType,
  message: string,
  metadata?: Record<string, unknown>,
): string {
  const metadataHtml = metadata
    ? `<table style="margin-top:16px;border-collapse:collapse;font-size:13px;">
        ${Object.entries(metadata)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#888;font-weight:600;">${k}</td><td style="padding:4px 0;color:#ccc;">${String(v)}</td></tr>`
          )
          .join('')}
       </table>`
    : ''

  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#111;color:#eee;padding:24px;border-radius:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:20px;">&#9888;&#65039;</span>
        <h2 style="margin:0;font-size:18px;color:#f5f5f5;">${formatAlertType(type)}</h2>
      </div>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 12px;">${message}</p>
      ${metadataHtml}
      <hr style="border:none;border-top:1px solid #333;margin:20px 0;" />
      <p style="color:#666;font-size:11px;margin:0;">KeyHub Admin Alert | ${new Date().toISOString()}</p>
    </div>
  `
}
