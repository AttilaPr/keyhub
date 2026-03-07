import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('P@ssword1', 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@keyhub.com' },
    update: { passwordHash },
    create: {
      email: 'admin@keyhub.com',
      name: 'Admin',
      passwordHash,
    },
  })

  console.log('Seeded user:', user.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
