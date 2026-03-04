CREATE TYPE "LeaderboardScope" AS ENUM ('CITY', 'STATE', 'ALL');
CREATE TYPE "LeaderboardWindow" AS ENUM ('WEEKLY', 'MONTHLY', 'ALL_TIME');
CREATE TYPE "ReviewType" AS ENUM ('VENUE', 'PLAYER');

CREATE TABLE "sport_stats" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "sport_id" "SportId" NOT NULL,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "matches" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 1,
  "rating" INTEGER NOT NULL DEFAULT 1000,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "sport_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "level_thresholds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sport_id" "SportId" NOT NULL,
  "level" INTEGER NOT NULL,
  "wins_required" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "level_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leaderboard_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sport_id" "SportId" NOT NULL,
  "scope" "LeaderboardScope" NOT NULL,
  "geo_id" UUID,
  "window" "LeaderboardWindow" NOT NULL,
  "snapshot_ts" TIMESTAMPTZ NOT NULL,
  "rows" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ReviewType" NOT NULL,
  "match_id" UUID NOT NULL,
  "reviewer_user_id" UUID NOT NULL,
  "target_venue_id" UUID,
  "target_user_id" UUID,
  "rating" INTEGER NOT NULL,
  "text" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sport_stats_user_id_sport_id_key" ON "sport_stats"("user_id", "sport_id");
CREATE INDEX "idx_stats_sport_city" ON "sport_stats"("sport_id", "wins" DESC);

CREATE UNIQUE INDEX "level_thresholds_sport_id_level_key" ON "level_thresholds"("sport_id", "level");

CREATE INDEX "idx_leaderboard_lookup" ON "leaderboard_snapshots"("sport_id", "scope", "geo_id", "window", "snapshot_ts" DESC);

CREATE UNIQUE INDEX "reviews_match_id_reviewer_user_id_type_key" ON "reviews"("match_id", "reviewer_user_id", "type");
CREATE INDEX "idx_reviews_venue" ON "reviews"("target_venue_id", "created_at");
CREATE INDEX "idx_reviews_user" ON "reviews"("target_user_id", "created_at");
