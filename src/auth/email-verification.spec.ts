import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { AuthService } from './auth.service';
import { issueOAuthConsentTicket } from './oauth-consent';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(),
}));

type Row = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  googleId: string | null;
  clerkId: string | null;
  emailVerified: boolean;
  emailVerificationTokenHash: string | null;
  emailVerificationExpires: Date | null;
  emailVerificationConsumedAt: Date | null;
  emailVerificationSentAt: Date | null;
  createdAt: Date;
  passwordHash: string;
};

function harness() {
  const users = new Map<number, Row>();
  let nextId = 1;
  const email = {
    send: jest.fn(),
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    sendArtisanWelcome: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: number; clerkId?: string } }) => {
        if (where.email) return [...users.values()].find((user) => user.email === where.email) ?? null;
        if (where.id) return users.get(where.id) ?? null;
        if (where.clerkId) return [...users.values()].find((user) => user.clerkId === where.clerkId) ?? null;
        return null;
      }),
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return (
          [...users.values()].find((user) => {
            if (where.googleId && user.googleId === where.googleId) return true;
            if (where.email && user.email === where.email) return true;
            if (where.emailVerificationTokenHash && user.emailVerificationTokenHash === where.emailVerificationTokenHash) {
              return true;
            }
            return false;
          }) ?? null
        );
      }),
      create: jest.fn(async ({ data }: { data: Partial<Row> }) => {
        const user = {
          id: nextId++,
          phone: null,
          avatarUrl: null,
          status: 'active',
          googleId: null,
          clerkId: null,
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null,
          emailVerificationConsumedAt: null,
          emailVerificationSentAt: null,
          createdAt: new Date(),
          passwordHash: 'hash',
          name: 'User',
          email: 'user@example.com',
          ...data,
        } as Row;
        users.set(user.id, user);
        return user;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: number }; data: Partial<Row> }) => {
        const user = users.get(where.id);
        if (!user) throw new Error('missing user');
        Object.assign(user, data);
        return user;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, any>; data: Partial<Row> }) => {
        const user = users.get(where.id);
        if (!user) return { count: 0 };
        if (user.emailVerificationTokenHash !== where.emailVerificationTokenHash) return { count: 0 };
        if (where.emailVerificationConsumedAt === null && user.emailVerificationConsumedAt) return { count: 0 };
        const gt = where.emailVerificationExpires?.gt as Date | undefined;
        if (gt && !(user.emailVerificationExpires && user.emailVerificationExpires > gt)) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      }),
    },
    role: {
      upsert: jest.fn(),
      findUnique: jest.fn(async ({ where }: { where: { name: string } }) => ({ id: 1, name: where.name })),
    },
    userRole: {
      upsert: jest.fn(),
      findMany: jest.fn(async () => [{ role: { name: 'customer' } }]),
    },
    artisanProfile: { create: jest.fn() },
    refreshToken: { create: jest.fn(), updateMany: jest.fn() },
  };
  const config = {
    get: (key: string, fallback?: string) => {
      if (key === 'JWT_ACCESS_SECRET' || key === 'JWT_REFRESH_SECRET') return 'test-secret-value';
      if (key === 'JWT_ACCESS_EXPIRES_IN') return fallback ?? '20m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return fallback ?? '30d';
      if (key === 'FRONTEND_URL') return 'http://localhost:8080';
      if (key === 'CLERK_SECRET_KEY') return 'sk_test_local';
      return fallback;
    },
  } as ConfigService;
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') } as unknown as JwtService;
  const service = new AuthService(prisma as never, jwt, config, email as never);
  return { service, prisma, email, users, jwt };
}

function tokenFromEmail(emailApi: { sendEmailVerification: jest.Mock }): string {
  const url = new URL(emailApi.sendEmailVerification.mock.calls.at(-1)[0].verifyUrl);
  const token = url.searchParams.get('token');
  if (!token) throw new Error('verification link missing token');
  return token;
}

