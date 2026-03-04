CREATE TYPE "TournamentFormatType" AS ENUM ('SINGLE_ELIM');
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REG_OPEN', 'REG_CLOSED', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TournamentEntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

CREATE TABLE "tournaments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venue_id" UUID NOT NULL,
  "sport_id" "SportId" NOT NULL,
  "format_type" "TournamentFormatType" NOT NULL,
  "rules_json" JSONB NOT NULL,
  "status" "TournamentStatus" NOT NULL,
  "registration_deadline" TIMESTAMPTZ NOT NULL,
  "start_ts" TIMESTAMPTZ NOT NULL,
  "bracket_version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournaments_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "tournament_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tournament_id" UUID NOT NULL,
  "team_id" UUID,
  "captain_user_id" UUID NOT NULL,
  "status" "TournamentEntryStatus" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_entries_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "tournament_matches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tournament_id" UUID NOT NULL,
  "round" INTEGER NOT NULL,
  "match_index" INTEGER NOT NULL,
  "resource_id" UUID,
  "start_ts" TIMESTAMPTZ,
  "status" "MatchStatus" NOT NULL,
  "side_a_entry_id" UUID,
  "side_b_entry_id" UUID,
  "winner_entry_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "tournament_brackets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tournament_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "bracket_json" JSONB NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "tournament_brackets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_brackets_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_tournament_id_fkey"
FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_tournaments_city_sport" ON "tournaments"("sport_id", "start_ts");
CREATE INDEX "idx_entries_tournament" ON "tournament_entries"("tournament_id", "status");
CREATE UNIQUE INDEX "tournament_matches_tournament_id_round_match_index_key" ON "tournament_matches"("tournament_id", "round", "match_index");
CREATE INDEX "idx_tournament_matches_time" ON "tournament_matches"("tournament_id", "start_ts");
CREATE UNIQUE INDEX "tournament_brackets_tournament_id_version_key" ON "tournament_brackets"("tournament_id", "version");
