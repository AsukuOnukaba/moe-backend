import { config as loadDotenv } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

let configured = false;

/**
 * Configure the Cloudinary SDK once from env (lazy, safe to call repeatedly).
 * Loads `.env` here because multer options are built at controller-import time,
 * which is before Nest's ConfigModule runs.
 */
export function ensureCloudinaryConfigured() {
  if (configured) return cloudinary;

  loadDotenv();

  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    );
  }

  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
  return cloudinary;
}

export { cloudinary };
