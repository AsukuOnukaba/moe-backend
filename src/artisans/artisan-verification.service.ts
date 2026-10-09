import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ArtisanVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  private requireArtisan(user: AccessTokenPayload) {
    if (!user || user.role !== 'artisan') {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return user.sub;
  }

  async uploadDocument(
    user: AccessTokenPayload,
    fileType: string,
    fileUrl: string,
  ) {
    const artisanId = this.requireArtisan(user);
    const type = fileType?.trim();
    if (!type) {
      throw new BadRequestException({
        message: 'fileType is required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (!fileUrl?.trim()) {
      throw new BadRequestException({
        message: 'file is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const row = await this.prisma.artisanVerificationDocument.create({
      data: {
        artisanId,
        fileType: type,
        fileUrl: fileUrl.trim(),
        status: 'pending',
      },
    });

    return {
      id: row.id,
      artisanId: row.artisanId,
      fileType: row.fileType,
      fileUrl: row.fileUrl,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listMine(user: AccessTokenPayload) {
    const artisanId = this.requireArtisan(user);
    const rows = await this.prisma.artisanVerificationDocument.findMany({
      where: { artisanId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      artisanId: row.artisanId,
      fileType: row.fileType,
      type: row.fileType,
      fileUrl: row.fileUrl,
      status: row.status,
      notes: row.notes,
      adminNotes: row.notes,
      createdAt: row.createdAt.toISOString(),
      uploadedAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listForAdmin(artisanId: number) {
    const profile = await this.prisma.artisanProfile.findUnique({
      where: { userId: artisanId },
    });
    if (!profile || profile.status === 'deleted') {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const rows = await this.prisma.artisanVerificationDocument.findMany({
      where: { artisanId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        artisanId: row.artisanId,
        fileType: row.fileType,
        fileUrl: row.fileUrl,
        status: row.status,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async patchDocumentStatus(
    artisanId: number,
    docId: number,
    body: { status?: string; notes?: string },
  ) {
    const doc = await this.prisma.artisanVerificationDocument.findFirst({
      where: { id: docId, artisanId },
    });
    if (!doc) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const status = body.status?.trim();
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      throw new BadRequestException({
        message: 'Invalid status',
        code: 'VALIDATION_ERROR',
      });
    }

    const updated = await this.prisma.artisanVerificationDocument.update({
      where: { id: docId },
      data: {
        ...(status ? { status } : {}),
        ...(body.notes !== undefined
          ? { notes: body.notes.trim() || null }
          : {}),
      },
    });

    return {
      id: updated.id,
      artisanId: updated.artisanId,
      fileType: updated.fileType,
      fileUrl: updated.fileUrl,
      status: updated.status,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
