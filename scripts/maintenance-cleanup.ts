import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const retentionDays = Number(process.env.PLAYBACK_HEARTBEAT_RETENTION_DAYS ?? 30);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--apply')) {
    throw new Error('Production cleanup requires the --apply flag');
  }
  if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 365) throw new Error('Invalid retention period');
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const expired = await prisma.playbackSession.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED', closedAt: new Date() },
  });
  const heartbeats = await prisma.playbackHeartbeat.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const refreshSessions = await prisma.refreshSession.deleteMany({
    where: { expiresAt: { lt: new Date() }, revokedAt: { not: null } },
  });
  process.stdout.write(JSON.stringify({ expiredPlaybackSessions: expired.count, deletedHeartbeats: heartbeats.count, deletedRefreshSessions: refreshSessions.count, cutoff }) + '\n');
}

void main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : 'cleanup failed' }) + '\n');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
