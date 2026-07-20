import { createConnection, RowDataPacket } from 'mysql2/promise';
import { PrismaClient, UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

type SourceRow = RowDataPacket & Record<string, unknown>;
type MigrationReport = {
  runId: string;
  dryRun: boolean;
  startedAt: string;
  completedAt?: string;
  counts: Record<string, number>;
  duplicates: string[];
  errors: string[];
};

const prisma = new PrismaClient();
const runId = process.env.MIGRATION_RUN_ID ?? randomUUID();
const dryRun = !process.argv.includes('--apply');
const maxRows = Number(process.env.MIGRATION_MAX_ROWS ?? 100000);
const report: MigrationReport = {
  runId,
  dryRun,
  startedAt: new Date().toISOString(),
  counts: {},
  duplicates: [],
  errors: [],
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tableName(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`${name} contains an invalid identifier`);
  return value;
}

function value(row: SourceRow, ...names: string[]): unknown {
  for (const name of names) if (row[name] !== undefined && row[name] !== null) return row[name];
  return undefined;
}

function text(row: SourceRow, ...names: string[]): string | undefined {
  const found = value(row, ...names);
  return found === undefined ? undefined : String(found).trim();
}

function sourceKey(row: SourceRow, fallback: string): string {
  return text(row, 'id', 'uuid', 'user_id', 'episode_id', 'slug', 'code') ?? fallback;
}

function increment(entity: string): void {
  report.counts[entity] = (report.counts[entity] ?? 0) + 1;
}

async function rows(connection: Awaited<ReturnType<typeof createConnection>>, table: string): Promise<SourceRow[]> {
  const [result] = await connection.query<SourceRow[]>(`SELECT * FROM \`${table}\` LIMIT ?`, [maxRows]);
  return result;
}

async function record(sourceTable: string, sourceKeyValue: string, targetEntity: string, targetId: string): Promise<void> {
  if (!dryRun) {
    await prisma.legacyMigrationRecord.create({
      data: { runId, sourceTable, sourceKey: sourceKeyValue, targetEntity, targetId },
    });
  }
  increment(targetEntity);
}

async function migrateUsers(connection: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  const table = tableName('LEGACY_USERS_TABLE');
  if (!table) return;
  const dummyHash = required('ARGON2_DUMMY_HASH');
  const seen = new Set<string>();
  for (const [index, row] of (await rows(connection, table)).entries()) {
    const email = text(row, 'email', 'email_address')?.toLowerCase();
    if (!email || !email.includes('@')) { report.errors.push(`${table}:${index} invalid email`); continue; }
    if (seen.has(email)) { report.duplicates.push(`${table}:${email}`); continue; }
    seen.add(email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { report.duplicates.push(`${table}:${email}`); continue; }
    const username = (text(row, 'username', 'user_name', 'name') ?? `legacy_${sourceKey(row, String(index))}`).slice(0, 80);
    const legacyHash = text(row, 'password_hash', 'password', 'pass');
    const passwordHash = legacyHash?.startsWith('$argon2') ? legacyHash : dummyHash;
    const status = legacyHash?.startsWith('$argon2') ? UserStatus.ACTIVE : UserStatus.DISABLED;
    if (!dryRun) {
      const created = await prisma.user.create({ data: { email, username, passwordHash, status } });
      await record(table, sourceKey(row, String(index)), 'User', created.id);
    } else increment('User');
  }
}

async function migratePlans(connection: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  const table = tableName('LEGACY_PLANS_TABLE');
  if (!table) return;
  for (const [index, row] of (await rows(connection, table)).entries()) {
    const code = (text(row, 'code', 'slug') ?? `legacy_plan_${index}`).toLowerCase().slice(0, 50);
    const name = (text(row, 'name', 'title') ?? code).slice(0, 120);
    const pricePkr = Number(value(row, 'price_pkr', 'price', 'amount') ?? 0);
    const durationDays = Number(value(row, 'duration_days', 'days', 'duration') ?? 30);
    if (!Number.isInteger(pricePkr) || pricePkr < 0 || !Number.isInteger(durationDays) || durationDays < 1) {
      report.errors.push(`${table}:${index} invalid plan values`); continue;
    }
    const existing = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (existing) { report.duplicates.push(`${table}:${code}`); continue; }
    if (!dryRun) {
      const created = await prisma.subscriptionPlan.create({ data: { code, name, pricePkr, durationDays, isActive: true } });
      await record(table, sourceKey(row, code), 'SubscriptionPlan', created.id);
    } else increment('SubscriptionPlan');
  }
}

async function migrateDramas(connection: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  const table = tableName('LEGACY_DRAMAS_TABLE');
  if (!table) return;
  for (const [index, row] of (await rows(connection, table)).entries()) {
    const slug = (text(row, 'slug', 'code') ?? `legacy-drama-${index}`).toLowerCase().slice(0, 220);
    const name = (text(row, 'name', 'title') ?? slug).slice(0, 200);
    const existing = await prisma.drama.findUnique({ where: { slug } });
    if (existing) { report.duplicates.push(`${table}:${slug}`); continue; }
    if (!dryRun) {
      const created = await prisma.drama.create({ data: { name, slug, description: text(row, 'description', 'details') } });
      await record(table, sourceKey(row, slug), 'Drama', created.id);
    } else increment('Drama');
  }
}

async function migrateSeasons(connection: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  const table = tableName('LEGACY_SEASONS_TABLE');
  if (!table) return;
  for (const [index, row] of (await rows(connection, table)).entries()) {
    const dramaSlug = text(row, 'drama_slug', 'drama_code', 'slug_parent');
    const seasonNumber = Number(value(row, 'season_number', 'season', 'number') ?? 1);
    if (!dramaSlug || !Number.isInteger(seasonNumber) || seasonNumber < 1) { report.errors.push(`${table}:${index} invalid season`); continue; }
    const drama = await prisma.drama.findUnique({ where: { slug: dramaSlug.toLowerCase() } });
    if (!drama) { report.errors.push(`${table}:${index} drama not found`); continue; }
    const existing = await prisma.season.findUnique({ where: { dramaId_seasonNumber: { dramaId: drama.id, seasonNumber } } });
    if (existing) { report.duplicates.push(`${table}:${dramaSlug}:${seasonNumber}`); continue; }
    if (!dryRun) {
      const created = await prisma.season.create({ data: { dramaId: drama.id, seasonNumber, title: text(row, 'title', 'name') } });
      await record(table, sourceKey(row, `${dramaSlug}:${seasonNumber}`), 'Season', created.id);
    } else increment('Season');
  }
}

async function main(): Promise<void> {
  const connection = await createConnection(required('LEGACY_DATABASE_URL'));
  try {
    await migrateUsers(connection);
    await migratePlans(connection);
    await migrateDramas(connection);
    await migrateSeasons(connection);
    report.completedAt = new Date().toISOString();
    await mkdir('var/migration-reports', { recursive: true });
    await writeFile(`var/migration-reports/${runId}.json`, JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify(report) + '\n');
    if (report.errors.length > 0) process.exitCode = 2;
  } finally {
    await connection.end();
    await prisma.$disconnect();
  }
}

void main().catch(async (error: unknown) => {
  report.errors.push(error instanceof Error ? error.message : 'migration failed');
  await mkdir('var/migration-reports', { recursive: true });
  await writeFile(`var/migration-reports/${runId}.json`, JSON.stringify(report, null, 2));
  process.stderr.write(JSON.stringify({ runId, error: report.errors.at(-1) }) + '\n');
  await prisma.$disconnect();
  process.exitCode = 1;
});
