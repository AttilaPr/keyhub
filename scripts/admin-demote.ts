import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: pnpm admin:demote <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  if (user.role === 'USER') {
    console.log(`${email} is already a regular USER`)
    return
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'USER' },
  })

  console.log(`Demoted ${email} to USER`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
