import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Milestone 1 migration', () => {
  const migration = readFileSync(resolve(__dirname, '../prisma/migrations/0001_milestone1/migration.sql'), 'utf8');
  it('contains the core security and access tables', () => {
    expect(migration).toContain('CREATE TABLE "users"');
    expect(migration).toContain('CREATE TABLE "refresh_sessions"');
    expect(migration).toContain('CREATE TABLE "audit_events"');
    expect(migration).toContain('CREATE TABLE "episode_grants"');
  });
  it('contains database-level access invariants', () => {
    expect(migration).toContain('episode_grants_subject_exactly_one');
    expect(migration).toContain('episode_grants_window_valid');
    expect(migration).toContain('users_email_lower_key');
  });

  it('contains the Milestone 2 content and media migration', () => {
    const contentMigration = readFileSync(resolve(__dirname, '../prisma/migrations/0002_milestone2_content/migration.sql'), 'utf8');
    expect(contentMigration).toContain('CREATE TYPE "ContentVisibility"');
    expect(contentMigration).toContain('CREATE TYPE "EpisodeStatus"');
    expect(contentMigration).toContain('ADD COLUMN "is_premium"');
    expect(contentMigration).toContain('ADD COLUMN "media_type"');
    expect(contentMigration).toContain('media_assets_version_positive');
  });

  it('contains the Milestone 3 playback state and device migration', () => {
    const playbackMigration = readFileSync(resolve(__dirname, '../prisma/migrations/0003_milestone3_playback/migration.sql'), 'utf8');
    expect(playbackMigration).toContain('CREATE TABLE "trusted_devices"');
    expect(playbackMigration).toContain('CREATE TABLE "playback_sessions"');
    expect(playbackMigration).toContain('CREATE TABLE "playback_heartbeats"');
    expect(playbackMigration).toContain('CREATE TABLE "playback_history"');
    expect(playbackMigration).toContain('playback_sessions_positions_nonnegative');
  });

  it('contains the Milestone 5 operational traceability and query indexes', () => {
    const operationsMigration = readFileSync(resolve(__dirname, '../prisma/migrations/0004_milestone5_operations/migration.sql'), 'utf8');
    expect(operationsMigration).toContain('CREATE TABLE "legacy_migration_records"');
    expect(operationsMigration).toContain('legacy_migration_records_run_id_idx');
    expect(operationsMigration).toContain('episodes_status_visibility_published_deleted_at_idx');
  });

  it('contains the legacy business parity tables and playback policy fields', () => {
    const parityMigration = readFileSync(resolve(__dirname, '../prisma/migrations/0005_legacy_business_parity/migration.sql'), 'utf8');
    expect(parityMigration).toContain('CREATE TABLE "notifications"');
    expect(parityMigration).toContain('CREATE TABLE "subscription_requests"');
    expect(parityMigration).toContain('CREATE TABLE "security_incidents"');
    expect(parityMigration).toContain('ADD COLUMN "download_access"');
    expect(parityMigration).toContain('CREATE TABLE "app_releases"');
  });
});
