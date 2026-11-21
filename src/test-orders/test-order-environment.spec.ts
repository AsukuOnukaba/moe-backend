import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertTestOrderEnvironment } from './test-order-environment';

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as ConfigService;
}

const safe = {
  TEST_ORDER_SIMULATION_ENABLED: 'true',
  APP_ENV: 'development',
  NODE_ENV: 'development',
  DATABASE_URL:
    'postgresql://postgres:postgres@127.0.0.1:5432/moe_dev?schema=public',
  TEST_ORDER_SIMULATION_DATABASE_NAMES: 'moe_dev',
  TEST_ORDER_SIMULATION_ADMIN_IDS: '7,8',
  PAYMENT_MODE: 'test',
  PAYMENT_LIVE_ENABLED: 'false',
};

describe('test-order environment gate', () => {
  it('allows only the explicitly allowlisted test database and admin', () => {
    expect(assertTestOrderEnvironment(config(safe), 7)).toMatchObject({
      databaseName: 'moe_dev',
    });
  });

  it.each([
    [{ ...safe, TEST_ORDER_SIMULATION_ENABLED: 'false' }, 7],
    [{ ...safe, APP_ENV: '', NODE_ENV: '' }, 7],
    [{ ...safe, APP_ENV: 'review' }, 7],
    [{ ...safe, APP_ENV: 'production' }, 7],
    [{ ...safe, NODE_ENV: 'production' }, 7],
    [{ ...safe, DATABASE_URL: 'postgresql://db/prod' }, 7],
    [{ ...safe, PAYMENT_MODE: 'live' }, 7],
    [{ ...safe, PAYMENT_LIVE_ENABLED: 'true' }, 7],
  ])('fails closed for unsafe configuration', (values, adminId) => {
    expect(() => assertTestOrderEnvironment(config(values), adminId)).toThrow(
      NotFoundException,
    );
  });

  it('rejects an admin outside the explicit simulator allowlist', () => {
    expect(() => assertTestOrderEnvironment(config(safe), 99)).toThrow(
      ForbiddenException,
    );
  });
});
