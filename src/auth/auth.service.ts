import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import type {
  AccessTokenPayload,
  MoeRole,
  RefreshTokenPayload,
} from './types/jwt-payload';
import type { ErrorCode } from '../common/errors/error-codes';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import {
  clerkSignupAcceptedTerms,
  CONSENT_REQUIRED,
  consumeOAuthConsentTicket,
} from './oauth-consent';
import { ChangePasswordDto } from './dto/change-password.dto';

function authError(message: string, code: ErrorCode): UnauthorizedException {
  return new UnauthorizedException({ message, code });
}

/** Failed-login lockout: 5 consecutive failures → 5-minute lock (in-memory, per email). */
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;
const GENERIC_VERIFICATION_MESSAGE =
  'If an unverified account exists for that email, a verification link has been sent.';
type LoginFailureState = { count: number; lockedUntil: number | null };
const loginFailures = new Map<string, LoginFailureState>();

function loginAttemptKey(email: string): string {
  return email.trim().toLowerCase();
}

function throwLoginLockout(lockedUntil: number): never {
  const mins = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60_000));
  throw new HttpException(
    {
      message: `Too many failed attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      code: 'RATE_LIMIT_EXCEEDED',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function assertLoginNotLocked(email: string): void {
  const state = loginFailures.get(loginAttemptKey(email));
  if (state?.lockedUntil && state.lockedUntil > Date.now()) {
    throwLoginLockout(state.lockedUntil);
  }
}

function recordFailedLogin(email: string): void {
  const key = loginAttemptKey(email);
  const prev = loginFailures.get(key) ?? { count: 0, lockedUntil: null };
  if (prev.lockedUntil && prev.lockedUntil > Date.now()) {
    throwLoginLockout(prev.lockedUntil);
  }
  // Prior lockout expired — start a fresh failure window.
  if (prev.lockedUntil && prev.lockedUntil <= Date.now()) {
    prev.count = 0;
    prev.lockedUntil = null;
  }
  prev.count += 1;
  // After 5 failures, subsequent attempts are locked (this attempt still returns invalid credentials).
  if (prev.count >= MAX_FAILED_LOGINS) {
    prev.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  loginFailures.set(key, prev);
}

function clearFailedLogins(email: string): void {
  loginFailures.delete(loginAttemptKey(email));
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private frontendOrigin(): string {
    const raw = this.config.get<string>('FRONTEND_URL')?.trim() || 'http://localhost:8080';
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'http://localhost:8080';
      return url.origin;
    } catch {
      return 'http://localhost:8080';
    }
  }

  private verificationError(reason: 'invalid' | 'expired' | 'used'): BadRequestException {
    const message =
      reason === 'expired'
        ? 'This verification link has expired.'
        : reason === 'used'
          ? 'This verification link has already been used.'
          : 'This verification link is invalid.';
    return new BadRequestException({
      message,
      code: 'VALIDATION_ERROR' satisfies ErrorCode,
    });
  }

  /** Stores only the SHA-256 hash. The raw token exists in the email link and is never logged. */
  private async issueEmailVerification(user: { id: number; email: string; name: string }) {
    const rawToken = randomBytes(32).toString('hex');
    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: this.hashResetToken(rawToken),
        emailVerificationExpires: new Date(now.getTime() + VERIFICATION_TTL_MS),
        emailVerificationConsumedAt: null,
        emailVerificationSentAt: now,
      },
    });
    const verifyUrl = `${this.frontendOrigin()}/auth/verify-email?token=${rawToken}`;
    try {
      await this.email.sendEmailVerification({
        to: user.email,
        name: user.name,
        verifyUrl,
      });
    } catch {
      this.logger.warn('Verification email could not be sent');
    }
  }

  private async issueEmailVerificationIfDue(user: {
    id: number;
    email: string;
    name: string;
    emailVerified?: boolean;
    emailVerificationSentAt?: Date | null;
  }) {
    if (user.emailVerified) return;
    const sentAt = user.emailVerificationSentAt?.getTime() ?? 0;
    if (sentAt && Date.now() - sentAt < VERIFICATION_RESEND_COOLDOWN_MS) return;
    await this.issueEmailVerification(user);
  }

  private async markEmailVerified(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
        emailVerificationConsumedAt: null,
      },
    });
  }

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

  private async issueTokens(
    user: { id: number; email: string },
    role: MoeRole,
    options?: { accessExpiresIn?: string },
  ) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role,
    };

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti };
    const accessExpiresIn = options?.accessExpiresIn ?? this.accessExpiresIn();

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.accessSecret(),
      expiresIn: accessExpiresIn as any,
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
    acceptedTerms?: boolean;
  }) {
    if (input.acceptedTerms !== true) {
      throw new BadRequestException({
        message: 'You must agree to the Terms of Service and Privacy Policy',
        code: 'VALIDATION_ERROR',
      });
    }
    const role: MoeRole = (input.role ?? 'customer') as MoeRole;
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Email or Password already in use',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
        errors: { email: ['Email or Password already in use'] },
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        phone: input.phone ?? null,
        emailVerified: false,
      },
    });

    await this.ensureUserRole(user.id, role);
    if (role === 'artisan') {
      const serviceCategories =
        input.serviceCategories && input.serviceCategories.length > 0
          ? input.serviceCategories.map((s) => s.trim()).filter(Boolean)
          : [];
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

    await this.issueEmailVerification(user);
    return {
      verificationRequired: true as const,
      email: user.email,
      message: 'Check your email to verify your account before signing in.',
    };
  }

  async login(input: { email: string; password: string; rememberMe?: boolean }) {
    const email = input.email.toLowerCase().trim();
    assertLoginNotLocked(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      recordFailedLogin(email);
      throw authError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      recordFailedLogin(email);
      throw authError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException({
        message: 'Your account has been suspended. Contact support.',
        code: 'FORBIDDEN',
      });
    }

    if (user.emailVerified === false) {
      clearFailedLogins(email);
      throw new ForbiddenException({
        message: 'Verify your email before signing in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED' satisfies ErrorCode,
      });
    }

    clearFailedLogins(email);

    const role = await this.resolvePrimaryRole(user.id);
    // rememberMe: true → 30d; false/omitted → 24h (session default).
    const accessExpiresIn = input.rememberMe === true ? '30d' : '24h';
    const tokens = await this.issueTokens(user, role, { accessExpiresIn });
    return {
      ...tokens,
      user: await this.toProfile(user, role),
    };
  }

  async handleGoogleLogin(
    profile: {
      googleId: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      /** Google's email_verified claim. Unverified addresses are never used to link accounts. */
      emailVerified?: boolean;
    },
    consentState?: string,
  ) {
    let user = await this.prisma.user.findFirst({
      where: { googleId: profile.googleId },
    });

    if (!user && profile.emailVerified === true) {
      user = await this.prisma.user.findFirst({
        where: { email: profile.email },
      });
    }

    if (!user) {
      if (profile.emailVerified !== true) {
        throw new BadRequestException({
          message: 'Google did not confirm this email address',
          code: 'VALIDATION_ERROR',
        });
      }
      if (!consumeOAuthConsentTicket(consentState)) {
        throw new BadRequestException({
          message: CONSENT_REQUIRED,
          code: 'VALIDATION_ERROR',
        });
      }
      const passwordHash = await bcrypt.hash(randomUUID(), 12);
      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          passwordHash,
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
        },
      });
      await this.ensureUserRole(user.id, 'customer');
    } else if (!user.googleId) {
      if (profile.emailVerified !== true) {
        throw new BadRequestException({
          message: 'Google did not confirm this email address',
          code: 'VALIDATION_ERROR',
        });
      }
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          avatarUrl: user.avatarUrl ?? profile.avatarUrl,
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null,
          emailVerificationConsumedAt: null,
        },
      });
    }

    if (profile.emailVerified === true && user.emailVerified === false) {
      user = await this.markEmailVerified(user.id);
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException({
        message: 'Your account has been suspended. Contact support.',
        code: 'FORBIDDEN',
      });
    }

    const role = await this.resolvePrimaryRole(user.id);
    const tokens = await this.issueTokens(user, role);
    return { ...tokens, user: await this.toProfile(user, role) };
  }

  /**
   * Exchanges a Clerk session token for MOE API tokens.
   *
   * 1. Verifies the token against Clerk's JWKS using the secret key.
   * 2. Loads the Clerk user to get email / name / avatar / Google account.
   * 3. Finds the MOE user by `clerkId`, then by email (existing MOE user
   *    connecting Google for the first time), otherwise creates a new customer.
   * 4. Issues the same access/refresh tokens as `/auth/login`.
   */
  async handleClerkLogin(sessionToken: string) {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new BadRequestException({
        message: 'Clerk sign-in is not configured on this server',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
      });
    }

    const authorizedParties = (this.config.get<string>('CLERK_AUTHORIZED_PARTIES') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // verifyToken returns { data, errors } for signature/claim failures but throws
    // for malformed input — treat both as invalid credentials, not a 500.
    const verified = await verifyToken(sessionToken, {
      secretKey,
      ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
    }).catch(() => null);
    const clerkUserId = (verified?.data as { sub?: string } | undefined)?.sub;
    if (!verified || verified.errors || !clerkUserId) {
      throw authError('Clerk session token invalid or expired', 'AUTH_INVALID_CREDENTIALS');
    }

    const clerk = createClerkClient({ secretKey });
    const clerkUser = await clerk.users.getUser(clerkUserId).catch(() => null);
    if (!clerkUser) {
      throw authError('Clerk user not found', 'AUTH_INVALID_CREDENTIALS');
    }

    const primary =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ??
      clerkUser.emailAddresses[0];
    const primaryEmail = primary?.emailAddress;
    const providerVerified = primary?.verification?.status === 'verified';
    if (!primaryEmail) {
      throw new BadRequestException({
        message: 'Clerk account has no email address',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
      });
    }
    const email = primaryEmail.toLowerCase();
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
      email.split('@')[0];
    const avatarUrl = clerkUser.imageUrl || null;
    const googleId =
      clerkUser.externalAccounts.find((a) => a.provider === 'oauth_google' || a.provider === 'google')
        ?.providerUserId ?? null;

    let user = await this.prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    let isNewUser = false;

    if (!user) {
      // Existing MOE account (email/password or legacy Google) → link it to Clerk.
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            clerkId: clerkUserId,
            avatarUrl: byEmail.avatarUrl ?? avatarUrl,
            ...(googleId && !byEmail.googleId ? { googleId } : {}),
            ...(providerVerified
              ? {
                  emailVerified: true,
                  emailVerificationTokenHash: null,
                  emailVerificationExpires: null,
                  emailVerificationConsumedAt: null,
                }
              : {}),
          },
        });
      } else {
        // First-time Clerk Google sign-up. The frontend passes the chosen account
        // type via signUp.authenticateWithRedirect({ unsafeMetadata: { role, serviceCategories } }),
        // which Clerk copies onto the user — mirror what /auth/register does with it.
        if (!clerkSignupAcceptedTerms(clerkUser.unsafeMetadata)) {
          throw new BadRequestException({
            message: CONSENT_REQUIRED,
            code: 'VALIDATION_ERROR',
          });
        }
        const { role: requestedRole, serviceCategories } = this.parseClerkSignUpMetadata(
          clerkUser.unsafeMetadata,
        );
        const passwordHash = await bcrypt.hash(randomUUID(), 12);
        user = await this.prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            clerkId: clerkUserId,
            avatarUrl,
            emailVerified: providerVerified,
            ...(googleId ? { googleId } : {}),
          },
        });
        await this.ensureUserRole(user.id, requestedRole);
        if (requestedRole === 'artisan') {
          await this.prisma.artisanProfile.create({
            data: {
              userId: user.id,
              brandName: name,
              heroImage: null,
              serviceCategories,
              status: 'pending',
            },
          });
        }
        isNewUser = true;
      }
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException({
        message: 'Your account has been suspended. Contact support.',
        code: 'FORBIDDEN',
      });
    }

    if (user.emailVerified === false) {
      if (providerVerified) {
        user = await this.markEmailVerified(user.id);
      } else {
        await this.issueEmailVerificationIfDue(user);
        throw new ForbiddenException({
          message: 'Verify your email before signing in. Check your inbox for the verification link.',
          code: 'EMAIL_NOT_VERIFIED' satisfies ErrorCode,
        });
      }
    }

    const role = await this.resolvePrimaryRole(user.id);
    const tokens = await this.issueTokens(user, role);
    return { ...tokens, user: await this.toProfile(user, role), isNewUser };
  }

  /**
   * `unsafeMetadata` is client-writable, so treat it as untrusted input:
   * only `customer` / `artisan` are honoured and categories must be strings.
   */
  private parseClerkSignUpMetadata(metadata: unknown): {
    role: 'customer' | 'artisan';
    serviceCategories: string[];
  } {
    const meta = (metadata ?? {}) as { role?: unknown; serviceCategories?: unknown };
    const role = meta.role === 'artisan' ? 'artisan' : 'customer';
    const serviceCategories = Array.isArray(meta.serviceCategories)
      ? meta.serviceCategories
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return { role, serviceCategories };
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
    if (user.emailVerified === false) {
      throw new ForbiddenException({
        message: 'Verify your email before signing in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED' satisfies ErrorCode,
      });
    }

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
      const normalizeStringArray = (value: string | string[] | null | undefined) => {
        if (value === undefined) return undefined;
        if (value === null) return [];
        if (Array.isArray(value)) {
          return value.map((s) => String(s).trim()).filter(Boolean);
        }
        return value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
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
            ? { serviceCategories: normalizeStringArray(input.artisanProfile.serviceCategories) }
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
      emailVerified?: boolean;
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
      serviceCategories: string | string[] | null;
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
      emailVerified: user.emailVerified !== false,
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
              serviceCategories: Array.isArray(artisanProfile?.serviceCategories)
                ? artisanProfile.serviceCategories
                : artisanProfile?.serviceCategories
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

  /**
   * Always returns the same message — never reveals whether the email exists.
   */
  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashResetToken(rawToken);
      const expires = nowPlusMs(15 * 60_000);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: expires,
        },
      });

      const frontend =
        this.config.get<string>('FRONTEND_URL')?.trim() ||
        'https://moe-africa-mvp.vercel.app';
      const resetUrl = `${frontend.replace(/\/$/, '')}/auth/reset-password?token=${rawToken}`;

      await this.email.send({
        to: user.email,
        subject: 'Reset your MOE Africa password',
        html: `
          <p>Hi ${user.name || 'there'},</p>
          <p>We received a request to reset your password. This link expires in 15 minutes.</p>
          <p><a href="${resetUrl}">Reset your password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
          <p>— MOE Africa</p>
        `,
      });
    }

    return { message: 'Reset link sent if account exists' };
  }

  async validateResetToken(token: string) {
    const tokenHash = this.hashResetToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new BadRequestException({
        message: 'Reset link is invalid or expired',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
      });
    }
    return { valid: true, email: user.email };
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    const tokenHash = this.hashResetToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException({
        message: 'Reset link is invalid or expired',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate existing sessions after a password reset.
    await this.logoutAll(user.id);

    return { message: 'Password updated successfully' };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashResetToken(token.trim());
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });
    if (!user) throw this.verificationError('invalid');
    if (user.emailVerificationConsumedAt) throw this.verificationError('used');
    if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() <= Date.now()) {
      throw this.verificationError('expired');
    }

    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        emailVerificationTokenHash: tokenHash,
        emailVerificationConsumedAt: null,
        emailVerificationExpires: { gt: new Date() },
      },
      data: {
        emailVerified: true,
        emailVerificationConsumedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      const again = await this.prisma.user.findFirst({
        where: { emailVerificationTokenHash: tokenHash },
        select: { emailVerificationConsumedAt: true, emailVerificationExpires: true },
      });
      if (again?.emailVerificationConsumedAt) throw this.verificationError('used');
      if (again?.emailVerificationExpires && again.emailVerificationExpires.getTime() <= Date.now()) {
        throw this.verificationError('expired');
      }
      throw this.verificationError('invalid');
    }

    return {
      verified: true,
      message: 'Your email is verified. You can sign in.',
    };
  }

  /**
   * Same response whether the address is unknown, already verified, or cooling down.
   * A second message is not sent until 60 seconds after the last one.
   */
  async resendVerification(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (user && user.emailVerified === false) {
      await this.issueEmailVerificationIfDue(user);
    }
    return { message: GENERIC_VERIFICATION_MESSAGE };
  }
}
