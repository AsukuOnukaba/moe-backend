import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url || '';
    if (path.includes('callback')) return { session: false };
    const state = typeof req.query?.state === 'string' ? req.query.state : undefined;
    return state ? { state, session: false } : { session: false };
  }
}
