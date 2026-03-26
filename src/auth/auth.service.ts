import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload, MoeRole, RefreshTokenPayload } from './types/jwt-payload';
import type { ErrorCode } from '../common/errors/error-codes';

function authError(message: string, code: ErrorCode): UnauthorizedException {
  return new UnauthorizedException({ message, code });
}

function nowPlusMs(ms: number) {
  return new Date(Date.now() + ms);
}

function parseExpiresInToMs(expiresIn: string): number {
  // Supports "20m", "15m", "30d", "7d", "3600s"
  const m = /^(\d+)\s*([smhd])$/.exec(expiresIn.trim());
  if (!m) throw new Error(`Invalid expires format: ${expiresIn}`);
  const n = Number(m[1]);
  const unit = m[2];
  const mult =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60_000
        : unit === 'h'
          ? 3_600_000
          : 86_400_000;
  return n * mult;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private accessExpiresIn(): string {
    return this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '20m');
  }

  private refreshExpiresIn(): string {
    return this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
  }

  private accessSecret(): string {
    const v = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!v) throw new Error('JWT_ACCESS_SECRET is required');
    return v;
  }

  private refreshSecret(): string {
    const v = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!v) throw new Error('JWT_REFRESH_SECRET is required');
    return v;
  }

  private async ensureRoleExists(name: MoeRole) {
    await this.prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  private async ensureUserRole(userId: number, role: MoeRole) {
    await this.ensureRoleExists(role);
    const r = await this.prisma.role.findUnique({ where: { name: role } });
    if (!r) throw new Error('Role upsert failed');
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: r.id } },
      update: {},
      create: { userId, roleId: r.id },
    });
  }

  private async issueTokens(user: { id: number; email: string }, role: MoeRole) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role,
    };

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.accessSecret(),
      expiresIn: this.accessExpiresIn() as any,
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.refreshSecret(),
      expiresIn: this.refreshExpiresIn() as any,
    });

    const refreshTtlMs = parseExpiresInToMs(this.refreshExpiresIn());
    await this.prisma.refreshToken.create({
      data: {
        jti,
        userId: user.id,
        expiresAt: nowPlusMs(refreshTtlMs),
      },
    });

    return { token: accessToken, refreshToken };
  }

  private async resolvePrimaryRole(userId: number): Promise<MoeRole> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const names = roles.map((r) => r.role.name);
    if (names.includes('admin')) return 'admin';
    if (names.includes('provider')) return 'provider';
    return 'customer';
  }

  async register(input: { name: string; email: string; password: string; phone?: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Email already in use',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
        errors: { email: ['Email already in use'] },
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        phone: input.phone ?? null,
      },
    });

    await this.ensureUserRole(user.id, 'customer');
    const role = await this.resolvePrimaryRole(user.id);
    const tokens = await this.issueTokens(user, role);

    return {
      ...tokens,
      user: this.toCustomerProfile(user),
    };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user) {
      throw authError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw authError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
    }

    const role = await this.resolvePrimaryRole(user.id);
    const tokens = await this.issueTokens(user, role);
    return {
      ...tokens,
      user: this.toCustomerProfile(user),
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw authError('Refresh token invalid or expired', 'AUTH_REFRESH_FAILED');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw authError('Refresh token invalid or expired', 'AUTH_REFRESH_FAILED');
    }

    // Rotate: revoke old token record and issue a new refresh token
    await this.prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw authError('Refresh failed', 'AUTH_REFRESH_FAILED');

    const role = await this.resolvePrimaryRole(user.id);
    const tokens = await this.issueTokens(user, role);
    return tokens;
  }

  async logoutAll(userId: number) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ message: 'Unauthorized', code: 'AUTH_TOKEN_EXPIRED' });
    }
    return this.toCustomerProfile(user);
  }

  private toCustomerProfile(user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      username: user.email.split('@')[0],
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      preferences: null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

