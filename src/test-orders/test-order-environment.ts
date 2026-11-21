import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function csv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function shouldRegisterTestOrderController(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env !== 'production' && process.env.NODE_ENV !== 'production';
}

/** Fail-closed gate shared by every simulation mutation. */
export function assertTestOrderEnvironment(
  config: ConfigService,
  adminId?: number,
) {
  const appEnv = (
    config.get<string>('APP_ENV') ||
    config.get<string>('NODE_ENV') ||
    ''
  ).toLowerCase();
  if (
    config.get<string>('TEST_ORDER_SIMULATION_ENABLED') !== 'true' ||
    !['development', 'staging', 'test'].includes(appEnv) ||
    config.get<string>('NODE_ENV') === 'production'
  ) {
    throw new NotFoundException({
      message: 'Not found',
      code: 'RESOURCE_NOT_FOUND',
    });
  }

  const databaseUrl = config.get<string>('DATABASE_URL');
  const allowedDatabases = new Set(
    csv(config.get<string>('TEST_ORDER_SIMULATION_DATABASE_NAMES')),
  );
  let databaseName = '';
  try {
    databaseName = decodeURIComponent(
      new URL(databaseUrl ?? '').pathname.replace(/^\//, ''),
    );
  } catch {
    databaseName = '';
  }
  if (!databaseName || !allowedDatabases.has(databaseName)) {
    throw new NotFoundException({
      message:
        'Test order simulation requires an explicitly allowlisted isolated database',
      code: 'TEST_DATABASE_NOT_ALLOWLISTED',
    });
  }

  if (adminId != null) {
    const allowedAdmins = new Set(
      csv(config.get<string>('TEST_ORDER_SIMULATION_ADMIN_IDS'))
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    );
    if (!allowedAdmins.has(adminId)) {
      throw new ForbiddenException({
        message: 'This admin is not authorised to simulate test orders',
        code: 'TEST_SIMULATION_ADMIN_REQUIRED',
      });
    }
  }

  if (
    config.get<string>('PAYMENT_MODE') === 'live' ||
    config.get<string>('PAYMENT_LIVE_ENABLED') === 'true'
  ) {
    throw new NotFoundException({
      message:
        'Test order simulation is unavailable while live payments are enabled',
      code: 'LIVE_PAYMENTS_ENABLED',
    });
  }

  return { appEnv, databaseName };
}
