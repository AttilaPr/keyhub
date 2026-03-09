import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { randomBytes } from 'crypto'

const ISSUER = 'KeyHub'

export function generateTotpSecret(email: string): {
  secret: string
  otpauthUrl: string
} {
  const secret = new Secret({ size: 20 })

  const totp = new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })

  return {
    secret: secret.base32,
    otpauthUrl: totp.toString(),
  }
}

export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  const svgString = await QRCode.toString(otpauthUrl, {
    type: 'svg',
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
  return `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  })

  // Allow 1 period window in each direction (±30s)
  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Generate 8-char alphanumeric codes (lowercase + digits)
    const bytes = randomBytes(6)
    const code = bytes
      .toString('base64url')
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 8)
      .toLowerCase()
    codes.push(code)
  }
  return codes
}
