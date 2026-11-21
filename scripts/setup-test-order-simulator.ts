import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/** Local-only fixture bootstrap. Creates dedicated isTestUser accounts and writes secrets only to a gitignored 0600 file. */
const prisma = new PrismaClient();

async function main() {
  const password = `MoeLocal-${randomBytes(12).toString('base64url')}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const roles = Object.fromEntries(
    await Promise.all(
      ['admin', 'artisan', 'customer'].map(async (name) => {
        const role = await prisma.role.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        return [name, role];
      }),
    ),
  );

  async function upsertUser(input: {
    email: string;
    name: string;
    role: 'admin' | 'artisan' | 'customer';
    capabilities?: string[];
  }) {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        name: input.name,
        passwordHash,
        status: 'active',
        isTestUser: true,
        adminCapabilities: input.capabilities ?? [],
      },
      create: {
        email: input.email,
        name: input.name,
        passwordHash,
        status: 'active',
        isTestUser: true,
        adminCapabilities: input.capabilities ?? [],
      },
    });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: roles[input.role].id },
    });
    return user;
  }

  const admin = await upsertUser({
    email: 'sim.admin@local.test',
    name: 'Simulator Admin',
    role: 'admin',
    capabilities: ['payout_amount_approve'],
  });
  const recorder = await upsertUser({
    email: 'sim.recorder@local.test',
    name: 'Simulator Finance Recorder',
    role: 'admin',
    capabilities: ['payout_transfer_record'],
  });
  const verifier = await upsertUser({
    email: 'sim.verifier@local.test',
    name: 'Simulator Finance Verifier',
    role: 'admin',
    capabilities: ['payout_transfer_verify'],
  });
  const artisan = await upsertUser({
    email: 'sim.artisan@local.test',
    name: 'Simulator Artisan',
    role: 'artisan',
  });
  const customer = await upsertUser({
    email: 'sim.customer@local.test',
    name: 'Simulator Customer',
    role: 'customer',
  });

  await prisma.artisanProfile.upsert({
    where: { userId: artisan.id },
    update: {
      status: 'approved',
      businessName: 'MOE Simulator Studio',
      brandName: 'MOE Simulator Studio',
      description: 'Dedicated local test artisan. No real orders or payouts.',
      about: 'Dedicated local test artisan. No real orders or payouts.',
      category: 'tailoring',
      serviceCategories: ['tailoring'],
      city: 'Lagos Test',
      state: 'Lagos',
      country: 'Nigeria',
    },
    create: {
      userId: artisan.id,
      status: 'approved',
      businessName: 'MOE Simulator Studio',
      brandName: 'MOE Simulator Studio',
      description: 'Dedicated local test artisan. No real orders or payouts.',
      about: 'Dedicated local test artisan. No real orders or payouts.',
      category: 'tailoring',
      serviceCategories: ['tailoring'],
      city: 'Lagos Test',
      state: 'Lagos',
      country: 'Nigeria',
    },
  });

  const existingProducts = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "Product"
    WHERE "name" = 'MOE Simulator Test Garment' AND "providerId" = ${artisan.id}
    LIMIT 1
  `;
  let product = existingProducts[0];
  if (product) {
    await prisma.$executeRaw`
      UPDATE "Product"
      SET "description" = 'Dedicated test-only garment for simulated lifecycle verification.',
          "category" = 'tailoring', "price" = 45000, "originalPrice" = 45000,
          "currency" = 'NGN', "images" = ARRAY[]::TEXT[], "status" = 'approved',
          "deletedAt" = NULL, "estimatedDelivery" = '2 test days',
          "estimatedDeliveryDays" = 2, "updatedAt" = NOW()
      WHERE "id" = ${product.id}
    `;
  } else {
    const inserted = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "Product" (
        "name", "description", "category", "price", "originalPrice", "currency",
        "images", "providerId", "artisanId", "status", "estimatedDelivery",
        "estimatedDeliveryDays", "createdAt", "updatedAt"
      ) VALUES (
        'MOE Simulator Test Garment',
        'Dedicated test-only garment for simulated lifecycle verification.',
        'tailoring', 45000, 45000, 'NGN', ARRAY[]::TEXT[], ${artisan.id}, ${artisan.id},
        'approved', '2 test days', 2, NOW(), NOW()
      ) RETURNING "id"
    `;
    product = inserted[0];
  }
  if (!product) throw new Error('Could not create simulator product');

  const lines = [
    '# Generated local-only simulator credentials. Do not commit.',
    'APP_ENV=test',
    'NODE_ENV=test',
    'TEST_ORDER_SIMULATION_ENABLED=true',
    'TEST_ORDER_SIMULATION_DATABASE_NAMES=moe_dev',
    `TEST_ORDER_SIMULATION_ADMIN_IDS=${admin.id},${recorder.id},${verifier.id}`,
    'PAYMENT_MODE=test',
    'PAYMENT_LIVE_ENABLED=false',
    `INITIAL_PAYOUT_LIMITS_JSON='{"NGN":{"maxAbsolute":50000}}'`,
    'ORDER_SCHEDULERS_ENABLED=false',
    'CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080',
    'FRONTEND_URL=http://127.0.0.1:8080',
    `SIM_ADMIN_ID=${admin.id}`,
    `SIM_ADMIN_EMAIL=${admin.email}`,
    `SIM_ADMIN_PASSWORD=${password}`,
    `SIM_RECORDER_ID=${recorder.id}`,
    `SIM_RECORDER_EMAIL=${recorder.email}`,
    `SIM_RECORDER_PASSWORD=${password}`,
    `SIM_VERIFIER_ID=${verifier.id}`,
    `SIM_VERIFIER_EMAIL=${verifier.email}`,
    `SIM_VERIFIER_PASSWORD=${password}`,
    `SIM_ARTISAN_ID=${artisan.id}`,
    `SIM_ARTISAN_EMAIL=${artisan.email}`,
    `SIM_ARTISAN_PASSWORD=${password}`,
    `SIM_CUSTOMER_ID=${customer.id}`,
    `SIM_CUSTOMER_EMAIL=${customer.email}`,
    `SIM_CUSTOMER_PASSWORD=${password}`,
    `SIM_PRODUCT_ID=${product.id}`,
  ];
  writeFileSync(resolve('.env.simulator.local'), `${lines.join('\n')}\n`, {
    mode: 0o600,
  });

  process.stdout.write(
    JSON.stringify({
      adminId: admin.id,
      recorderId: recorder.id,
      verifierId: verifier.id,
      artisanId: artisan.id,
      customerId: customer.id,
      productId: product.id,
      config: resolve('.env.simulator.local'),
    }),
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
