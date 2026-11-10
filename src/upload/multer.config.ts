import { BadRequestException } from '@nestjs/common';
import * as multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { randomUUID } from 'crypto';
import { ensureCloudinaryConfigured } from './cloudinary';

/**
 * Defers Cloudinary SDK + storage construction until the first upload, so the
 * Nest app can boot even before CLOUDINARY_API_SECRET is set locally.
 */
export const MESSAGE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MESSAGE_VOICE_MAX_BYTES = 10 * 1024 * 1024;
export const MESSAGE_VOICE_MIN_BYTES = 256;
export const MESSAGE_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;
/** Browser MediaRecorder outputs — Chrome/Firefox webm/ogg, Safari mp4/aac. */
export const MESSAGE_VOICE_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  // Some Chromium builds label audio-only webm as video/webm.
  'video/webm',
] as const;

type StorageMode = 'public' | 'authenticated';

class LazyCloudinaryStorage implements multer.StorageEngine {
  private inner: CloudinaryStorage | null = null;

  constructor(
    private readonly subfolder: string,
    private readonly mode: StorageMode = 'public',
  ) {}

  private getInner(): CloudinaryStorage {
    if (this.inner) return this.inner;
    const cloudinary = ensureCloudinaryConfigured();
    const isVerification = this.subfolder === 'verification';
    const isMessageAttachment = this.subfolder === 'message-attachments';
    this.inner = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `moe/${this.subfolder}`,
        ...(isMessageAttachment
          ? {}
          : {
              allowed_formats: isVerification
                ? ['jpg', 'jpeg', 'png', 'webp', 'pdf']
                : ['jpg', 'jpeg', 'png', 'webp'],
            }),
        // PDFs / docs / audio must not use the default image resource type.
        ...((isVerification || isMessageAttachment)
          ? { resource_type: 'auto' }
          : {}),
        ...(this.mode === 'authenticated' ? { type: 'authenticated' } : {}),
        // public_id must be a function per multer-storage-cloudinary
        public_id: () => randomUUID(),
      } as Record<string, unknown>,
    });
    return this.inner;
  }

  _handleFile(
    req: Parameters<CloudinaryStorage['_handleFile']>[0],
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    this.getInner()._handleFile(req, file, cb);
  }

  _removeFile(
    req: Parameters<CloudinaryStorage['_removeFile']>[0],
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ): void {
    this.getInner()._removeFile(req, file, cb);
  }
}

/**
 * Multer options that stream uploads straight to Cloudinary.
 * After upload, `file.path` is the HTTPS secure_url (store this in the DB).
 *
 * Folders: products | store | covers | avatars → Cloudinary `moe/<folder>`
 */
export function createMulterOptions(subfolder: string): multer.Options {
  const isVerification = subfolder === 'verification';
  return {
    storage: new LazyCloudinaryStorage(subfolder),
    // CAC / ID docs are often larger than product photos.
    limits: { fileSize: (isVerification ? 10 : 2) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = isVerification
        ? [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
          ]
        : ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            isVerification
              ? 'Only JPEG, PNG, WebP, and PDF files are allowed for verification'
              : 'Only JPEG, PNG, and WebP images are allowed',
          ),
        );
      }
      cb(null, true);
    },
  };
}

/** HTTPS URL returned by CloudinaryStorage (stored in the DB / sent to clients). */
export function cloudinaryUrl(file: Express.Multer.File): string {
  const url = file.path;
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new BadRequestException('Upload failed: no Cloudinary URL returned');
  }
  return url;
}

function normalizeMime(mimeType: string): string {
  return (mimeType || '').split(';')[0].trim().toLowerCase();
}

export function isMessageVoiceMime(mimeType: string): boolean {
  const base = normalizeMime(mimeType);
  return (MESSAGE_VOICE_MIME_TYPES as readonly string[]).some((allowed) => {
    const allowedBase = normalizeMime(allowed);
    return allowed === mimeType || allowedBase === base;
  });
}

export function isMessageFileMime(mimeType: string): boolean {
  const base = normalizeMime(mimeType);
  return (MESSAGE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    base as (typeof MESSAGE_ATTACHMENT_MIME_TYPES)[number],
  );
}

/** Authenticated Cloudinary uploads for private conversation attachments (files + voice). */
export function createMessageAttachmentMulterOptions(): multer.Options {
  return {
    storage: new LazyCloudinaryStorage('message-attachments', 'authenticated'),
    limits: { fileSize: MESSAGE_VOICE_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      if (isMessageVoiceMime(file.mimetype) || isMessageFileMime(file.mimetype)) {
        return cb(null, true);
      }
      return cb(
        new BadRequestException(
          'Unsupported file format. Allowed: JPEG, PNG, WebP, PDF, DOC, DOCX, TXT, or browser audio (webm/mp4/ogg/wav)',
        ),
      );
    },
  };
}

export function messageAttachmentKind(
  mimeType: string,
): 'image' | 'document' | 'voice' {
  if (isMessageVoiceMime(mimeType) || mimeType.startsWith('audio/')) {
    return 'voice';
  }
  return mimeType.startsWith('image/') ? 'image' : 'document';
}

/** Cloudinary public_id from a multer upload (folder/uuid). */
export function cloudinaryPublicId(file: Express.Multer.File): string {
  const fromFilename =
    typeof (file as Express.Multer.File & { filename?: string }).filename ===
    'string'
      ? (file as Express.Multer.File & { filename?: string }).filename
      : undefined;
  const fromPublicId =
    typeof (file as Express.Multer.File & { public_id?: string }).public_id ===
    'string'
      ? (file as Express.Multer.File & { public_id?: string }).public_id
      : undefined;
  const id = fromPublicId || fromFilename;
  if (!id) {
    throw new BadRequestException('Upload failed: missing Cloudinary public_id');
  }
  return id;
}

export function cloudinaryResourceType(
  file: Express.Multer.File,
  mimeType: string,
): string {
  const explicit = (file as Express.Multer.File & { resource_type?: string })
    .resource_type;
  if (typeof explicit === 'string' && explicit) return explicit;
  if (mimeType.startsWith('image/')) return 'image';
  if (isMessageVoiceMime(mimeType) || mimeType.startsWith('audio/')) {
    return 'video'; // Cloudinary stores audio under the video resource type
  }
  return 'raw';
}
