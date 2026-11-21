import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';
import { SectionsService } from '../sections/sections.service';

const TAG = `best-seller-${Date.now()}`;
const dbUrl = (
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public'
).replace('@localhost:', '@127.0.0.1:');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

describe('Best Sellers curation (PostgreSQL)', () => {
  jest.setTimeout(120_000);
  let artisanId = 0;
  let customerId = 0;
  let curatedId = 0;
  let salesId = 0;
  let cancelledOnlyId = 0;
  let ineligibleId = 0;
  let orderIds: number[] = [];
  let sections: SectionsService;
  let products: ProductsService;

  beforeAll(async () => {
    await prisma.$connect();
    const artisan = await prisma.user.create({
      data: {
        name: `${TAG} Artisan`,
        email: `${TAG}-artisan@local.test`,
        passwordHash: 'test-only',
        artisanProfile: {
          create: { businessName: `${TAG} Studio`, status: 'approved' },
        },
      },
    });
    const customer = await prisma.user.create({
      data: {
        name: `${TAG} Customer`,
        email: `${TAG}-customer@local.test`,
        passwordHash: 'test-only',
      },
    });
    artisanId = artisan.id;
    customerId = customer.id;
    const rows = await Promise.all([
      prisma.product.create({
        data: {
          name: `${TAG} Curated`,
          description: 'Zero sales curated product',
          price: 1000,
          images: [],
          providerId: artisanId,
          status: 'approved',
        },
      }),
      prisma.product.create({
        data: {
          name: `${TAG} Sales`,
          description: 'Genuine sales product',
          price: 2000,
          images: [],
          providerId: artisanId,
          status: 'approved',
        },
      }),
      prisma.product.create({
        data: {
          name: `${TAG} Cancelled`,
          description: 'Cancelled order only',
          price: 3000,
          images: [],
          providerId: artisanId,
          status: 'approved',
        },
      }),
      prisma.product.create({
        data: {
          name: `${TAG} Pending`,
          description: 'Ineligible pending product',
          price: 4000,
          images: [],
          providerId: artisanId,
          status: 'pending',
        },
      }),
    ]);
    [curatedId, salesId, cancelledOnlyId, ineligibleId] = rows.map(
      (row) => row.id,
    );
    const salesOrder = await prisma.order.create({
      data: {
        customerId,
        productId: salesId,
        providerId: artisanId,
        productName: rows[1].name,
        status: 'delivered',
        paymentStatus: 'paid',
      },
    });
    const cancelledOrder = await prisma.order.create({
      data: {
        customerId,
        productId: cancelledOnlyId,
        providerId: artisanId,
        productName: rows[2].name,
        status: 'cancelled',
        paymentStatus: 'unpaid',
      },
    });
    orderIds = [salesOrder.id, cancelledOrder.id];
    const prismaService = prisma as unknown as PrismaService;
    sections = new SectionsService(prismaService, {} as never);
    products = new ProductsService(prismaService, {} as never);
  });

  afterAll(async () => {
    const section = await prisma.curatedSection.findUnique({
      where: { sectionKey: 'best_sellers' },
    });
    if (section)
      await prisma.curatedItem.deleteMany({
        where: {
          sectionId: section.id,
          itemId: { in: [String(curatedId), String(ineligibleId)] },
        },
      });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({
      where: {
        id: { in: [curatedId, salesId, cancelledOnlyId, ineligibleId] },
      },
    });
    await prisma.artisanProfile.deleteMany({ where: { userId: artisanId } });
    await prisma.user.deleteMany({
      where: { id: { in: [artisanId, customerId] } },
    });
    await prisma.$disconnect();
  });

  it('persists an eligible zero-sale pin across homepage and full collection, then removes it without disturbing sales ranking', async () => {
    await sections.addItem(
      'best_sellers',
      { itemType: 'product', itemId: String(curatedId), position: -100000 },
      1,
    );

    const admin = await sections.getAdminSection('best_sellers');
    expect(admin.items.some((item) => item.itemId === String(curatedId))).toBe(
      true,
    );
    const shelf = await sections.getPublicSection('best_sellers');
    expect(
      shelf.items.some(
        (item) => item.id === curatedId && item.selection === 'curated',
      ),
    ).toBe(true);

    const full = await products.listProducts({
      collection: 'best-sellers',
      pageSize: 100,
    });
    expect(
      full.data.some((item) => item.id === curatedId && item.orderCount === 0),
    ).toBe(true);
    expect(
      full.data.some((item) => item.id === salesId && item.orderCount === 1),
    ).toBe(true);
    expect(full.data.some((item) => item.id === cancelledOnlyId)).toBe(false);

    const sorted = await products.listProducts({
      collection: 'best-sellers',
      sort: 'price_desc',
      pageSize: 100,
    });
    const fixtureIds = sorted.data
      .filter((item) => [curatedId, salesId].includes(item.id))
      .map((item) => item.id);
    expect(fixtureIds).toEqual([salesId, curatedId]);

    await sections.removeItem('best_sellers', String(curatedId), 1);
    const afterShelf = await sections.getPublicSection('best_sellers');
    const afterFull = await products.listProducts({
      collection: 'best-sellers',
      pageSize: 100,
    });
    expect(afterShelf.items.some((item) => item.id === curatedId)).toBe(false);
    expect(afterFull.data.some((item) => item.id === curatedId)).toBe(false);
    expect(afterFull.data.some((item) => item.id === salesId)).toBe(true);
  });

  it('explains an ineligible curated product to Admin and keeps it out of public reads', async () => {
    await sections.addItem(
      'best_sellers',
      { itemType: 'product', itemId: String(ineligibleId), position: -99999 },
      1,
    );
    const admin = await sections.getAdminSection('best_sellers');
    const item = admin.items.find((row) => row.itemId === String(ineligibleId));
    expect(item?.preview).toMatchObject({
      publicEligible: false,
      publicIneligibleReason: expect.stringContaining('only approved products'),
    });
    const shelf = await sections.getPublicSection('best_sellers');
    const full = await products.listProducts({
      collection: 'best-sellers',
      pageSize: 100,
    });
    expect(shelf.items.some((row) => row.id === ineligibleId)).toBe(false);
    expect(full.data.some((row) => row.id === ineligibleId)).toBe(false);
  });
});
