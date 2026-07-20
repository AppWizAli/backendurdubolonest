import { PrismaClient, RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const permissions = [
  ['users.read', 'Read users'], ['users.write', 'Create and update users'], ['users.status', 'Suspend and activate users'], ['users.delete', 'Delete users'],
  ['roles.read', 'Read roles'], ['roles.write', 'Manage roles and role assignments'], ['permissions.read', 'Read permissions'], ['permissions.write', 'Manage permissions and assignments'],
  ['subscriptions.read', 'Read subscriptions'], ['subscriptions.write', 'Manage plans and subscriptions'], ['access.read', 'Read access grants'], ['access.write', 'Manage access groups and grants'],
  ['content.read', 'Read all content administration records'], ['content.write', 'Manage dramas, seasons, and episodes'], ['media.read', 'Read media metadata'], ['media.write', 'Manage media metadata'],
  ['notifications.read', 'Read notifications'], ['notifications.write', 'Create and update notifications'], ['notifications.send', 'Send notifications'], ['messages.write', 'Send messages'],
  ['banners.read', 'Read banners'], ['banners.write', 'Manage banners'], ['trending.read', 'Read trending dramas'], ['trending.write', 'Manage trending dramas'],
  ['app.release.read', 'Read app releases'], ['app.release.write', 'Manage app releases'], ['settings.read', 'Read platform settings'], ['settings.write', 'Manage platform settings'],
  ['security.read', 'Read security incidents'], ['security.write', 'Manage security incidents'], ['analytics.read', 'Read analytics'], ['reports.read', 'Read reports'],
  ['audit.read', 'Read audit events'], ['sessions.read', 'Read sessions'], ['sessions.revoke', 'Revoke sessions'], ['user.self', 'Use personal account features'],
] as const;
const rolePermissions: Record<RoleCode, string[]> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  ADMIN: permissions.filter(([code]) => !code.startsWith('roles.') && !code.startsWith('permissions.')).map(([code]) => code),
  SUB_ADMIN: ['users.read', 'users.write', 'users.status', 'subscriptions.read', 'subscriptions.write', 'access.read', 'access.write', 'content.read', 'content.write', 'media.read', 'media.write', 'notifications.read', 'notifications.write', 'notifications.send', 'messages.write', 'banners.read', 'banners.write', 'trending.read', 'trending.write', 'app.release.read', 'app.release.write', 'settings.read', 'settings.write', 'analytics.read', 'reports.read', 'sessions.read', 'sessions.revoke'],
  MODERATOR: ['users.read', 'access.read', 'subscriptions.read', 'content.read', 'media.read', 'notifications.read', 'banners.read', 'trending.read', 'analytics.read'],
  USER: ['user.self'],
};

async function main(): Promise<void> {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required for seeding');
  if (password.length < 12) throw new Error('SEED_SUPER_ADMIN_PASSWORD must be at least 12 characters');
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const permissionRows = new Map<string, string>();
  for (const [code, description] of permissions) { const permission = await prisma.permission.upsert({ where: { code }, create: { code, description }, update: { description } }); permissionRows.set(code, permission.id); }
  const roles = new Map<RoleCode, string>();
  const roleNames: Record<RoleCode, string> = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', SUB_ADMIN: 'Sub Admin', MODERATOR: 'Moderator', USER: 'User' };
  for (const code of Object.values(RoleCode)) { const role = await prisma.roleDefinition.upsert({ where: { code }, create: { code, name: roleNames[code], systemManaged: true }, update: { name: roleNames[code], systemManaged: true } }); roles.set(code, role.id); for (const permissionCode of rolePermissions[code]) { const permissionId = permissionRows.get(permissionCode); if (permissionId) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId } }, create: { roleId: role.id, permissionId }, update: {} }); } }
  const user = await prisma.user.upsert({ where: { email }, create: { email, username: 'Super Admin', passwordHash: hash, status: 'ACTIVE' }, update: { passwordHash: hash, status: 'ACTIVE', deletedAt: null } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roles.get(RoleCode.SUPER_ADMIN)! } }, create: { userId: user.id, roleId: roles.get(RoleCode.SUPER_ADMIN)! }, update: {} });
  process.stdout.write(`Seeded ${email}\n`);
}

main().catch((error) => { process.stderr.write(`${JSON.stringify(error instanceof Error ? { name: error.name, message: error.message } : error)}\n`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
