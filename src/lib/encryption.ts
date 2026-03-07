import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getSecret(): Buffer {
  const hex = process.env.KEY_ENCRYPTION_SECRET
  if (!hex || hex.length !== 64) {
    throw new Error('KEY_ENCRYPTION_SECRET must be 64 hex chars (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptKey(plaintext: string): string {
  const secret = getSecret()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, secret, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  })
}

export function decryptKey(ciphertext: string): string {
  const secret = getSecret()
  const { iv, tag, data } = JSON.parse(ciphertext)
  const decipher = createDecipheriv(ALGORITHM, secret, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8')
}
