import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Attaches `req.user` when a valid Bearer token is present; otherwise continues anonymously. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const ok = await super.canActivate(context);
      return Boolean(ok);
    } catch {
      return true;
    }
  }

  handleRequest<TUser>(_err: Error | null, user: TUser): TUser {
    return (user ?? null) as TUser;
  }
}
