import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PrismaService } from '../database/prisma.service';

type DocRow = {
  id: number;
  artisanId: number;
  fileType: string;
  fileUrl: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

  private toDto(row: DocRow) {
    const fileUrl = row.fileUrl;
    const isPdf = isPdfUrl(fileUrl) || /pdf/i.test(row.fileType);
    return {
      id: row.id,
      artisanId: row.artisanId,
      fileType: row.fileType,
      type: row.fileType,
      /** Canonical URL for open/download */
      fileUrl,
      /** Alias used by some admin UIs */
      url: fileUrl,
      documentUrl: fileUrl,
      /** Image-friendly preview (Cloudinary PDF → first page JPEG when possible) */
      previewUrl: buildPreviewUrl(fileUrl),
      mimeType: isPdf ? 'application/pdf' : guessImageMime(fileUrl),
      isPdf,
      status: row.status,
      notes: row.notes,
      adminNotes: row.notes,
      createdAt: row.createdAt.toISOString(),
      uploadedAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
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

    return this.toDto(row);
  }

  async listMine(user: AccessTokenPayload) {
    const artisanId = this.requireArtisan(user);
    const rows = await this.prisma.artisanVerificationDocument.findMany({
      where: { artisanId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
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

    const data = rows.map((row) => this.toDto(row));
    // Support both `{ data: [...] }` and raw-array consumers.
    return { data, documents: data };
  }

  async patchDocumentStatus(
    artisanId: number,
    docId: number,
    body: {
      status?: string;
      action?: string;
      notes?: string;
      adminNotes?: string;
      reason?: string;
    },
  ) {
    const doc = await this.prisma.artisanVerificationDocument.findFirst({
      where: { id: docId, artisanId },
    });
    if (!doc) {
      throw new NotFoundException({
        message: 'Document not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const status = normalizeDocumentStatus(body.status ?? body.action);
    if (body.status != null || body.action != null) {
      if (!status) {
        throw new BadRequestException({
          message:
            'Invalid status. Use approved/rejected (or accept/reject).',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const notesRaw =
      body.notes !== undefined
        ? body.notes
        : body.adminNotes !== undefined
          ? body.adminNotes
          : body.reason !== undefined
            ? body.reason
            : undefined;

    if (status == null && notesRaw === undefined) {
      throw new BadRequestException({
        message: 'Provide status (or action) and/or notes',
        code: 'VALIDATION_ERROR',
      });
    }

    const updated = await this.prisma.artisanVerificationDocument.update({
      where: { id: docId },
      data: {
        ...(status ? { status } : {}),
        ...(notesRaw !== undefined
          ? { notes: String(notesRaw).trim() || null }
          : {}),
      },
    });

    return this.toDto(updated);
  }
}

function normalizeDocumentStatus(
  raw?: string | null,
): 'pending' | 'approved' | 'rejected' | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (['approved', 'approve', 'accept', 'accepted', 'ok'].includes(s)) {
    return 'approved';
  }
  if (['rejected', 'reject', 'declined', 'decline', 'denied'].includes(s)) {
    return 'rejected';
  }
  if (s === 'pending') return 'pending';
  return null;
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url) || /\/raw\/upload\//i.test(url);
}

function guessImageMime(url: string): string {
  if (/\.png(\?|#|$)/i.test(url)) return 'image/png';
  if (/\.webp(\?|#|$)/i.test(url)) return 'image/webp';
  return 'image/jpeg';
}

/**
 * For Cloudinary PDFs stored as raw, build a first-page image preview URL
 * so admin <img> tags can render something. Falls back to the original URL.
 */
function buildPreviewUrl(fileUrl: string): string {
  if (!fileUrl) return fileUrl;
  if (!/res\.cloudinary\.com/i.test(fileUrl)) return fileUrl;
  if (!isPdfUrl(fileUrl)) return fileUrl;

  // raw/upload/... → image/upload/pg_1,f_jpg,q_auto/...
  if (/\/raw\/upload\//i.test(fileUrl)) {
    return fileUrl.replace(
      /\/raw\/upload\//i,
      '/image/upload/pg_1,f_jpg,q_auto/',
    );
  }
  // already image/upload — insert page transform after /upload/
  if (/\/image\/upload\//i.test(fileUrl) && !/\/pg_1[,/]/.test(fileUrl)) {
    return fileUrl.replace(
      /\/image\/upload\//i,
      '/image/upload/pg_1,f_jpg,q_auto/',
    );
  }
  return fileUrl;
}
