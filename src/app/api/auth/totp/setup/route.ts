import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { encryptKey } from '@/lib/encryption'
import { generateTotpSecret, generateQrCodeDataUrl } from '@/lib/totp'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, totpEnabled: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: 'MFA is already enabled. Disable it first to reconfigure.' },
      { status: 400 }
    )
  }

  // Generate TOTP secret
  const { secret, otpauthUrl } = generateTotpSecret(user.email)

  // Encrypt the secret before storing
  const encryptedSecret = encryptKey(secret)

  // Store encrypted secret on user (not enabled yet)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: encryptedSecret },
  })

  // Generate QR code
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl)

  return NextResponse.json({
    qrCode: qrCodeDataUrl,
    manualEntryKey: secret,
  })
}
