import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const runId = process.env.MIGRATION_RUN_ID;

async function main(): Promise<void> {
  if (!runId) throw new Error('MIGRATION_RUN_ID is required');
  if (process.env.CONFIRM_ROLLBACK !== 'YES') throw new Error('Set CONFIRM_ROLLBACK=YES to run a migration rollback');
  const records = await prisma.legacyMigrationRecord.findMany({ where: { runId } });
  const order = ['Season', 'Drama', 'SubscriptionPlan', 'User'];
  const failures: string[] = [];
  for (const entity of order) {
    for (const record of records.filter((item) => item.targetEntity === entity)) {
      try {
        if (entity === 'Season') await prisma.season.delete({ where: { id: record.targetId } });
        if (entity === 'Drama') await prisma.drama.delete({ where: { id: record.targetId } });
        if (entity === 'SubscriptionPlan') await prisma.subscriptionPlan.delete({ where: { id: record.targetId } });
        if (entity === 'User') await prisma.user.delete({ where: { id: record.targetId } });
        await prisma.legacyMigrationRecord.delete({ where: { id: record.id } });
      } catch (error: unknown) {
        failures.push(`${entity}:${record.targetId}:${error instanceof Error ? error.message : 'delete failed'}`);
      }
    }
  }
  process.stdout.write(JSON.stringify({ runId, removed: records.length - failures.length, failures }) + '\n');
  if (failures.length > 0) process.exitCode = 2;
}

void main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : 'rollback failed' }) + '\n');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
