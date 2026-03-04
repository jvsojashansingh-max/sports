CREATE TABLE "match_checkins" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "side" "TeamSide" NOT NULL,
  "present" BOOLEAN NOT NULL,
  "checked_in_at" TIMESTAMPTZ,
  "checked_in_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "match_checkins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_checkins_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "match_checkins_match_id_side_key" ON "match_checkins"("match_id", "side");
CREATE INDEX "idx_match_checkins_match" ON "match_checkins"("match_id");
