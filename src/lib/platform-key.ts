import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

export function generatePlatformKey(): { raw: string; prefix: string; hash: string } {
  const raw = 'ak-user-' + randomBytes(24).toString('base64url')
  const prefix = raw.slice(0, 16)
  const hash = bcrypt.hashSync(raw, 12)
  return { raw, prefix, hash }
}

export async function verifyPlatformKey(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash)
}
