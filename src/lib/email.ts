import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const EMAIL_FROM = process.env.EMAIL_FROM || 'KeyHub <noreply@keyhub.dev>'

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!resend) {
    console.log(`[Email Dev] To: ${to}`)
    console.log(`[Email Dev] Subject: ${subject}`)
    console.log(`[Email Dev] Body length: ${html.length} chars`)
    return
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[Email] Failed to send:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
