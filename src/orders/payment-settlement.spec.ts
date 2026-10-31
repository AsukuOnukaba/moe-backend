import { OrdersService } from './orders.service';

describe('verified payment settlement', () => {
  function serviceWith(order: {
    id: number;
    customerId: number;
    status: string;
    paymentStatus: string;
    paymentReference: string | null;
    paymentMethod: string;
  }) {
    const updates: Record<string, unknown>[] = [];
    const prisma = {
      order: {
        findUnique: jest.fn(async () => ({ ...order })),
        updateMany: jest.fn(async ({ data, where }: { data: Record<string, unknown>; where: { paymentStatus?: { not?: string } } }) => {
          if (order.paymentStatus === 'paid' && where.paymentStatus?.not === 'paid') return { count: 0 };
          if (where.paymentStatus?.not === 'paid' && order.paymentStatus === 'paid') return { count: 0 };
          Object.assign(order, data);
          updates.push(data);
          prisma.order.findUnique.mockResolvedValue({ ...order });
          return { count: 1 };
        }),
      },
      orderStatusHistory: { create: jest.fn(async () => ({})) },
    };
    const notifications = { notifyOrderStatusChange: jest.fn(async () => undefined) };
    const orders = new OrdersService(prisma as never, notifications as never, {} as never);
    return { orders, updates, prisma, notifications, order };
  }

  it('confirms a pending order once and ignores a repeated paid webhook', async () => {
    const { orders, updates, order } = serviceWith({
      id: 9,
      customerId: 3,
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentReference: null,
      paymentMethod: 'paystack',
    });
    const input = {
      orderId: 9,
      customerId: 3,
      gateway: 'paystack' as const,
      reference: 'moe-ps-9-abc',
      outcome: 'paid' as const,
    };
    const first = await orders.applyVerifiedPayment(input);
    const second = await orders.applyVerifiedPayment(input);
    expect(first).toMatchObject({ paymentStatus: 'paid', orderStatus: 'confirmed', alreadyPaid: false });
    expect(second.alreadyPaid).toBe(true);
    expect(updates).toHaveLength(1);
    expect(order.paymentReference).toBe('moe-ps-9-abc');
  });

  it('does not let a customer patch mark an order paid', async () => {
    const order = {
      id: 9,
      customerId: 3,
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentReference: null,
      paymentMethod: 'paystack',
      productId: 1,
      productName: null,
      productImage: null,
      providerId: null,
      providerName: null,
      customizationId: null,
      isCustomOrder: false,
      price: 1000,
      basePrice: 1000,
      rushSurcharge: null,
      rushOrder: false,
      customisationData: null,
      currency: 'NGN',
      paymentMethodId: null,
      estimatedDelivery: null,
      shippingAddress: { firstName: 'Ada', lastName: 'L', phone: '1', address: 'a', addressLine1: 'a', city: 'c', state: 's', country: 'NG' },
      shippingFirstName: 'Ada',
      shippingLastName: 'L',
      shippingPhone: '1',
      shippingAddressLine1: 'a',
      shippingAddressLine2: null,
      shippingCity: 'c',
      shippingState: 's',
      shippingCountry: 'NG',
      shippingPostalCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      order: {
        findUnique: jest.fn(async () => order),
        update: jest.fn(),
      },
    };
    const orders = new OrdersService(prisma as never, { notifyOrderStatusChange: jest.fn() } as never, {} as never);
    const result = await orders.patch(
      { sub: 3, email: 'ada@example.com', role: 'customer' },
      '9',
      { paymentStatus: 'paid', paymentReference: 'forged', status: undefined },
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(result?.paymentStatus).toBe('unpaid');
  });
});
