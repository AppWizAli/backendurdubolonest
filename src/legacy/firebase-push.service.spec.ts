import { ConfigService } from '@nestjs/config';
import { FirebasePushService } from './firebase-push.service';

describe('FirebasePushService', () => {
  it('does not attempt delivery when Firebase is not configured', async () => {
    const config = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const service = new FirebasePushService(config);
    await expect(service.send([' token-1 ', 'token-1'], 'Title', 'Body')).resolves.toEqual({ configured: false, sent: 0 });
  });

  it('returns a no-op result for an empty token list', async () => {
    const config = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const service = new FirebasePushService(config);
    await expect(service.send([], 'Title', 'Body')).resolves.toEqual({ configured: false, sent: 0 });
  });
});
