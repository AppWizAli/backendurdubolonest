import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebasePushService {
  private messaging: Messaging | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(tokens: string[], title: string, body: string, data: Record<string, string> = {}): Promise<{ configured: boolean; sent: number }> {
    const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))].slice(0, 500);
    if (!uniqueTokens.length) return { configured: this.isConfigured(), sent: 0 };
    const messaging = this.getMessaging();
    if (!messaging) return { configured: false, sent: 0 };
    const result = await messaging.sendEachForMulticast({ tokens: uniqueTokens, notification: { title, body }, data });
    return { configured: true, sent: result.successCount };
  }

  private isConfigured(): boolean { return Boolean(this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_B64', '')); }

  private getMessaging(): Messaging | null {
    if (this.messaging) return this.messaging;
    const encoded = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_B64', '');
    if (!encoded) return null;
    const account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as { project_id: string; client_email: string; private_key: string };
    const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key }) });
    this.messaging = getMessaging(app);
    return this.messaging;
  }
}
