import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FirebasePushService } from '../legacy/firebase-push.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { DrmValidationDto, FirebaseTestDto } from './admin-tools.dto';

@Injectable()
export class AdminToolsService {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService, private readonly firebase: FirebasePushService, private readonly audit: AuditService) {}

  firebaseStatus() {
    const encoded = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_B64', '');
    let projectId: string | null = null;
    if (encoded) { try { projectId = (JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as { project_id?: string }).project_id ?? null; } catch { projectId = null; } }
    return { configured: Boolean(encoded && projectId), projectId, delivery: encoded ? 'enabled' : 'disabled' };
  }

  async sendFirebaseTest(dto: FirebaseTestDto, actor: AuthenticatedPrincipal, requestId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, deletedAt: null }, select: { id: true, deviceToken: true } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.deviceToken) throw new BadRequestException('The selected user has no registered notification device');
    const result = await this.firebase.send([user.deviceToken], dto.title, dto.message, { source: 'admin_test' });
    await this.audit.write({ actorId: actor.id, action: 'admin.firebase_test', resource: 'user', resourceId: user.id, outcome: result.sent ? 'SUCCESS' : 'FAILURE', requestId, metadata: { configured: result.configured, sent: result.sent } });
    return result;
  }

  drmStatus() {
    const licenseUrl = this.config.get<string>('WIDEVINE_LICENSE_URL', '');
    let host: string | null = null;
    if (licenseUrl) { try { host = new URL(licenseUrl).hostname; } catch { host = null; } }
    return { provider: this.config.get<string>('WIDEVINE_PROVIDER', 'not-configured'), configured: Boolean(licenseUrl && host), licenseHost: host, protocol: licenseUrl ? 'https' : null };
  }

  validateDrm(dto: DrmValidationDto) {
    const value = dto.licenseUrl ?? this.config.get<string>('WIDEVINE_LICENSE_URL', '');
    if (!value) return { valid: false, reason: 'No license endpoint is configured.' };
    let url: URL;
    try { url = new URL(value); } catch { return { valid: false, reason: 'License endpoint is not a valid URL.' }; }
    if (url.protocol !== 'https:') return { valid: false, reason: 'License endpoint must use HTTPS.' };
    return { valid: true, host: url.hostname, path: url.pathname };
  }
}
