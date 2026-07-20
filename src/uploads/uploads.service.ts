import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { MediaLocatorCipherService } from '../media-gateway/media-locator-cipher.service';
import { InitUploadDto } from './uploads.dto';

type UploadManifest = InitUploadDto & { uploadId: string; actorId: string; createdAt: string; chunks: number[] };

@Injectable()
export class UploadsService {
  private readonly maxChunkBytes = 8 * 1024 * 1024;
  private readonly root: string;
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly audit: AuditService, private readonly cipher: MediaLocatorCipherService) { this.root = config.get<string>('UPLOAD_STAGING_DIR', '.runtime/uploads'); }

  async init(dto: InitUploadDto, actor: AuthenticatedPrincipal, requestId: string) {
    if (dto.sizeBytes > this.config.get<number>('MAX_UPLOAD_BYTES', 20_000_000_000)) throw new BadRequestException('File is too large');
    const uploadId = randomUUID();
    const manifest: UploadManifest = { ...dto, uploadId, actorId: actor.id, createdAt: new Date().toISOString(), chunks: [] };
    await mkdir(join(this.root, uploadId, 'chunks'), { recursive: true });
    await this.redis.setJson(this.key(uploadId), manifest, 24 * 60 * 60);
    await this.audit.write({ actorId: actor.id, action: 'upload.init', resource: 'upload', resourceId: uploadId, outcome: 'SUCCESS', requestId, metadata: { purpose: dto.purpose, sizeBytes: dto.sizeBytes, totalChunks: dto.totalChunks } });
    return { uploadId, chunkSizeBytes: this.maxChunkBytes, expiresInSeconds: 86400 };
  }

  async chunk(uploadId: string, chunkIndex: number, file: { buffer: Buffer; size: number }, actor: AuthenticatedPrincipal, requestId: string) {
    const manifest = await this.manifest(uploadId, actor);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= manifest.totalChunks) throw new BadRequestException('Chunk index is invalid');
    if (!file || !file.buffer || file.size > this.maxChunkBytes) throw new BadRequestException('Chunk is missing or too large');
    await writeFile(join(this.root, uploadId, 'chunks', `${chunkIndex}.part`), file.buffer, { flag: 'w' });
    if (!manifest.chunks.includes(chunkIndex)) manifest.chunks.push(chunkIndex);
    manifest.chunks.sort((a, b) => a - b);
    await this.redis.setJson(this.key(uploadId), manifest, 24 * 60 * 60);
    await this.audit.write({ actorId: actor.id, action: 'upload.chunk', resource: 'upload', resourceId: uploadId, outcome: 'SUCCESS', requestId, metadata: { chunkIndex } });
    return { uploadId, chunkIndex, received: manifest.chunks.length, totalChunks: manifest.totalChunks };
  }

  async complete(uploadId: string, actor: AuthenticatedPrincipal, requestId: string) {
    const manifest = await this.manifest(uploadId, actor);
    if (manifest.chunks.length !== manifest.totalChunks) throw new BadRequestException('Not all upload chunks have been received');
    const buffers: Buffer[] = [];
    for (let index = 0; index < manifest.totalChunks; index += 1) buffers.push(await readFile(join(this.root, uploadId, 'chunks', `${index}.part`)));
    const combined = Buffer.concat(buffers);
    if (combined.length !== manifest.sizeBytes) throw new BadRequestException('Uploaded file size does not match the manifest');
    const remote = await this.forward(manifest, combined);
    const storageKey = remote.storageKey ?? `staged:${uploadId}`;
    const result = manifest.purpose === 'episode_video' && remote.url ? { encryptedLocator: this.cipher.encrypt(remote.url), storageKey: undefined } : { storageKey };
    await this.cleanup(uploadId);
    await this.redis.delete(this.key(uploadId));
    await this.audit.write({ actorId: actor.id, action: 'upload.complete', resource: 'upload', resourceId: uploadId, outcome: 'SUCCESS', requestId, metadata: { purpose: manifest.purpose, sizeBytes: combined.length, remote: Boolean(remote.storageKey || remote.url) } });
    return { uploadId, purpose: manifest.purpose, originalName: manifest.originalName, fileSize: combined.length, ...result };
  }

  async cancel(uploadId: string, actor: AuthenticatedPrincipal, requestId: string) { await this.manifest(uploadId, actor); await this.cleanup(uploadId); await this.redis.delete(this.key(uploadId)); await this.audit.write({ actorId: actor.id, action: 'upload.cancel', resource: 'upload', resourceId: uploadId, outcome: 'SUCCESS', requestId }); return { success: true }; }

  private async forward(manifest: UploadManifest, file: Buffer): Promise<{ storageKey?: string; url?: string }> {
    const endpoint = this.config.get<string>('STORAGE_UPLOAD_URL', '');
    if (!endpoint) return {};
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new ServiceUnavailableException('Storage upload endpoint is invalid'); }
    if (url.protocol !== 'https:') throw new ServiceUnavailableException('Storage upload endpoint must use HTTPS');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file) as unknown as BlobPart], { type: manifest.mimeType }), manifest.originalName);
    form.append('purpose', manifest.purpose);
    form.append('originalName', manifest.originalName);
    const token = this.config.get<string>('STORAGE_UPLOAD_TOKEN', '');
    const response = await fetch(url, { method: 'POST', body: form, headers: token ? { authorization: `Bearer ${token}` } : undefined, redirect: 'error' });
    if (!response.ok) throw new ServiceUnavailableException('Storage upload failed');
    const body = await response.json() as { storageKey?: string; url?: string };
    if (!body.storageKey && !body.url) throw new ServiceUnavailableException('Storage upload response is invalid');
    return body;
  }

  private async manifest(uploadId: string, actor: AuthenticatedPrincipal) { const value = await this.redis.getJson<UploadManifest>(this.key(uploadId)); if (!value || value.actorId !== actor.id) throw new NotFoundException('Upload session not found'); return value; }
  private key(uploadId: string) { return `upload:manifest:${uploadId}`; }
  private async cleanup(uploadId: string) { await rm(join(this.root, uploadId), { recursive: true, force: true }); }
}
