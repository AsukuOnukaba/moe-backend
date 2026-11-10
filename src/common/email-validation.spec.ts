import {
  assertDeliverableEmail,
  isValidEmailFormat,
  lookupMxStatus,
  normalizeEmail,
} from './email-validation';

jest.mock('dns', () => {
  const resolveMx = jest.fn();
  return {
    promises: { resolveMx },
    __resolveMx: resolveMx,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dnsMock = require('dns') as {
  promises: { resolveMx: jest.Mock };
  __resolveMx: jest.Mock;
};

describe('email-validation', () => {
  beforeEach(() => {
    dnsMock.__resolveMx.mockReset();
  });

  it('normalizes and validates format', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(isValidEmailFormat('ada@example.com')).toBe(true);
    expect(isValidEmailFormat('not-an-email')).toBe(false);
    expect(isValidEmailFormat('a@b')).toBe(false);
    expect(isValidEmailFormat('a@b..com')).toBe(false);
  });

  it('rejects domains with no MX records', async () => {
    dnsMock.__resolveMx.mockRejectedValue(
      Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }),
    );
    await expect(assertDeliverableEmail('user@no-such-domain.invalid')).rejects.toMatchObject({
      response: expect.objectContaining({
        errors: expect.objectContaining({
          email: expect.arrayContaining([expect.stringMatching(/cannot receive mail/i)]),
        }),
      }),
    });
  });

  it('allows signup when MX lookup times out (transient)', async () => {
    dnsMock.__resolveMx.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const err = Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
          setTimeout(() => reject(err), 10);
        }),
    );
    // Force immediate transient by rejecting with ETIMEOUT without waiting for our race.
    dnsMock.__resolveMx.mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }),
    );
    await expect(assertDeliverableEmail('user@example.com')).resolves.toMatchObject({
      email: 'user@example.com',
      mx: 'transient',
    });
  });

  it('skips DNS for .test domains used in local harnesses', async () => {
    await expect(assertDeliverableEmail('ada@local.test')).resolves.toMatchObject({
      email: 'ada@local.test',
      mx: 'skipped',
    });
    expect(dnsMock.__resolveMx).not.toHaveBeenCalled();
  });

  it('reports ok when MX records exist', async () => {
    dnsMock.__resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);
    expect(await lookupMxStatus('example.com')).toBe('ok');
  });
});
