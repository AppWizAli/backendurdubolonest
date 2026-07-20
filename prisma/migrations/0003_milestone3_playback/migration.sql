-- Milestone 3 secure playback state. Provider locators remain encrypted and are never copied here.
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "PlaybackStatus" AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED', 'REVOKED');

CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "device_name" VARCHAR(160),
    "fingerprint_hash" CHAR(64) NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playback_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "trusted_device_id" UUID NOT NULL,
    "capability_jti" CHAR(36) NOT NULL,
    "capability_hash" CHAR(64) NOT NULL,
    "device_fingerprint_hash" CHAR(64) NOT NULL,
    "ip_address" INET NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "status" "PlaybackStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playback_heartbeats" (
    "id" UUID NOT NULL,
    "playback_session_id" UUID NOT NULL,
    "position_seconds" INTEGER NOT NULL,
    "buffered_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playback_heartbeats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playback_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "playback_session_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "playback_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trusted_devices_user_id_device_id_key" ON "trusted_devices" ("user_id", "device_id");
CREATE INDEX "trusted_devices_user_id_status_idx" ON "trusted_devices" ("user_id", "status");
CREATE UNIQUE INDEX "playback_sessions_capability_jti_key" ON "playback_sessions" ("capability_jti");
CREATE UNIQUE INDEX "playback_sessions_capability_hash_key" ON "playback_sessions" ("capability_hash");
CREATE INDEX "playback_sessions_user_id_status_expires_at_idx" ON "playback_sessions" ("user_id", "status", "expires_at");
CREATE INDEX "playback_sessions_trusted_device_id_status_expires_at_idx" ON "playback_sessions" ("trusted_device_id", "status", "expires_at");
CREATE INDEX "playback_sessions_episode_id_status_idx" ON "playback_sessions" ("episode_id", "status");
CREATE INDEX "playback_heartbeats_playback_session_id_created_at_idx" ON "playback_heartbeats" ("playback_session_id", "created_at");
CREATE UNIQUE INDEX "playback_history_playback_session_id_key" ON "playback_history" ("playback_session_id");
CREATE UNIQUE INDEX "playback_history_user_id_episode_id_key" ON "playback_history" ("user_id", "episode_id");
CREATE INDEX "playback_history_user_id_updated_at_idx" ON "playback_history" ("user_id", "updated_at");

ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_trusted_device_id_fkey" FOREIGN KEY ("trusted_device_id") REFERENCES "trusted_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playback_heartbeats" ADD CONSTRAINT "playback_heartbeats_playback_session_id_fkey" FOREIGN KEY ("playback_session_id") REFERENCES "playback_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_playback_session_id_fkey" FOREIGN KEY ("playback_session_id") REFERENCES "playback_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_window_valid" CHECK ("expires_at" > "started_at");
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_positions_nonnegative" CHECK ("last_position_seconds" >= 0 AND "watched_seconds" >= 0);
ALTER TABLE "playback_heartbeats" ADD CONSTRAINT "playback_heartbeats_positions_nonnegative" CHECK ("position_seconds" >= 0 AND ("buffered_seconds" IS NULL OR "buffered_seconds" >= 0));
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_positions_nonnegative" CHECK ("last_position_seconds" >= 0 AND "watched_seconds" >= 0);
