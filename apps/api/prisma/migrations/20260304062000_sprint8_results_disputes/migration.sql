CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED');
CREATE TYPE "MessageReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

CREATE TABLE "match_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "submitted_by_user_id" UUID NOT NULL,
  "winner_side" "TeamSide" NOT NULL,
  "score_json" JSONB,
  "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "match_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "disputes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "status" "DisputeStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "resolved_by_user_id" UUID,
  "resolution_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "disputes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "message_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "reported_by_user_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "MessageReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "match_results_match_id_submitted_by_user_id_key" ON "match_results"("match_id", "submitted_by_user_id");
CREATE INDEX "idx_match_results_match" ON "match_results"("match_id");

CREATE UNIQUE INDEX "disputes_match_id_key" ON "disputes"("match_id");
CREATE INDEX "idx_disputes_status" ON "disputes"("status", "created_at");

CREATE INDEX "idx_reports_status" ON "message_reports"("status", "created_at");
