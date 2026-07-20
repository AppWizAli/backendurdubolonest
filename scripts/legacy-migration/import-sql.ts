import { createCipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

type LegacyRow = Record<string, unknown>;
type Resolved = { id: string; created: boolean };
type Report = { runId: string; file: string; dryRun: boolean; startedAt: string; completedAt?: string; counts: Record<string, number>; duplicates: string[]; skipped: string[]; errors: string[] };

function loadLocalEnv(): void {
  if (process.env.DATABASE_URL || !existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadLocalEnv();
const prisma = new PrismaClient();
const runId = process.env.MIGRATION_RUN_ID ?? randomUUID();
const dryRun = !process.argv.includes('--apply');
const fileArg = process.argv.find((value) => value.startsWith('--file='))?.slice('--file='.length);
const file = fileArg ?? process.env.LEGACY_SQL_FILE ?? 'E:/Company projects Work/_MAyPN23gE17/u223360224_urdubolodb2.sql';
const report: Report = { runId, file, dryRun, startedAt: new Date().toISOString(), counts: {}, duplicates: [], skipped: [], errors: [] };
const maps = { admin: new Map<string, string>(), user: new Map<string, string>(), drama: new Map<string, string>(), season: new Map<string, string>(), episode: new Map<string, string>(), group: new Map<string, string>() };
const prior = new Map<string, string>();

function add(list: string[], value: string): void { if (list.length < 250) list.push(value); }
function count(name: string): void { report.counts[name] = (report.counts[name] ?? 0) + 1; }
function val(row: LegacyRow, ...names: string[]): unknown { for (const name of names) if (row[name] !== undefined && row[name] !== null) return row[name]; return undefined; }
function text(row: LegacyRow, ...names: string[]): string | undefined { const value = val(row, ...names); return value === undefined ? undefined : String(value).trim(); }
function sourceId(row: LegacyRow, fallback: string): string { return text(row, 'id', 'uuid') ?? fallback; }
function int(row: LegacyRow, ...names: string[]): number | undefined { const value = Number(val(row, ...names)); return Number.isInteger(value) ? value : undefined; }
function date(value: unknown, fallback = new Date()): Date { if (!value) return fallback; const parsed = new Date(String(value).replace(' ', 'T') + (String(value).length === 10 ? 'T00:00:00Z' : 'Z')); return Number.isNaN(parsed.getTime()) ? fallback : parsed; }
function validEmail(value: string | undefined): boolean { return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)); }
function slugify(value: string, suffix: string): string { const base = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 190) || 'legacy-drama'; return `${base}-${suffix}`.slice(0, 220); }
function dateWindow(startValue: unknown, endValue: unknown, createdValue?: unknown): { startsAt: Date; endsAt: Date } { const startsAt = date(startValue, date(createdValue, new Date())); let endsAt = date(endValue, new Date(startsAt.getTime() + 30 * 86400000)); if (endsAt <= startsAt) endsAt = new Date(startsAt.getTime() + 30 * 86400000); return { startsAt, endsAt }; }

function statementEnd(source: string, start: number): number {
  let quoted = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) { if (character === '\\') index += 1; else if (character === "'") { if (source[index + 1] === "'") index += 1; else quoted = false; } }
    else if (character === "'") quoted = true;
    else if (character === ';') return index;
  }
  return source.length;
}

function splitFields(value: string): string[] {
  const fields: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) { if (character === '\\') index += 1; else if (character === "'") { if (value[index + 1] === "'") index += 1; else quoted = false; } }
    else if (character === "'") quoted = true;
    else if (character === ',') { fields.push(value.slice(start, index).trim()); start = index + 1; }
  }
  fields.push(value.slice(start).trim());
  return fields;
}

function parseValue(value: string): unknown {
  if (value.toUpperCase() === 'NULL') return null;
  if (value.startsWith("'") && value.endsWith("'")) {
    let output = '';
    for (let index = 1; index < value.length - 1; index += 1) {
      if (value[index] === '\\' && index + 1 < value.length - 1) { const next = value[++index]; output += ({ '0': '\0', n: '\n', r: '\r', t: '\t', b: '\b', Z: '\x1a', '\\': '\\', "'": "'", '"': '"' } as Record<string, string>)[next] ?? next; }
      else if (value[index] === "'" && value[index + 1] === "'") { output += "'"; index += 1; }
      else output += value[index];
    }
    return output;
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function tuples(value: string): string[][] {
  const result: string[][] = [];
  let tupleStart = -1;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) { if (character === '\\') index += 1; else if (character === "'") { if (value[index + 1] === "'") index += 1; else quoted = false; } continue; }
    if (character === "'") { quoted = true; continue; }
    if (character === '(') { if (depth === 0) tupleStart = index + 1; depth += 1; continue; }
    if (character === ')') { depth -= 1; if (depth === 0 && tupleStart >= 0) { result.push(splitFields(value.slice(tupleStart, index))); tupleStart = -1; } }
  }
  return result;
}

