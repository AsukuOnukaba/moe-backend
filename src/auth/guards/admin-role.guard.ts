import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../types/jwt-payload';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AccessTokenPayload | undefined;
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException({ message: 'Access denied', code: 'FORBIDDEN' });
    }
    return true;
  }
}
