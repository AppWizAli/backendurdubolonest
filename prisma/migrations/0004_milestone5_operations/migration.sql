-- Milestone 5 operational traceability and high-selectivity content indexes.
CREATE TABLE "legacy_migration_records" (
    "id" UUID NOT NULL,
    "run_id" VARCHAR(80) NOT NULL,
    "source_table" VARCHAR(120) NOT NULL,
    "source_key" VARCHAR(160) NOT NULL,
    "target_entity" VARCHAR(80) NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legacy_migration_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legacy_migration_records_run_id_target_entity_source_key_key"
  ON "legacy_migration_records" ("run_id", "target_entity", "source_key");
CREATE INDEX "legacy_migration_records_run_id_idx" ON "legacy_migration_records" ("run_id");
CREATE INDEX "legacy_migration_records_target_entity_target_id_idx"
  ON "legacy_migration_records" ("target_entity", "target_id");
CREATE INDEX "episodes_status_visibility_published_deleted_at_idx"
  ON "episodes" ("status", "visibility", "is_published", "deleted_at");
CREATE INDEX "episodes_season_id_status_deleted_at_idx"
  ON "episodes" ("season_id", "status", "deleted_at");
