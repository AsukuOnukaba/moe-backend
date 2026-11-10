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

/** Short-lived signed URL for authenticated message attachments. */
export function signedAuthenticatedUrl(
  publicId: string,
  resourceType: string,
  expiresInSeconds = 120,
): string {
  const client = ensureCloudinaryConfigured();
  const expires_at = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return client.url(publicId, {
    type: 'authenticated',
    resource_type: resourceType || 'image',
    sign_url: true,
    secure: true,
    expires_at,
  });
}

export function isCloudinaryConfigured(): boolean {
  loadDotenv();
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export { cloudinary };
