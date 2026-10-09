import { BadRequestException } from '@nestjs/common';
import * as multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { randomUUID } from 'crypto';
import { ensureCloudinaryConfigured } from './cloudinary';

/**
 * Defers Cloudinary SDK + storage construction until the first upload, so the
 * Nest app can boot even before CLOUDINARY_API_SECRET is set locally.
 */
class LazyCloudinaryStorage implements multer.StorageEngine {
  private inner: CloudinaryStorage | null = null;

  constructor(private readonly subfolder: string) {}

  private getInner(): CloudinaryStorage {
    if (this.inner) return this.inner;
    const cloudinary = ensureCloudinaryConfigured();
    this.inner = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `moe/${this.subfolder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
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
  return {
    storage: new LazyCloudinaryStorage(subfolder),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed =
        subfolder === 'verification'
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
            'Only JPEG, PNG, and WebP images are allowed',
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