describe('email verification', () => {
  const input = {
    name: 'Ada Lovelace',
    email: 'ada@local.test',
    password: 'Phase7!pass',
    acceptedTerms: true as const,
  };

  it('creates an unverified customer and emails a hashed single-use link', async () => {
    const { service, prisma, email, users, jwt } = harness();
    const result = await service.register(input);
    expect(result).toEqual({
      verificationRequired: true,
      email: 'ada@local.test',
      message: 'Check your email to verify your account before signing in.',
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();
    const user = [...users.values()][0];
    expect(user.emailVerified).toBe(false);
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(1);
    const token = tokenFromEmail(email);
    expect(user.emailVerificationTokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(user.emailVerificationTokenHash).not.toBe(token);
    expect(user.emailVerificationExpires!.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('still requires signup consent', async () => {
    const { service, email } = harness();
    await expect(service.register({ ...input, acceptedTerms: false })).rejects.toBeInstanceOf(BadRequestException);
    expect(email.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('creates an unverified artisan profile without a session', async () => {
    const { service, prisma, jwt } = harness();
    await service.register({ ...input, email: 'maker@local.test', role: 'artisan', serviceCategories: ['Tailoring'] });
    expect(prisma.artisanProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serviceCategories: ['Tailoring'], status: 'pending' }),
      }),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('verifies the matching account and rejects a reused link', async () => {
    const { service, email, users } = harness();
    await service.register(input);
    const token = tokenFromEmail(email);
    const user = [...users.values()][0];

    await expect(service.verifyEmail(token)).resolves.toMatchObject({ verified: true });
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerificationConsumedAt).toBeInstanceOf(Date);

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(BadRequestException);
    try {
      await service.verifyEmail(token);
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'This verification link has already been used.',
      });
    }
  });

  it('rejects an expired link without verifying the account', async () => {
    const { service, email, users } = harness();
    await service.register(input);
    const token = tokenFromEmail(email);
    const user = [...users.values()][0];
    user.emailVerificationExpires = new Date(Date.now() - 1000);
    try {
      await service.verifyEmail(token);
      throw new Error('expected expiry');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'This verification link has expired.',
      });
    }
    expect(user.emailVerified).toBe(false);
  });

  it('rejects an unknown token', async () => {
    const { service } = harness();
    try {
      await service.verifyEmail('a'.repeat(64));
      throw new Error('expected invalid');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'This verification link is invalid.',
      });
    }
  });

  it('blocks unverified password login and still signs in an existing verified account', async () => {
    const { service, users, jwt } = harness();
    await service.register(input);
    await expect(service.login({ email: input.email, password: input.password })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();

    [...users.values()][0].emailVerified = true;
    const session = await service.login({ email: input.email, password: input.password });
    expect(session.token).toBe('signed-token');
    expect(session.user.emailVerified).toBe(true);
  });

  it('resends only after the 60 second cooldown and does not reveal unknown addresses', async () => {
    const { service, email, users } = harness();
    await service.register(input);
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(1);

    const first = await service.resendVerification(input.email);
    const unknown = await service.resendVerification('nobody@local.test');
    expect(first).toEqual(unknown);
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(1);

    [...users.values()][0].emailVerificationSentAt = new Date(Date.now() - 61_000);
    await service.resendVerification(input.email);
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(2);

    [...users.values()][0].emailVerified = true;
    await service.resendVerification(input.email);
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(2);
    await service.resendVerification('nobody-else@local.test');
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(2);
  });

  it('does not email a Google account whose address is already verified', async () => {
    const { state } = issueOAuthConsentTicket(true);
    const { service, email, prisma } = harness();
    const result = await service.handleGoogleLogin(
      {
        googleId: 'google-1',
        email: 'ada.google@local.test',
        name: 'Ada',
        avatarUrl: null,
        emailVerified: true,
      },
      state,
    );
    expect(result.token).toBe('signed-token');
    expect(email.sendEmailVerification).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: true }) }),
    );
  });

  it('marks a password account verified when Google confirms the same address', async () => {
    const { service, email, users } = harness();
    await service.register(input);
    const user = [...users.values()][0];
    const result = await service.handleGoogleLogin({
      googleId: 'google-2',
      email: input.email,
      name: input.name,
      avatarUrl: null,
      emailVerified: true,
    });
    expect(result.token).toBe('signed-token');
    expect(user.emailVerified).toBe(true);
    expect(user.googleId).toBe('google-2');
    expect(email.sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it('does not send a verification email for a verified Clerk address', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ data: { sub: 'user_clerk' } });
    (createClerkClient as jest.Mock).mockReturnValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          id: 'user_clerk',
          primaryEmailAddressId: 'em_1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          imageUrl: null,
          unsafeMetadata: { acceptedTerms: true, role: 'customer' },
          externalAccounts: [{ provider: 'oauth_google', providerUserId: 'g-clerk' }],
          emailAddresses: [
            { id: 'em_1', emailAddress: 'clerk@local.test', verification: { status: 'verified' } },
          ],
        }),
      },
    });
    const { service, email, users } = harness();
    const result = await service.handleClerkLogin('session-token');
    expect(result.token).toBe('signed-token');
    expect([...users.values()][0].emailVerified).toBe(true);
    expect(email.sendEmailVerification).not.toHaveBeenCalled();
  });
});
