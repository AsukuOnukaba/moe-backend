import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy email verification', () => {
  function strategy(emailVerified: boolean | undefined) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(emailVerified === undefined ? null : { emailVerified }),
      },
    };
    const config = {
      getOrThrow: () => 'test-secret-value',
    } as unknown as ConfigService;
    return new JwtStrategy(config, prisma as never);
  }

  it('rejects an unverified account before protected handlers run', async () => {
    await expect(strategy(false).validate({ sub: 4, email: 'ada@local.test', role: 'customer' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows an existing verified account', async () => {
    await expect(strategy(true).validate({ sub: 4, email: 'ada@local.test', role: 'customer' })).resolves.toMatchObject({
      sub: 4,
      role: 'customer',
    });
  });
});
