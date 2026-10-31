import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { isGoogleOAuthConfigured } from '../strategies/google.strategy';

/** Sign-in page to use when Google credentials are not configured. */
export function googleUnavailableRedirect(config: ConfigService): string {
  const success =
    config.get<string>('GOOGLE_SUCCESS_REDIRECT')?.trim() ||
    'http://localhost:8080/auth/callback';
  let origin = 'http://localhost:8080';
  try {
    origin = new URL(success).origin;
  } catch {
    /* keep the local default */
  }
  return `${origin}/auth?error=google_unavailable`;
}

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  /**
   * Missing credentials must not start Passport. Returning false here makes Nest
   * send a second 403 after the controller redirect.
   * The controller sends the single unavailable redirect instead.
   */
  canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured(this.config)) {
      return true;
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url || '';
    if (path.includes('callback')) return { session: false };
    const state = typeof req.query?.state === 'string' ? req.query.state : undefined;
    return state ? { state, session: false } : { session: false };
  }
}
