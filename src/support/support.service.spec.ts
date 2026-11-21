import { ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { SupportService } from './support.service';

const artisan: AccessTokenPayload = {
  sub: 9,
  email: 'artisan@example.test',
  role: 'artisan',
};

describe('SupportService order complaints', () => {
  it('requires the authenticated artisan to own the order', async () => {
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue({ id: 12, providerId: 99 }) },
    };
    const service = new SupportService(prisma as never);

    await expect(
      service.createOrderComplaint(artisan, {
        orderId: 12,
        category: 'production',
        description: 'The approved material is unavailable.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists the order reference, history and private attachment metadata', async () => {
    const createdAt = new Date('2026-11-21T12:00:00.000Z');
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 70,
        orderId: data.orderId,
        category: data.category,
        subject: data.subject,
        message: data.message,
        status: data.status,
        createdAt,
        updatedAt: createdAt,
        attachments: [
          {
            id: 81,
            attachmentName: 'evidence.jpg',
            attachmentMimeType: 'image/jpeg',
            attachmentBytes: 100,
            attachmentKind: 'image',
            durationMs: null,
          },
        ],
        events: [{ id: 91, status: 'open', note: 'Complaint submitted', createdAt }],
      }),
    );
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue({ id: 12, providerId: 9 }) },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          name: 'Ayo Artisan',
          email: 'artisan@example.test',
        }),
      },
      contactMessage: { create },
    };
    const service = new SupportService(prisma as never);
    const file = {
      originalname: 'evidence.jpg',
      mimetype: 'image/jpeg',
      size: 100,
      filename: 'support/evidence',
      path: 'support/evidence',
    } as Express.Multer.File;

    const result = await service.createOrderComplaint(
      artisan,
      {
        orderId: 12,
        category: 'production',
        description: 'The approved material is unavailable.',
      },
      [file],
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 12,
          submittedById: 9,
          source: 'order_complaint',
          attachments: { create: [expect.objectContaining({ attachmentName: 'evidence.jpg' })] },
          events: { create: expect.objectContaining({ status: 'open' }) },
        }),
      }),
    );
    expect(result.attachments[0].url).toBe(
      '/support/tickets/order-complaints/70/attachments/81',
    );
    expect(result.history).toEqual([
      expect.objectContaining({ status: 'open', note: 'Complaint submitted' }),
    ]);
  });
});
