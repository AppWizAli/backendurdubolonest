import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';

const prisma = new PrismaClient();
const runId = process.env.MIGRATION_RUN_ID;

async function main(): Promise<void> {
  if (!runId) throw new Error('MIGRATION_RUN_ID is required');
  const records = await prisma.legacyMigrationRecord.findMany({ where: { runId } });
  const report = {
    runId,
    recordCount: records.length,
    byEntity: records.reduce<Record<string, number>>((counts, item) => {
      counts[item.targetEntity] = (counts[item.targetEntity] ?? 0) + 1;
      return counts;
    }, {}),
    foreignKeyChecks: {
      users: await prisma.user.count({ where: { id: { in: records.filter((r) => r.targetEntity === 'User').map((r) => r.targetId) } } }),
      dramas: await prisma.drama.count({ where: { id: { in: records.filter((r) => r.targetEntity === 'Drama').map((r) => r.targetId) } } }),
      seasons: await prisma.season.count({ where: { id: { in: records.filter((r) => r.targetEntity === 'Season').map((r) => r.targetId) } } }),
    },
    verifiedAt: new Date().toISOString(),
  };
  await mkdir('var/migration-reports', { recursive: true });
  await writeFile(`var/migration-reports/${runId}-verification.json`, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + '\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : 'verification failed' }) + '\n');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
