import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService verification', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends through Resend with the configured sender and does not log the key or token', async () => {
    const logs: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    }) as typeof fetch;

    const config = {
      get: (key: string) => {
        if (key === 'RESEND_API_KEY') return 're_test_secret_key';
        if (key === 'RESEND_FROM_EMAIL') return 'MOE Africa <verify@moe-africa.com>';
        return undefined;
      },
    } as ConfigService;
    const service = new EmailService(config);
    const verifyUrl = 'http://localhost:8080/auth/verify-email?token=abc123secretabc123secretabc123secretabc123';
    await service.sendEmailVerification({
      to: 'ada@local.test',
      name: 'Ada <script>',
      verifyUrl,
    });

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test_secret_key' }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe('MOE Africa <verify@moe-africa.com>');
    expect(body.to).toEqual(['ada@local.test']);
    expect(body.subject).toBe('Verify your MOE Africa email');
    expect(body.html).toContain('MOE');
    expect(body.html).toContain(verifyUrl);
    expect(body.html).toContain('Ada &lt;script&gt;');
    expect(body.html).not.toContain('<script>');
    expect(logs.join('\n')).not.toContain('re_test_secret_key');
    expect(logs.join('\n')).not.toContain('abc123secret');
  });

  it('logs a provider failure without the response body token or key', async () => {
    const logs: string[] = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          message: 'Invalid aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa re_test_secret_key',
        }),
    }) as typeof fetch;
    const config = {
      get: (key: string) => (key === 'RESEND_API_KEY' ? 're_test_secret_key' : 'MOE Africa <verify@moe-africa.com>'),
    } as ConfigService;
    await new EmailService(config).send({
      to: 'ada@local.test',
      subject: 'Verify your MOE Africa email',
      html: '<p>token=abc123secretabc123secretabc123secretabc123</p>',
    });
    const line = logs.join('\n');
    expect(line).toContain('Resend failed (422)');
    expect(line).not.toContain('re_test_secret_key');
    expect(line).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });
});
