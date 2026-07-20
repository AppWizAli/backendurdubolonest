import { createCipheriv, randomBytes } from 'node:crypto';
import { MediaLocatorCipherService } from './media-locator-cipher.service';

describe('MediaLocatorCipherService', () => {
  it('decrypts the internal v1 locator format without exposing it through an API', () => {
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update('https://storage.example.com/private/video.m3u8', 'utf8'), cipher.final()]);
    const encoded = `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
    const service = new MediaLocatorCipherService({ getOrThrow: jest.fn().mockReturnValue(key.toString('base64')) } as any);
    expect(service.decrypt(encoded)).toBe('https://storage.example.com/private/video.m3u8');
  });
});
