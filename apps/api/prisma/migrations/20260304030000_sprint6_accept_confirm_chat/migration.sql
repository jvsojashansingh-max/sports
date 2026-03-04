CREATE TYPE "TeamMemberStatus" AS ENUM ('INVITED', 'ACCEPTED', 'REMOVED');
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'CHECKIN_OPEN', 'IN_PROGRESS', 'RESULT_PENDING', 'DISPUTED', 'SETTLED', 'FORFEIT', 'CANCELLED');
CREATE TYPE "ConversationType" AS ENUM ('CHALLENGE', 'TOURNAMENT', 'VENUE_SUPPORT');
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ChatRole" AS ENUM ('MEMBER', 'MODERATOR');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELETED_BY_MOD', 'DELETED_BY_USER');

CREATE TABLE "team_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "team_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "TeamMemberStatus" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "team_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "matches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" UUID,
  "tournament_match_id" UUID,
  "status" "MatchStatus" NOT NULL,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  "vendor_confirmed_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matches_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ConversationType" NOT NULL,
  "challenge_id" UUID,
  "tournament_id" UUID,
  "venue_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversations_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "conversation_participants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_in_chat" "ChatRole" NOT NULL DEFAULT 'MEMBER',
  "muted_until" TIMESTAMPTZ,
  "last_read_message_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "sender_user_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "attachments" JSONB,
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");
CREATE INDEX "idx_team_members_user" ON "team_members"("user_id");

CREATE UNIQUE INDEX "matches_challenge_id_key" ON "matches"("challenge_id");
CREATE UNIQUE INDEX "matches_tournament_match_id_key" ON "matches"("tournament_match_id");
CREATE INDEX "idx_matches_status" ON "matches"("status", "ended_at");

CREATE UNIQUE INDEX "conversations_challenge_id_key" ON "conversations"("challenge_id");
CREATE INDEX "idx_conversations_type" ON "conversations"("type", "status");

CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");
CREATE INDEX "idx_participants_user" ON "conversation_participants"("user_id");

CREATE INDEX "idx_messages_conversation" ON "messages"("conversation_id", "created_at");
CREATE INDEX "idx_messages_sender" ON "messages"("sender_user_id", "created_at");
