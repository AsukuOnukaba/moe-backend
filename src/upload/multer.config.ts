import { BadRequestException } from '@nestjs/common';
import * as multer from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';

export function createMulterOptions(subfolder: string): multer.Options {
  return {
    storage: multer.diskStorage({
      destination: path.join(process.cwd(), 'uploads', subfolder),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
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