function parseDump(source: string): Map<string, LegacyRow[]> {
  const tables = new Map<string, LegacyRow[]>();
  const inserts = /INSERT INTO\s+`([^`]+)`\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let match: RegExpExecArray | null;
  while ((match = inserts.exec(source))) {
    const end = statementEnd(source, inserts.lastIndex);
    const columns = match[2].split(',').map((column) => column.trim().replaceAll('`', ''));
    const rows = tables.get(match[1]) ?? [];
    for (const tuple of tuples(source.slice(inserts.lastIndex, end))) { const row: LegacyRow = {}; columns.forEach((column, index) => { row[column] = parseValue(tuple[index] ?? 'NULL'); }); rows.push(row); }
    tables.set(match[1], rows);
    inserts.lastIndex = end + 1;
  }
  return tables;
}

function encryptLocator(value: string): string {
  const key = Buffer.from(process.env.MEDIA_LOCATOR_ENCRYPTION_KEY_B64 ?? '', 'base64');
  if (key.length !== 32) throw new Error('MEDIA_LOCATOR_ENCRYPTION_KEY_B64 must be configured before importing media');
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function allowedMedia(value: string): boolean { try { const parsed = new URL(value); const hosts = new Set((process.env.MEDIA_PROVIDER_ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)); return parsed.protocol === 'https:' && hosts.has(parsed.hostname.toLowerCase()); } catch { return false; } }

async function resolveRecord(entity: string, table: string, key: string, find: () => Promise<{ id: string } | null>, create: (id: string) => Promise<void>): Promise<Resolved> {
  const priorId = prior.get(`${table}:${key}:${entity}`);
  if (priorId) return { id: priorId, created: false };
  const existing = await find();
  if (existing) { add(report.duplicates, `${table}:${key}:${entity}`); return { id: existing.id, created: false }; }
  const id = randomUUID();
  if (!dryRun) { await create(id); await prisma.legacyMigrationRecord.create({ data: { runId, sourceTable: table, sourceKey: key.slice(0, 160), targetEntity: entity, targetId: id } }); }
  count(entity);
  return { id, created: true };
}

async function ensureUserRole(userId: string, roleCode: 'USER' | 'ADMIN' | 'SUPER_ADMIN'): Promise<void> { const role = await prisma.roleDefinition.findUnique({ where: { code: roleCode } }); if (!role || dryRun) return; await prisma.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, create: { userId, roleId: role.id }, update: {} }); }

