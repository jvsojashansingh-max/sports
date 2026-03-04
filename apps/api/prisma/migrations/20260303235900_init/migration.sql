CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'VENDOR_OWNER', 'VENDOR_STAFF', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'PENDING');
CREATE TYPE "IdentityProvider" AS ENUM ('PHONE_OTP', 'GOOGLE');
CREATE TYPE "VendorStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'LIVE', 'SUSPENDED');
CREATE TYPE "PaymentMode" AS ENUM ('PAY_ON_SPOT', 'VENDOR_QR', 'VENDOR_LINK');
CREATE TYPE "SportId" AS ENUM ('BADMINTON', 'PICKLEBALL', 'TENNIS', 'BASKETBALL', 'TABLE_TENNIS');
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "default_city_id" UUID,
  "display_name" TEXT,
  "avatar_url" TEXT,
  "dob" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_identities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "provider" "IdentityProvider" NOT NULL,
  "provider_subject" TEXT NOT NULL,
  "email" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "refresh_token_hash" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "object_type" TEXT NOT NULL,
  "object_id" UUID NOT NULL,
  "before_json" JSONB,
  "after_json" JSONB,
  "ip" TEXT,
  "device_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_keys" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "otp_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "phone" TEXT NOT NULL,
  "otp_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vendors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "status" "VendorStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "approved_at" TIMESTAMPTZ,
  "business_name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vendors_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "venues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "city_id" UUID NOT NULL,
  "state_id" UUID NOT NULL,
  "address" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "photos" JSONB,
  "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
  "payment_instructions" TEXT,
  "payment_mode" "PaymentMode" NOT NULL DEFAULT 'PAY_ON_SPOT',
  "vendor_payment_link" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venues_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "resources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venue_id" UUID NOT NULL,
  "sport_id" "SportId" NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "resources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resources_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_identities_provider_provider_subject_key" ON "user_identities"("provider", "provider_subject");
CREATE UNIQUE INDEX "idempotency_keys_user_id_endpoint_key_key" ON "idempotency_keys"("user_id", "endpoint", "key");

CREATE INDEX "idx_users_city" ON "users"("role", "default_city_id");
CREATE INDEX "idx_users_status" ON "users"("status");
CREATE INDEX "idx_user_identities_user" ON "user_identities"("user_id");
CREATE INDEX "idx_sessions_user" ON "sessions"("user_id", "revoked_at");
CREATE INDEX "idx_sessions_device" ON "sessions"("device_id");
CREATE INDEX "idx_audit_object" ON "audit_logs"("object_type", "object_id", "created_at" DESC);
CREATE INDEX "idx_audit_actor" ON "audit_logs"("actor_user_id", "created_at" DESC);
CREATE INDEX "idx_otp_phone_recent" ON "otp_requests"("phone", "created_at" DESC);
CREATE INDEX "idx_otp_expires_at" ON "otp_requests"("expires_at");
CREATE INDEX "idx_vendors_status" ON "vendors"("status");
CREATE INDEX "idx_vendors_owner" ON "vendors"("owner_user_id");
CREATE INDEX "idx_venues_city" ON "venues"("city_id", "status");
CREATE INDEX "idx_venues_vendor" ON "venues"("vendor_id");
CREATE INDEX "idx_resources_venue" ON "resources"("venue_id", "sport_id");
