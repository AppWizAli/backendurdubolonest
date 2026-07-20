-- Private per-user favourites. The composite unique index prevents duplicate
-- saves and the foreign keys prevent an orphaned favourite after account or
-- content removal.
CREATE TABLE "favorite_dramas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "drama_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_dramas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorite_dramas_user_id_drama_id_key"
    ON "favorite_dramas"("user_id", "drama_id");
CREATE INDEX "favorite_dramas_user_id_created_at_idx"
    ON "favorite_dramas"("user_id", "created_at");

ALTER TABLE "favorite_dramas"
    ADD CONSTRAINT "favorite_dramas_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorite_dramas"
    ADD CONSTRAINT "favorite_dramas_drama_id_fkey"
    FOREIGN KEY ("drama_id") REFERENCES "dramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
