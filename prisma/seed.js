const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const users = [
    { name: 'Gabi', email: 'gabi@memini.de', password: 'memini2024!', role: 'admin' },
    { name: 'Laci', email: 'laci@memini.de', password: 'memini2024!', role: 'user' },
  ]

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (!existing) {
      const hashed = await bcrypt.hash(u.password, 12)
      await prisma.user.create({
        data: { name: u.name, email: u.email, password: hashed, role: u.role },
      })
      console.log(`✓ Létrehozva: ${u.name} (${u.email}) — jelszó: ${u.password}`)
    } else {
      console.log(`- Már létezik: ${u.name} (${u.email})`)
    }
  }

  console.log('\nKész! Változtasd meg a jelszavakat éles deployban.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
