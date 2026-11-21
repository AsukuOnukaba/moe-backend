import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';
import { AdminService } from '../admin/admin.service';

const TAG = `audience-${Date.now()}`;
const dbUrl = (
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public'
).replace('@localhost:', '@127.0.0.1:');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

describe('product audience discovery and admin review (PostgreSQL)', () => {
  jest.setTimeout(120_000);
  let artisanId = 0;
  let adminId = 0;
  const productIds: number[] = [];
  let products: ProductsService;
  let admin: AdminService;

  beforeAll(async () => {
    await prisma.$connect();
    const artisan = await prisma.user.create({
      data: {
        name: `${TAG} Artisan`,
        email: `${TAG}-artisan@local.test`,
        passwordHash: 'test-only',
        artisanProfile: { create: { businessName: `${TAG} Studio`, status: 'approved' } },
      },
    });
    const adminUser = await prisma.user.create({
      data: { name: `${TAG} Admin`, email: `${TAG}-admin@local.test`, passwordHash: 'test-only' },
    });
    artisanId = artisan.id;
    adminId = adminUser.id;

    const created = await Promise.all([
      prisma.product.create({ data: { name: `${TAG} Women's heels`, category: 'shoemaking', price: 20000, providerId: artisanId, status: 'approved', designedFor: ['women'], audienceClassificationStatus: 'classified' } }),
      prisma.product.create({ data: { name: `${TAG} Adult leather sandals`, category: 'shoemaking', price: 25000, providerId: artisanId, status: 'approved', designedFor: ['unisex'], audienceClassificationStatus: 'classified' } }),
      prisma.product.create({ data: { name: `${TAG} Men's traditional agbada`, category: 'tailoring', price: 50000, providerId: artisanId, status: 'approved', designedFor: ['men'], audienceClassificationStatus: 'classified' } }),
      prisma.product.create({ data: { name: `${TAG} Adult kaftan`, category: 'tailoring', price: 30000, providerId: artisanId, status: 'approved', designedFor: ['unisex'], audienceClassificationStatus: 'classified' } }),
      prisma.product.create({ data: { name: `${TAG} Girls clothes`, category: 'tailoring', price: 10000, providerId: artisanId, status: 'approved', designedFor: ['children'], audienceClassificationStatus: 'classified' } }),
      prisma.product.create({ data: { name: `${TAG} Ladies leather shoes`, description: 'Made for female customers', category: 'shoemaking', price: 15000, providerId: artisanId, status: 'approved' } }),
      prisma.product.create({ data: { name: `${TAG} Bespoke garment`, description: 'Hand finished', category: 'tailoring', price: 18000, providerId: artisanId, status: 'approved' } }),
      prisma.product.create({ data: { name: `${TAG} Dining table`, category: 'home_and_decor', price: 80000, providerId: artisanId, status: 'approved' } }),
    ]);
    productIds.push(...created.map((row) => row.id));
    products = new ProductsService(prisma as unknown as PrismaService, {} as never);
    admin = new AdminService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  afterAll(async () => {
    await prisma.adminAuditLog.deleteMany({ where: { targetType: 'product', targetId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.artisanProfile.deleteMany({ where: { userId: artisanId } });
    await prisma.user.deleteMany({ where: { id: { in: [artisanId, adminId] } } });
    await prisma.$disconnect();
  });

  it('combines structured search, audience, category, price and unisex rules', async () => {
    const women = await products.listProducts({ q: "women's shoes", pageSize: 100, sort: 'price_asc' });
    expect(women.data.map((row) => row.name)).toEqual([
      `${TAG} Women's heels`,
      `${TAG} Adult leather sandals`,
    ]);

    const children = await products.listProducts({ q: "children's clothes", pageSize: 100 });
    expect(children.data.map((row) => row.name)).toEqual([`${TAG} Girls clothes`]);

    const men = await products.listProducts({ audience: 'men', category: 'tailoring', minPrice: 25000, pageSize: 100 });
    expect(new Set(men.data.map((row) => row.name))).toEqual(
      new Set([`${TAG} Men's traditional agbada`, `${TAG} Adult kaftan`]),
    );

    const general = await products.listProducts({ q: `${TAG} Bespoke`, pageSize: 100 });
    expect(general.data).toHaveLength(1);
    expect(general.data[0].designedFor).toEqual([]);
  });

  it('suggests classifications, flags uncertainty, and requires admin approval', async () => {
    const review = await admin.listProducts(1, 100, undefined, { audienceStatus: 'needs_review', q: TAG });
    const suggested = review.data.find((row) => row.name.endsWith('Ladies leather shoes'));
    const uncertain = review.data.find((row) => row.name.endsWith('Bespoke garment'));
    expect(suggested).toMatchObject({ audienceSuggestion: ['women'], audienceClassificationStatus: 'suggested' });
    expect(uncertain).toMatchObject({ audienceSuggestion: [], audienceClassificationStatus: 'uncertain' });
    expect(review.data.some((row) => row.name.endsWith('Dining table'))).toBe(false);

    await admin.bulkUpdateProductAudience(
      [{ id: suggested!.id, designedFor: ['women', 'unisex'] }],
      adminId,
    );
    const approved = await prisma.product.findUniqueOrThrow({ where: { id: suggested!.id } });
    expect(approved).toMatchObject({
      designedFor: ['women', 'unisex'],
      audienceClassificationStatus: 'classified',
      audienceClassifiedById: adminId,
    });
  });

  it('requires classification on applicable admin creation and supports multiple audiences', async () => {
    await expect(
      admin.createProduct({ artisanId, name: `${TAG} Missing audience`, category: 'shoemaking' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PRODUCT_AUDIENCE_REQUIRED' }) });

    const created = await admin.createProduct({
      artisanId,
      name: `${TAG} Multi audience shoes`,
      category: 'shoemaking',
      designedFor: ['men', 'women'],
    });
    productIds.push(created.id);
    expect(created.designedFor).toEqual(['men', 'women']);
  });
});
