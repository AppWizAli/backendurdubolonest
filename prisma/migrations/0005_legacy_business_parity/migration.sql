-- Legacy business parity: communications, discovery, app distribution, settings,
-- subscription requests, security reporting, comments, and view analytics.
ALTER TABLE "users" ADD COLUMN "device_token" VARCHAR(512);
ALTER TABLE "dramas"
  ADD COLUMN "drama_number" INTEGER,
  ADD COLUMN "total_seasons" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "seasons"
  ADD COLUMN "total_episodes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "thumbnail_key" VARCHAR(512);
CREATE TYPE "DownloadAccess" AS ENUM ('GALLERY', 'APP_STORAGE', 'BOTH', 'NEVER');
ALTER TABLE "episodes" ADD COLUMN "download_access" "DownloadAccess" NOT NULL DEFAULT 'GALLERY';
ALTER TABLE "group_members"
  ADD COLUMN "comment" TEXT,
  ADD COLUMN "subscription" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "image_key" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_created_at_idx" ON "notifications" ("created_at");
CREATE INDEX "notifications_deleted_at_created_at_idx" ON "notifications" ("deleted_at", "created_at");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_recipients_notification_id_user_id_key"
  ON "notification_recipients" ("notification_id", "user_id");
CREATE INDEX "notification_recipients_user_id_read_at_created_at_idx"
  ON "notification_recipients" ("user_id", "read_at", "created_at");
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sender_id" UUID,
    "group_id" UUID,
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unread',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "read_at" TIMESTAMP(3),
    CONSTRAINT "user_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_messages_user_id_status_created_at_idx" ON "user_messages" ("user_id", "status", "created_at");
CREATE INDEX "user_messages_group_id_created_at_idx" ON "user_messages" ("group_id", "created_at");
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "access_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "image_key" VARCHAR(512),
    "video_key" VARCHAR(512),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "banners_is_active_deleted_at_created_at_idx" ON "banners" ("is_active", "deleted_at", "created_at");

CREATE TABLE "trending_dramas" (
    "id" UUID NOT NULL,
    "drama_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trending_dramas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trending_dramas_position_key" ON "trending_dramas" ("position");
CREATE UNIQUE INDEX "trending_dramas_drama_id_key" ON "trending_dramas" ("drama_id");
CREATE INDEX "trending_dramas_position_idx" ON "trending_dramas" ("position");
ALTER TABLE "trending_dramas" ADD CONSTRAINT "trending_dramas_drama_id_fkey"
  FOREIGN KEY ("drama_id") REFERENCES "dramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_releases" (
    "id" UUID NOT NULL,
    "version_name" VARCHAR(60),
    "version_code" INTEGER,
    "storage_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255),
    "file_size" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "app_releases_is_active_created_at_idx" ON "app_releases" ("is_active", "created_at");
CREATE INDEX "app_releases_version_code_idx" ON "app_releases" ("version_code");
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "remote_config" (
    "id" UUID NOT NULL,
    "config_key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "remote_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "remote_config_config_key_key" ON "remote_config" ("config_key");
CREATE INDEX "remote_config_is_active_updated_at_idx" ON "remote_config" ("is_active", "updated_at");

CREATE TABLE "subscription_settings" (
    "id" UUID NOT NULL,
    "monthly_amount_pkr" INTEGER NOT NULL DEFAULT 1000,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'PKR',
    "default_group_id" UUID,
    "jazzcash_number" VARCHAR(50),
    "jazzcash_title" VARCHAR(160),
    "easypaisa_number" VARCHAR(50),
    "easypaisa_title" VARCHAR(160),
    "bank_name" VARCHAR(160),
    "bank_account_title" VARCHAR(160),
    "bank_account_number" VARCHAR(80),
    "bank_iban" VARCHAR(80),
    "payment_instructions" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_settings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "subscription_settings" ADD CONSTRAINT "subscription_settings_default_group_id_fkey"
  FOREIGN KEY ("default_group_id") REFERENCES "access_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "subscription_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID,
    "plan_id" UUID,
    "amount_pkr" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'PKR',
    "payment_method" VARCHAR(40),
    "screenshot_key" VARCHAR(512),
    "note" TEXT,
    "details_snapshot" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "invoice_no" VARCHAR(80),
    "months_added" INTEGER NOT NULL DEFAULT 1,
    "subscription_start_date" DATE,
    "subscription_end_date" DATE,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscription_requests_invoice_no_key" ON "subscription_requests" ("invoice_no");
CREATE INDEX "subscription_requests_user_id_status_created_at_idx" ON "subscription_requests" ("user_id", "status", "created_at");
CREATE INDEX "subscription_requests_status_created_at_idx" ON "subscription_requests" ("status", "created_at");
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "access_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "security_blocks" (
    "user_id" UUID NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "blocked_by_id" UUID,
    "blocked_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "security_blocks_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "security_blocks" ADD CONSTRAINT "security_blocks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_incidents" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "incident_type" VARCHAR(80) NOT NULL,
    "incident_label" VARCHAR(160),
    "app_area" VARCHAR(120),
    "device_model" VARCHAR(160),
    "manufacturer" VARCHAR(120),
    "android_version" VARCHAR(60),
    "app_version" VARCHAR(60),
    "app_version_code" INTEGER,
    "package_name" VARCHAR(160),
    "device_id" VARCHAR(160),
    "device_brand" VARCHAR(120),
    "device_product" VARCHAR(160),
    "device_hardware" VARCHAR(160),
    "device_fingerprint" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location_accuracy" REAL,
    "extra" JSONB,
    "ip_address" INET,
    "severity" VARCHAR(30) NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "security_incidents_created_at_idx" ON "security_incidents" ("created_at");
CREATE INDEX "security_incidents_user_id_idx" ON "security_incidents" ("user_id");
CREATE INDEX "security_incidents_incident_type_idx" ON "security_incidents" ("incident_type");
CREATE INDEX "security_incidents_device_id_idx" ON "security_incidents" ("device_id");
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "content_comments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "episode_id" UUID,
    "group_id" UUID,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "content_comments_episode_id_status_created_at_idx" ON "content_comments" ("episode_id", "status", "created_at");
CREATE INDEX "content_comments_user_id_created_at_idx" ON "content_comments" ("user_id", "created_at");
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "video_views" (
    "id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" VARCHAR(512),
    CONSTRAINT "video_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "video_views_episode_id_viewed_at_idx" ON "video_views" ("episode_id", "viewed_at");
CREATE INDEX "video_views_user_id_viewed_at_idx" ON "video_views" ("user_id", "viewed_at");
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
