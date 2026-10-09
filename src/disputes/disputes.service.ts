import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';

const DISPUTE_STATUSES = new Set([
  'open',
  'under_review',
  'resolved',
  'closed',
]);

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCustomer(user: AccessTokenPayload) {
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }
  }

  private toResponse(row: {
    id: string;
    orderId: number;
    customerId: number;
    issueType: string;
    description: string;
    evidenceUrls: string[];
    status: string;
    resolution: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      orderId: row.orderId,
      customerId: row.customerId,
      issueType: row.issueType,
      description: row.description,
      evidenceUrls: row.evidenceUrls,
      status: row.status,
      resolution: row.resolution,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(user: AccessTokenPayload, dto: CreateDisputeDto) {
    this.requireCustomer(user);

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, customerId: true },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (order.customerId !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    const row = await this.prisma.dispute.create({
      data: {
        orderId: dto.orderId,
        customerId: user.sub,
        issueType: dto.issueType.trim(),
        description: dto.description.trim(),
        evidenceUrls: dto.evidenceUrls ?? [],
      },
    });

    return this.toResponse(row);
  }

  async listForAdmin(query: {
    page?: string;
    pageSize?: string;
    status?: string;
  }) {
    const page = Math.max(
      1,
      Number.isFinite(Number(query?.page)) ? Number(query.page) : 1,
    );
    const pageSize = Math.max(
      1,
      Math.min(
        100,
        Number.isFinite(Number(query?.pageSize)) ? Number(query.pageSize) : 50,
      ),
    );
    const skip = (page - 1) * pageSize;

    const status =
      typeof query?.status === 'string' && DISPUTE_STATUSES.has(query.status)
        ? query.status
        : undefined;

    const where = status ? { status } : {};

    const [totalItems, rows] = await Promise.all([
      this.prisma.dispute.count({ where }),
      this.prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async patchForAdmin(id: string, dto: UpdateDisputeDto) {
    const existing = await this.prisma.dispute.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        message: 'Dispute not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (dto.status === undefined && dto.resolution === undefined) {
      throw new BadRequestException({
        message: 'At least one of status or resolution is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const row = await this.prisma.dispute.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.resolution !== undefined
          ? { resolution: dto.resolution.trim() }
          : {}),
      },
    });

    return this.toResponse(row);
  }
}
