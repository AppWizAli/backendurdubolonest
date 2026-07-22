CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'WAITING', 'RESOLVED', 'BLOCKED');
CREATE TYPE "SupportMessageSenderType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');
CREATE TYPE "SupportMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'VOICE', 'FILE', 'SYSTEM');
CREATE TYPE "SupportMessageStatus" AS ENUM ('SENT', 'DELIVERED', 'SEEN');

CREATE TABLE "support_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "assigned_admin_id" UUID,
  "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
  "last_message_id" UUID,
  "last_message_at" TIMESTAMP(3),
  "user_unread_count" INTEGER NOT NULL DEFAULT 0,
  "admin_unread_count" INTEGER NOT NULL DEFAULT 0,
  "user_last_seen_at" TIMESTAMP(3),
  "admin_last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "sender_type" "SupportMessageSenderType" NOT NULL,
  "sender_id" UUID,
  "message_type" "SupportMessageType" NOT NULL DEFAULT 'TEXT',
  "text" TEXT,
  "media_url" VARCHAR(2048),
  "thumbnail" VARCHAR(2048),
  "voice_duration" INTEGER,
  "file_size" BIGINT,
  "mime_type" VARCHAR(160),
  "reply_to_message_id" UUID,
  "status" "SupportMessageStatus" NOT NULL DEFAULT 'SENT',
  "delivered_at" TIMESTAMP(3),
  "seen_at" TIMESTAMP(3),
  "deleted_by_user" BOOLEAN NOT NULL DEFAULT false,
  "deleted_by_admin" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_message_reads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_message_reads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_uploads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "message_id" UUID,
  "upload_id" UUID,
  "storage_key" VARCHAR(1024) NOT NULL,
  "original_name" VARCHAR(255),
  "mime_type" VARCHAR(160),
  "file_size" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_conversations_user_id_key" ON "support_conversations"("user_id");
CREATE INDEX "support_conversations_status_last_message_at_idx" ON "support_conversations"("status", "last_message_at");
CREATE INDEX "support_conversations_assigned_admin_id_status_idx" ON "support_conversations"("assigned_admin_id", "status");
CREATE INDEX "support_conversations_deleted_at_last_message_at_idx" ON "support_conversations"("deleted_at", "last_message_at");
CREATE INDEX "support_messages_conversation_id_created_at_idx" ON "support_messages"("conversation_id", "created_at");
CREATE INDEX "support_messages_sender_id_created_at_idx" ON "support_messages"("sender_id", "created_at");
CREATE INDEX "support_messages_status_created_at_idx" ON "support_messages"("status", "created_at");
CREATE UNIQUE INDEX "support_message_reads_message_id_user_id_key" ON "support_message_reads"("message_id", "user_id");
CREATE INDEX "support_message_reads_conversation_id_user_id_read_at_idx" ON "support_message_reads"("conversation_id", "user_id", "read_at");
CREATE INDEX "support_uploads_conversation_id_created_at_idx" ON "support_uploads"("conversation_id", "created_at");
CREATE INDEX "support_uploads_message_id_idx" ON "support_uploads"("message_id");

ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "support_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_message_reads" ADD CONSTRAINT "support_message_reads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_message_reads" ADD CONSTRAINT "support_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_message_reads" ADD CONSTRAINT "support_message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_uploads" ADD CONSTRAINT "support_uploads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_uploads" ADD CONSTRAINT "support_uploads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
