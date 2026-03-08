import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: pnpm admin:promote <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  if (user.role === 'SUPER_ADMIN') {
    console.log(`${email} is already a SUPER_ADMIN`)
    return
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'SUPER_ADMIN' },
  })

  console.log(`Promoted ${email} to SUPER_ADMIN`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
