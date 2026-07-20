import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class MediaLocatorCipherService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string): string {
    const key = Buffer.from(this.config.getOrThrow<string>('MEDIA_LOCATOR_ENCRYPTION_KEY_B64'), 'base64');
    if (key.length !== 32) throw new BadRequestException('Media locator key is invalid');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(value: string): string {
    try {
      const [version, ivEncoded, tagEncoded, cipherEncoded] = value.split('.');
      if (version !== 'v1' || !ivEncoded || !tagEncoded || !cipherEncoded) throw new Error('invalid_locator_format');
      const iv = Buffer.from(ivEncoded, 'base64url');
      const tag = Buffer.from(tagEncoded, 'base64url');
      const ciphertext = Buffer.from(cipherEncoded, 'base64url');
      const key = Buffer.from(this.config.getOrThrow<string>('MEDIA_LOCATOR_ENCRYPTION_KEY_B64'), 'base64');
      if (key.length !== 32 || iv.length !== 12 || tag.length !== 16) throw new Error('invalid_locator_key');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch { throw new BadRequestException('Media locator is invalid'); }
  }
}
