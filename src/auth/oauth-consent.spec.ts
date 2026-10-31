import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  clerkSignupAcceptedTerms,
  consumeOAuthConsentTicket,
  issueOAuthConsentTicket,
} from './oauth-consent';

const profile = {
  googleId: 'google-new',
  email: 'new.google@local.test',
  name: 'New Google',
  avatarUrl: null,
  emailVerified: true,
};

function serviceWith(prisma: Record<string, unknown>) {
  const config = {
    get: (key: string, fallback?: string) => {
      if (key === 'JWT_ACCESS_SECRET' || key === 'JWT_REFRESH_SECRET') return 'test-secret';
      return fallback;
    },
  } as ConfigService;
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed') } as unknown as JwtService;
  return new AuthService(prisma as never, jwt, config, {} as never);
}

describe('oauth signup consent', () => {
  it('rejects a new Google account when /auth/google was opened with no consent ticket', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const service = serviceWith(prisma);
    await expect(service.handleGoogleLogin(profile)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a new Google account only after a one-time consent ticket', async () => {
    const { state } = issueOAuthConsentTicket(true);
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 90,
          name: profile.name,
          email: profile.email,
          phone: null,
          avatarUrl: null,
          status: 'active',
          googleId: profile.googleId,
          createdAt: new Date(),
        }),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'customer' }), upsert: jest.fn() },
      userRole: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ role: { name: 'customer' } }]),
      },
      refreshToken: { create: jest.fn() },
    };
    const service = serviceWith(prisma);
    const result = await service.handleGoogleLogin(profile, state);
    expect(result.token).toBe('signed');
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(consumeOAuthConsentTicket(state)).toBe(false);
  });

  it('signs in an existing Google user without a consent ticket', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 14,
          name: 'Existing',
          email: 'phase2.artisan@local.test',
          phone: null,
          avatarUrl: null,
          status: 'active',
          googleId: 'already',
          createdAt: new Date(),
        }),
        create: jest.fn(),
      },
      userRole: { findMany: jest.fn().mockResolvedValue([{ role: { name: 'customer' } }]) },
      refreshToken: { create: jest.fn() },
    };
    const service = serviceWith(prisma);
    const result = await service.handleGoogleLogin({ ...profile, googleId: 'already', email: 'phase2.artisan@local.test' });
    expect(result.user.email).toBe('phase2.artisan@local.test');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does not link or create an account from an unverified Google email', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = serviceWith(prisma);
    await expect(
      service.handleGoogleLogin({ ...profile, emailVerified: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not issue a ticket unless acceptedTerms is true', () => {
    expect(() => issueOAuthConsentTicket(false)).toThrow(BadRequestException);
    expect(() => issueOAuthConsentTicket(undefined)).toThrow(BadRequestException);
  });

  it('requires Clerk metadata consent only for a brand-new MOE account', () => {
    expect(clerkSignupAcceptedTerms({ acceptedTerms: true, role: 'customer' })).toBe(true);
    expect(clerkSignupAcceptedTerms({ role: 'customer' })).toBe(false);
    expect(clerkSignupAcceptedTerms(undefined)).toBe(false);
  });
});
