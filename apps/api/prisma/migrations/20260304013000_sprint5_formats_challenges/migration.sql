CREATE TYPE "ChallengeStatus" AS ENUM ('WAITING_OPPONENT', 'OPPONENT_REQUESTED', 'CONFIRMED', 'CANCELLED', 'CLOSED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNKNOWN', 'PAID', 'UNPAID');
CREATE TYPE "TeamSide" AS ENUM ('A', 'B');

CREATE TABLE "formats" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" UUID,
  "sport_id" "SportId" NOT NULL,
  "name" TEXT NOT NULL,
  "team_size" INTEGER NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "rules_text" TEXT NOT NULL,
  "referee_allowed" BOOLEAN NOT NULL DEFAULT FALSE,
  "referee_fee_display" TEXT,
  "join_deadline_minutes" INTEGER NOT NULL DEFAULT 180,
  "checkin_open_minutes" INTEGER NOT NULL DEFAULT 30,
  "no_show_grace_minutes" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "formats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "formats_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "challenges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "sport_id" "SportId" NOT NULL,
  "format_id" UUID NOT NULL,
  "status" "ChallengeStatus" NOT NULL,
  "join_deadline_ts" TIMESTAMPTZ NOT NULL,
  "checkin_open_ts" TIMESTAMPTZ NOT NULL,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "challenges_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "challenges_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "teams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" UUID NOT NULL,
  "side" "TeamSide" NOT NULL,
  "captain_user_id" UUID NOT NULL,
  "is_open_fill" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teams_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "challenges_booking_id_key" ON "challenges"("booking_id");
CREATE UNIQUE INDEX "teams_challenge_id_side_key" ON "teams"("challenge_id", "side");
CREATE INDEX "idx_formats_vendor" ON "formats"("vendor_id", "sport_id", "enabled");
CREATE INDEX "idx_challenges_feed" ON "challenges"("status", "join_deadline_ts");
CREATE INDEX "idx_challenges_city_sport" ON "challenges"("status", "sport_id");
CREATE INDEX "idx_teams_captain" ON "teams"("captain_user_id");
