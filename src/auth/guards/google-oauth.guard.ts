import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { isGoogleOAuthConfigured } from '../strategies/google.strategy';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured(this.config)) {
      const res = context.switchToHttp().getResponse<Response>();
      const success =
        this.config.get<string>('GOOGLE_SUCCESS_REDIRECT')?.trim() ||
        'http://localhost:8080/auth/callback';
      let origin = 'http://localhost:8080';
      try {
        origin = new URL(success).origin;
      } catch {
        /* keep the local default */
      }
      res.redirect(`${origin}/auth?error=google_unavailable`);
      return false;
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
