import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

/** True only when both Google OAuth credentials are present. Never treats a placeholder as valid. */
export function isGoogleOAuthConfigured(config: ConfigService): boolean {
  const clientId = config.get<string>('GOOGLE_CLIENT_ID')?.trim();
  const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) return false;
  if (clientId === 'disabled' || clientSecret === 'disabled') return false;
  return true;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID')?.trim() || 'disabled';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || 'disabled';
    const callbackURL =
      config.get<string>('GOOGLE_CALLBACK_URL')?.trim() ||
      'http://localhost:3000/auth/google/callback';
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
    const logger = new Logger(GoogleStrategy.name);
    if (!isGoogleOAuthConfigured(config)) {
      logger.warn(
        'Google sign-in is disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. ' +
          'Requests are not sent to Google until both are set.',
      );
    } else if (
      process.env.NODE_ENV === 'production' &&
      /localhost|127\.0\.0\.1/.test(callbackURL)
    ) {
      logger.warn(
        'GOOGLE_CALLBACK_URL points at localhost while NODE_ENV is production. ' +
          'Google will reject the callback until it matches the registered redirect URI.',
      );
    }
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account has no email'), false);
      return;
    }
    const raw = (profile._json ?? {}) as { email_verified?: boolean | string };
    const emailVerified = raw.email_verified === true || raw.email_verified === 'true';
    done(null, {
      googleId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value ?? null,
      emailVerified,
    });
  }
}
