import {
  BadRequestException,
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
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

function authError(message: string, code: ErrorCode): UnauthorizedException {
  return new UnauthorizedException({ message, code });
}

function nowPlusMs(ms: number) {
  return new Date(Date.now() + ms);
}

function parseExpiresInToMs(expiresIn: string): number {
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
    if (names.includes('artisan')) return 'artisan';
    return 'customer';
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'customer' | 'artisan';
    serviceCategories?: string[];
  }) {
    const role: MoeRole = (input.role ?? 'customer') as MoeRole;
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

    await this.ensureUserRole(user.id, role);
    if (role === 'artisan') {
      const serviceCategories =
        input.serviceCategories && input.serviceCategories.length > 0
          ? input.serviceCategories.join(',')
          : null;
      await this.prisma.artisanProfile.create({
        data: {
          userId: user.id,
          brandName: input.name,
          heroImage: null,
          serviceCategories,
          status: 'pending',
        },
      });
    }

    const tokens = await this.issueTokens(user, role);
    return {
      ...tokens,
      user: await this.toProfile(user, role),
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
      user: await this.toProfile(user, role),
    };
  }

  async handleGoogleLogin(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: profile.googleId }, { email: profile.email }],
      },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(randomUUID(), 12);
      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          passwordHash,
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
        },
      });
      await this.ensureUserRole(user.id, 'customer');
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          avatarUrl: user.avatarUrl ?? profile.avatarUrl,
        },
      });
    }

    const role = await this.resolvePrimaryRole(user.id);
    const tokens = await this.issueTokens(user, role);
    return { ...tokens, user: await this.toProfile(user, role) };
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
    const role = await this.resolvePrimaryRole(userId);
    const artisanProfile =
      role === 'artisan' ? await this.prisma.artisanProfile.findUnique({ where: { userId } }) : null;
    return this.toProfile(user, role, artisanProfile);
  }

  async patchProfile(
    userId: number,
    input: {
      name?: string;
      email?: string;
      phone?: string | null;
      artisanProfile?: {
        brandName?: string;
        about?: string | null;
        city?: string | null;
        state?: string | null;
        category?: string | null;
        styleTags?: string | string[] | null;
        serviceCategories?: string | string[] | null;
      };
    },
  ) {
    const role = await this.resolvePrimaryRole(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });

    let artisanProfile: any = null;
    if (role === 'artisan' && input.artisanProfile) {
      const normalizeCommaList = (value: string | string[] | null | undefined) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        return Array.isArray(value) ? value.join(',') : value;
      };

      artisanProfile = await this.prisma.artisanProfile.upsert({
        where: { userId },
        create: {
          userId,
          brandName: input.artisanProfile.brandName ?? user.name,
          heroImage: null,
        },
        update: {
          ...(input.artisanProfile.brandName !== undefined
            ? { brandName: input.artisanProfile.brandName }
            : {}),
          ...(input.artisanProfile.about !== undefined ? { about: input.artisanProfile.about } : {}),
          ...(input.artisanProfile.city !== undefined ? { city: input.artisanProfile.city } : {}),
          ...(input.artisanProfile.state !== undefined ? { state: input.artisanProfile.state } : {}),
          ...(input.artisanProfile.category !== undefined
            ? { category: input.artisanProfile.category }
            : {}),
          ...(input.artisanProfile.styleTags !== undefined
            ? { styleTags: normalizeCommaList(input.artisanProfile.styleTags) }
            : {}),
          ...(input.artisanProfile.serviceCategories !== undefined
            ? { serviceCategories: normalizeCommaList(input.artisanProfile.serviceCategories) }
            : {}),
        },
      });
    }

    return this.toProfile(user, role, artisanProfile);
  }

  async setAvatar(userId: number, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    const role = await this.resolvePrimaryRole(userId);
    if (role === 'artisan') {
      await this.prisma.artisanProfile.update({
        where: { userId },
        data: { heroImage: avatarUrl },
      });
    }

    const artisanProfile =
      role === 'artisan' ? await this.prisma.artisanProfile.findUnique({ where: { userId } }) : null;
    return this.toProfile(user, role, artisanProfile);
  }

  private async toProfile(
    user: {
      id: number;
      name: string;
      email: string;
      phone: string | null;
      avatarUrl: string | null;
      createdAt: Date;
    },
    role: MoeRole,
    artisanProfile?: {
      brandName: string | null;
      heroImage: string | null;
      about: string | null;
      city: string | null;
      state: string | null;
      category: string | null;
      styleTags: string | null;
      serviceCategories: string | null;
      estimatedDeliveryDays: number;
      verified: boolean;
      featured: boolean;
      customOrdersEnabled: boolean;
      rating: number;
      reviewCount: number;
    } | null,
  ) {
    return {
      id: user.id,
      username: user.email.split('@')[0],
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role,
      ...(role === 'artisan'
        ? {
            artisanProfile: {
              brandName: artisanProfile?.brandName ?? user.name,
              about: artisanProfile?.about ?? null,
              city: artisanProfile?.city ?? null,
              state: artisanProfile?.state ?? null,
              category: artisanProfile?.category ?? null,
              styleTags: artisanProfile?.styleTags ? artisanProfile.styleTags.split(',') : [],
              serviceCategories: artisanProfile?.serviceCategories
                ? artisanProfile.serviceCategories.split(',')
                : [],
              heroImage: artisanProfile?.heroImage ?? user.avatarUrl ?? null,
              verified: artisanProfile?.verified ?? false,
              featured: artisanProfile?.featured ?? false,
              estimatedDeliveryDays: artisanProfile?.estimatedDeliveryDays ?? 7,
              customOrdersEnabled: artisanProfile?.customOrdersEnabled ?? false,
              rating: artisanProfile?.rating ?? 0,
              reviewCount: artisanProfile?.reviewCount ?? 0,
            },
          }
        : {}),
      preferences: null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: number, dto: UpdateUserProfileDto) {
    const data = Object.fromEntries(
      Object.entries(dto).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(data).length === 0) {
      return this.prisma.user.findUnique({ where: { id: userId } });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const { passwordHash: _, ...result } = user as any;
    return result;
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException({ message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    return { message: 'Password updated successfully' };
  }
}
