/**
 * Idempotent admin bootstrap — safe to re-run.
 * Usage: npx ts-node prisma/ensure-admins.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const ADMIN_ACCOUNTS = [
  { name: 'Admin User', email: 'asukuonukaba@gmail.com' },
  { name: 'Admin User', email: 'tayuzeee@gmail.com' },
  { name: 'Admin User', email: 'Smartlynks97@gmail.com' },
];

const ADMIN_PASSWORD = 'password123';

const prisma = new PrismaClient();

async function main() {
  await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (!adminRole) throw new Error('admin role missing');

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  for (const admin of ADMIN_ACCOUNTS) {
    const email = admin.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: { name: admin.name, email, passwordHash },
      });
      console.log(`Created admin: ${email}`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      console.log(`Updated password for: ${email}`);
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id },
    });

    console.log(`  role=admin OK`);
  }

  console.log(`\nDone. Login with password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
