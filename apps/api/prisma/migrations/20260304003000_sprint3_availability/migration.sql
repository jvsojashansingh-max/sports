CREATE TABLE "availability_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "slot_minutes" INTEGER NOT NULL,
  "buffer_minutes" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "availability_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_templates_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL,
  "start_ts" TIMESTAMPTZ NOT NULL,
  "end_ts" TIMESTAMPTZ NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blocks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_availability_resource" ON "availability_templates"("resource_id", "day_of_week");
CREATE INDEX "idx_blocks_resource" ON "blocks"("resource_id", "start_ts");
