CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "BookingType" AS ENUM ('CHALLENGE', 'TOURNAMENT', 'CASUAL');
CREATE TYPE "BookingStatus" AS ENUM ('HELD', 'WAITING_OPPONENT', 'CONFIRMED', 'CHECKIN_OPEN', 'IN_PROGRESS', 'RESULT_PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "bookings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL,
  "start_ts" TIMESTAMPTZ NOT NULL,
  "end_ts" TIMESTAMPTZ NOT NULL,
  "type" "BookingType" NOT NULL,
  "status" "BookingStatus" NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "hold_expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_bookings_resource_time" ON "bookings"("resource_id", "start_ts");
CREATE INDEX "idx_bookings_status" ON "bookings"("status", "start_ts");

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_no_overlap"
EXCLUDE USING gist (
  "resource_id" WITH =,
  tstzrange("start_ts", "end_ts", '[)') WITH &&
)
WHERE (
  "status" IN ('HELD', 'WAITING_OPPONENT', 'CONFIRMED', 'CHECKIN_OPEN', 'IN_PROGRESS', 'RESULT_PENDING')
);
