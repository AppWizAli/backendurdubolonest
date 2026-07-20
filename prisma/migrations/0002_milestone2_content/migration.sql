-- Milestone 2 content administration metadata. No playback or delivery fields are exposed.
CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "MediaStatus" AS ENUM ('PROCESSING', 'ACTIVE', 'INACTIVE', 'ERROR');
CREATE TYPE "MediaType" AS ENUM ('MP4', 'HLS', 'DASH', 'OTHER');
CREATE TYPE "EpisodeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "episodes"
  ADD COLUMN "visibility" "ContentVisibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "is_premium" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "status" "EpisodeStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "media_assets"
  ADD COLUMN "media_type" "MediaType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'PROCESSING',
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "duration_seconds" INTEGER,
  ADD COLUMN "size_bytes" BIGINT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "media_assets_provider_status_deleted_at_idx"
  ON "media_assets" ("provider", "status", "deleted_at");
CREATE INDEX "media_assets_status_deleted_at_idx"
  ON "media_assets" ("status", "deleted_at");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "media_assets_duration_nonnegative" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  ADD CONSTRAINT "media_assets_size_nonnegative" CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0);