async function main(): Promise<void> {
  const source = readFileSync(file, 'utf8');
  const tables = parseDump(source);
  const previous = await prisma.legacyMigrationRecord.findMany({ select: { sourceTable: true, sourceKey: true, targetEntity: true, targetId: true } });
  for (const row of previous) prior.set(`${row.sourceTable}:${row.sourceKey}:${row.targetEntity}`, row.targetId);
  const dummyHash = process.env.ARGON2_DUMMY_HASH;
  if (!dummyHash) throw new Error('ARGON2_DUMMY_HASH is required');
  const adminRows = tables.get('admin') ?? [];
  const userRows = tables.get('users') ?? [];
  const dramaRows = tables.get('drama') ?? [];
  const seasonRows = tables.get('season') ?? [];
  const episodeRows = tables.get('episode') ?? [];
  const groupRows = tables.get('groups') ?? [];
  const adminFallback = (await prisma.userRole.findFirst({ where: { role: { code: 'SUPER_ADMIN' } }, select: { userId: true } }))?.userId;
  if (!adminFallback && !dryRun) throw new Error('A seeded SUPER_ADMIN is required before importing legacy data');

  for (const [index, row] of adminRows.entries()) {
    const key = sourceId(row, String(index)); const rawEmail = text(row, 'admin_email', 'email') ?? `legacy-admin-${key}@legacy.invalid`; const email = validEmail(rawEmail) ? rawEmail.toLowerCase() : `legacy-admin-${key}@legacy.invalid`; const roleCode = text(row, 'admin_type') === 'owner' ? 'SUPER_ADMIN' : 'ADMIN';
    const resolved = await resolveRecord('User', 'admin', key, () => prisma.user.findUnique({ where: { email }, select: { id: true } }), async (id) => { await prisma.user.create({ data: { id, username: (text(row, 'admin_name', 'name') ?? `Legacy admin ${key}`).slice(0, 80), email, passwordHash: dummyHash, status: 'DISABLED', createdAt: date(val(row, 'created_at')) } }); });
    maps.admin.set(key, resolved.id); await ensureUserRole(resolved.id, roleCode); if (resolved.created) count('Admin');
  }

  for (const [index, row] of userRows.entries()) {
    const key = sourceId(row, String(index)); const rawEmail = text(row, 'email'); const email = validEmail(rawEmail) ? rawEmail!.toLowerCase() : `legacy-user-${key}@legacy.invalid`;
    const resolved = await resolveRecord('User', 'users', key, () => prisma.user.findUnique({ where: { email }, select: { id: true } }), async (id) => { await prisma.user.create({ data: { id, username: (text(row, 'username', 'name') ?? `Legacy user ${key}`).slice(0, 80), email, passwordHash: dummyHash, status: 'DISABLED', profileImageKey: text(row, 'profile_image')?.slice(0, 512) || undefined, deviceToken: text(row, 'device_token')?.slice(0, 512) || undefined, createdAt: date(val(row, 'created_at')) } }); });
    maps.user.set(key, resolved.id); await ensureUserRole(resolved.id, 'USER');
  }

  const usedSlugs = new Set<string>();
  for (const [index, row] of dramaRows.entries()) {
    const key = sourceId(row, String(index)); const name = (text(row, 'name', 'title') ?? `Legacy drama ${key}`).slice(0, 200); let slug = slugify(name, key); while (usedSlugs.has(slug)) slug = slugify(`${name}-${randomUUID().slice(0, 6)}`, key); usedSlugs.add(slug);
    const resolved = await resolveRecord('Drama', 'drama', key, () => prisma.drama.findUnique({ where: { slug }, select: { id: true } }), async (id) => { await prisma.drama.create({ data: { id, name, slug, dramaNumber: int(row, 'drama_number'), totalSeasons: int(row, 'total_seasons') ?? 0, thumbnailKey: text(row, 'thumbnail')?.slice(0, 512) || undefined, isPublished: true, createdAt: date(val(row, 'created_at')) } }); });
    maps.drama.set(key, resolved.id);
  }

  for (const [index, row] of seasonRows.entries()) {
    const key = sourceId(row, String(index)); const dramaId = maps.drama.get(String(val(row, 'drama_id'))); const seasonNumber = int(row, 'season_number') ?? 1;
    if (!dramaId) { add(report.skipped, `season:${key}:drama_not_found`); continue; }
    const resolved = await resolveRecord('Season', 'season', key, () => prisma.season.findUnique({ where: { dramaId_seasonNumber: { dramaId, seasonNumber } }, select: { id: true } }), async (id) => { await prisma.season.create({ data: { id, dramaId, seasonNumber, title: `Season ${seasonNumber}`, totalEpisodes: int(row, 'total_episodes') ?? 0, thumbnailKey: text(row, 'thumbnail')?.slice(0, 512) || undefined, createdAt: date(val(row, 'created_at')) } }); });
    maps.season.set(key, resolved.id);
  }

  for (const [index, row] of episodeRows.entries()) {
    const key = sourceId(row, String(index)); const seasonId = maps.season.get(String(val(row, 'season_id'))); const episodeNumber = int(row, 'episode_number') ?? 1;
    if (!seasonId) { add(report.skipped, `episode:${key}:season_not_found`); continue; }
    const privacy = text(row, 'privacy')?.toLowerCase() === 'private'; const download = text(row, 'download_access')?.toLowerCase(); const resolved = await resolveRecord('Episode', 'episode', key, () => prisma.episode.findUnique({ where: { seasonId_episodeNumber: { seasonId, episodeNumber } }, select: { id: true } }), async (id) => { await prisma.episode.create({ data: { id, seasonId, episodeNumber, title: `Episode ${episodeNumber}`, description: text(row, 'description') || undefined, thumbnailKey: text(row, 'thumbnail')?.slice(0, 512) || undefined, isPublished: true, status: 'PUBLISHED', visibility: privacy ? 'PRIVATE' : 'PUBLIC', isPremium: true, downloadAccess: download === 'appstorage' ? 'APP_STORAGE' : download === 'both' ? 'BOTH' : download === 'never' ? 'NEVER' : 'GALLERY', createdAt: date(val(row, 'created_at')) } }); });
    maps.episode.set(key, resolved.id);
    const locator = text(row, 'video_path');
    if (!locator || !resolved.created) continue;
    if (await prisma.mediaAsset.findFirst({ where: { episodeId: resolved.id }, select: { id: true } })) { add(report.duplicates, `episode:${key}:media`); continue; }
    const mediaType = /\.m3u8(?:\?|$)/i.test(locator) ? 'HLS' : /\.mpd(?:\?|$)/i.test(locator) ? 'DASH' : /\.mp4(?:\?|$)/i.test(locator) ? 'MP4' : 'OTHER';
    const active = allowedMedia(locator);
    if (!active) add(report.skipped, `media:${key}:provider_not_allowlisted_or_not_https`);
    const mediaId = randomUUID();
    if (!dryRun) {
      await prisma.mediaAsset.create({ data: { id: mediaId, episodeId: resolved.id, kind: mediaType, mediaType, provider: (() => { try { return new URL(locator).hostname.slice(0, 80); } catch { return 'legacy-import'; } })(), encryptedLocator: encryptLocator(locator), status: active ? 'ACTIVE' : 'INACTIVE', metadata: { source: 'legacy-sql', legacyEpisodeId: key } } });
      await prisma.legacyMigrationRecord.create({ data: { runId, sourceTable: 'episode', sourceKey: `${key}:media`.slice(0, 160), targetEntity: 'MediaAsset', targetId: mediaId } });
    }
    count('MediaAsset');
  }

  for (const [index, row] of groupRows.entries()) {
    const key = sourceId(row, String(index)); const name = (text(row, 'group_name', 'name') ?? `Legacy group ${key}`).slice(0, 120); const resolved = await resolveRecord('AccessGroup', 'groups', key, () => prisma.accessGroup.findUnique({ where: { name }, select: { id: true } }), async (id) => { await prisma.accessGroup.create({ data: { id, name } }); }); maps.group.set(key, resolved.id);
  }

  for (const [index, row] of (tables.get('group_members') ?? []).entries()) {
    const key = sourceId(row, String(index)); const groupId = maps.group.get(String(val(row, 'group_id'))); const userId = maps.user.get(String(val(row, 'user_id'))); if (!groupId || !userId) { add(report.skipped, `group_member:${key}:parent_not_found`); continue; }
    const window = dateWindow(val(row, 'start_date'), val(row, 'end_date'), val(row, 'created_at'));
    await resolveRecord('GroupMember', 'group_members', key, () => prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { id: true } }), async (id) => { await prisma.groupMember.create({ data: { id, groupId, userId, startsAt: window.startsAt, endsAt: window.endsAt, comment: text(row, 'comment') || undefined, subscription: Number(val(row, 'subscription') ?? 0) > 0 } }); });
  }

  async function grant(table: string, row: LegacyRow, index: number, groupId?: string, userId?: string): Promise<void> {
    const key = sourceId(row, String(index)); const episodeId = maps.episode.get(String(val(row, 'video_id'))); if (!episodeId || (!groupId && !userId)) { add(report.skipped, `${table}:${key}:parent_not_found`); return; }
    const window = dateWindow(val(row, 'start_date'), val(row, 'end_date')); const existing = await prisma.episodeGrant.findFirst({ where: { episodeId, groupId: groupId ?? undefined, userId: userId ?? undefined, startsAt: window.startsAt, endsAt: window.endsAt }, select: { id: true } }); if (existing) { add(report.duplicates, `${table}:${key}:grant`); return; }
    const id = randomUUID(); if (!dryRun) { await prisma.episodeGrant.create({ data: { id, episodeId, groupId, userId, startsAt: window.startsAt, endsAt: window.endsAt, status: 'ACTIVE' } }); await prisma.legacyMigrationRecord.create({ data: { runId, sourceTable: table, sourceKey: key.slice(0, 160), targetEntity: 'EpisodeGrant', targetId: id } }); } count('EpisodeGrant');
  }
  for (const [index, row] of (tables.get('group_videos') ?? []).entries()) await grant('group_videos', row, index, maps.group.get(String(val(row, 'group_id'))));
  for (const [index, row] of (tables.get('user_videos') ?? []).entries()) await grant('user_videos', row, index, undefined, maps.user.get(String(val(row, 'user_id'))));

  const fallbackAdmin = adminFallback ?? randomUUID();
  for (const [index, row] of (tables.get('notifications') ?? []).entries()) {
    const key = sourceId(row, String(index)); const createdById = maps.admin.get(String(val(row, 'admin_id'))) ?? fallbackAdmin; if (!createdById) { add(report.skipped, `notification:${key}:admin_not_found`); continue; }
    await resolveRecord('Notification', 'notifications', key, async () => null, async (id) => { await prisma.notification.create({ data: { id, createdById, title: (text(row, 'title') ?? 'Legacy notification').slice(0, 255), message: text(row, 'message') ?? '', imageKey: text(row, 'image')?.slice(0, 512) || undefined, createdAt: date(val(row, 'created_at')) } }); });
  }
  for (const [index, row] of (tables.get('banners') ?? []).entries()) { const key = sourceId(row, String(index)); await resolveRecord('Banner', 'banners', key, async () => null, async (id) => { await prisma.banner.create({ data: { id, imageKey: text(row, 'image_url')?.slice(0, 512) || undefined, videoKey: text(row, 'video_url')?.slice(0, 512) || undefined, isActive: true, createdAt: date(val(row, 'created_at')) } }); }); }
  for (const [index, row] of (tables.get('trending_dramas') ?? []).entries()) { const key = sourceId(row, String(index)); const dramaId = maps.drama.get(String(val(row, 'drama_id'))); const position = int(row, 'position') ?? index + 1; if (!dramaId) { add(report.skipped, `trending:${key}:drama_not_found`); continue; } const existing = await prisma.trendingDrama.findFirst({ where: { OR: [{ dramaId }, { position }] }, select: { id: true } }); if (existing) { add(report.duplicates, `trending:${key}`); continue; } const id = randomUUID(); if (!dryRun) { await prisma.trendingDrama.create({ data: { id, dramaId, position, createdAt: date(val(row, 'created_at')) } }); await prisma.legacyMigrationRecord.create({ data: { runId, sourceTable: 'trending_dramas', sourceKey: key.slice(0, 160), targetEntity: 'TrendingDrama', targetId: id } }); } count('TrendingDrama'); }
  for (const [index, row] of (tables.get('user_message') ?? []).entries()) { const key = sourceId(row, String(index)); const userId = maps.user.get(String(val(row, 'user_id'))); if (!userId) { add(report.skipped, `message:${key}:user_not_found`); continue; } await resolveRecord('UserMessage', 'user_message', key, async () => null, async (id) => { await prisma.userMessage.create({ data: { id, userId, message: text(row, 'message') ?? '', status: text(row, 'status') ?? 'unread', createdAt: date(val(row, 'created_at')) } }); }); }
  for (const [index, row] of (tables.get('video_views') ?? []).entries()) { const key = sourceId(row, String(index)); const episodeId = maps.episode.get(String(val(row, 'video_id'))); const userId = maps.user.get(String(val(row, 'user_id'))); if (!episodeId || !userId) { add(report.skipped, `view:${key}:parent_not_found`); continue; } const id = randomUUID(); if (!dryRun) { await prisma.videoView.create({ data: { id, episodeId, userId, viewedAt: date(val(row, 'view_time')) } }); await prisma.legacyMigrationRecord.create({ data: { runId, sourceTable: 'video_views', sourceKey: key.slice(0, 160), targetEntity: 'VideoView', targetId: id } }); } count('VideoView'); }
  for (const [index, row] of (tables.get('apk_files') ?? []).entries()) { const key = sourceId(row, String(index)); await resolveRecord('AppRelease', 'apk_files', key, async () => null, async (id) => { await prisma.appRelease.create({ data: { id, versionName: text(row, 'string')?.slice(0, 60), storageKey: text(row, 'apk_url')?.slice(0, 512) ?? `legacy://${key}`, originalName: 'legacy-urdu-bolo.apk', isActive: false, createdAt: date(val(row, 'uploaded_at')) } }); }); }

  report.completedAt = new Date().toISOString(); await mkdir('var/migration-reports', { recursive: true }); await writeFile(`var/migration-reports/${runId}-sql.json`, JSON.stringify({ ...report, sourceTables: [...tables.entries()].map(([name, rows]) => ({ name, rows: rows.length })) }, null, 2)); process.stdout.write(JSON.stringify({ ...report, sourceTables: [...tables.entries()].map(([name, rows]) => ({ name, rows: rows.length })) }) + '\n');
}

main().catch(async (error: unknown) => { report.errors.push(error instanceof Error ? error.message : 'SQL import failed'); await mkdir('var/migration-reports', { recursive: true }); await writeFile(`var/migration-reports/${runId}-sql.json`, JSON.stringify(report, null, 2)); process.stderr.write(JSON.stringify(report) + '\n'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
