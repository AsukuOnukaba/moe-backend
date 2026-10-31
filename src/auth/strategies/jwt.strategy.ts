import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import type { AccessTokenPayload } from '../types/jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException({
        message: 'Unauthorized',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { emailVerified: true },
    });
    if (user?.emailVerified === false) {
      throw new ForbiddenException({
        message: 'Verify your email before continuing.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    return payload;
  }
}

