import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { SportId, TeamSide, UserRole, UserStatus, VendorStatus, VenueStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestUser } from '../../common/auth/request-user';
import type { ChatGateway } from '../chat/chat.gateway';
import { ChallengesService } from './challenges.service';

test('db integration: accept race allows exactly one opponent', async (t) => {
  const prisma = new PrismaService();
  const connected = await canConnect(prisma);
  if (!connected) {
    t.skip('Postgres not reachable; skipping DB integration test');
    return;
  }

  const fixture = await seedFixture(prisma);
  const service = buildService(prisma);
  const creator = asPlayer(fixture.playerAId);
  const acceptorA = asPlayer(fixture.playerBId);
  const acceptorB = asPlayer(fixture.playerCId);

  try {
    const challenge = await service.create(creator, {
      venueId: fixture.venueId,
      resourceId: fixture.resourceId,
      sportId: SportId.BADMINTON,
      formatId: fixture.formatId,
      startTs: fixture.startTs.toISOString(),
      teamMode: 'OWN_TEAM',
    });

    const results = await Promise.allSettled([
      service.accept(acceptorA, challenge.challengeId),
      service.accept(acceptorB, challenge.challengeId),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const challengeRow = await prisma.challenge.findUnique({
      where: {
        id: challenge.challengeId,
      },
      include: {
        teams: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
    assert.ok(challengeRow);
    assert.equal(challengeRow.status, 'OPPONENT_REQUESTED');
    assert.equal(challengeRow.teams.filter((team) => team.side === TeamSide.B).length, 1);
  } finally {
    await cleanupFixture(prisma, fixture);
    await prisma.$disconnect();
  }
});

test('db integration: confirm-opponent creates match and conversation', async (t) => {
  const prisma = new PrismaService();
  const connected = await canConnect(prisma);
  if (!connected) {
    t.skip('Postgres not reachable; skipping DB integration test');
    return;
  }

  const fixture = await seedFixture(prisma);
  const service = buildService(prisma);
  const creator = asPlayer(fixture.playerAId);
  const acceptor = asPlayer(fixture.playerBId);

  try {
    const created = await service.create(creator, {
      venueId: fixture.venueId,
      resourceId: fixture.resourceId,
      sportId: SportId.BADMINTON,
      formatId: fixture.formatId,
      startTs: fixture.startTs.toISOString(),
      teamMode: 'OWN_TEAM',
    });

    await service.accept(acceptor, created.challengeId);
    const confirmed = await service.confirmOpponent(creator, created.challengeId);

    assert.ok(confirmed.matchId);
    assert.ok(confirmed.conversationId);

    const match = await prisma.match.findUnique({
      where: {
        id: confirmed.matchId,
      },
    });
    assert.ok(match);
    assert.equal(match.status, 'SCHEDULED');

    const challengeRow = await prisma.challenge.findUnique({
      where: {
        id: created.challengeId,
      },
      include: {
        booking: true,
      },
    });
    assert.ok(challengeRow);
    assert.equal(challengeRow.status, 'CONFIRMED');
    assert.equal(challengeRow.booking.status, 'CONFIRMED');

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId: confirmed.conversationId,
        deletedAt: null,
      },
    });
    assert.ok(participants.some((participant) => participant.userId === fixture.playerAId));
    assert.ok(participants.some((participant) => participant.userId === fixture.playerBId));
  } finally {
    await cleanupFixture(prisma, fixture);
    await prisma.$disconnect();
  }
});

function buildService(prisma: PrismaService): ChallengesService {
  const audit = new AuditService(prisma);
  const cache = new CacheService();
  const metrics = new MetricsService();
  const gateway = {
    emitConversationParticipants: async () => undefined,
  } as unknown as ChatGateway;
  return new ChallengesService(prisma, audit, cache, gateway, metrics);
}

async function canConnect(prisma: PrismaService): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

type Fixture = {
  ownerId: string;
  playerAId: string;
  playerBId: string;
  playerCId: string;
  vendorId: string;
  venueId: string;
  resourceId: string;
  formatId: string;
  templateId: string;
  startTs: Date;
};

async function seedFixture(prisma: PrismaService): Promise<Fixture> {
  const ownerId = randomUUID();
  const playerAId = randomUUID();
  const playerBId = randomUUID();
  const playerCId = randomUUID();
  const vendorId = randomUUID();
  const venueId = randomUUID();
  const resourceId = randomUUID();
  const formatId = randomUUID();
  const templateId = randomUUID();
  const cityId = randomUUID();
  const stateId = randomUUID();

  const startTs = alignedFutureSlot();
  const startMinute = startTs.getUTCHours() * 60 + startTs.getUTCMinutes();

  await prisma.user.createMany({
    data: [
      { id: ownerId, role: UserRole.VENDOR_OWNER, status: UserStatus.ACTIVE },
      { id: playerAId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
      { id: playerBId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
      { id: playerCId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
    ],
  });

  await prisma.vendor.create({
    data: {
      id: vendorId,
      ownerUserId: ownerId,
      status: VendorStatus.APPROVED,
      approvedAt: new Date(),
      businessName: `Vendor ${vendorId.slice(0, 6)}`,
    },
  });

  await prisma.venue.create({
    data: {
      id: venueId,
      vendorId,
      cityId,
      stateId,
      name: `Venue ${venueId.slice(0, 6)}`,
      address: 'Test Area',
      status: VenueStatus.LIVE,
    },
  });

  await prisma.resource.create({
    data: {
      id: resourceId,
      venueId,
      sportId: SportId.BADMINTON,
      name: 'Court 1',
      capacity: 4,
      status: 'ACTIVE',
    },
  });

  await prisma.format.create({
    data: {
      id: formatId,
      vendorId,
      sportId: SportId.BADMINTON,
      name: '1v1 Classic 60m',
      teamSize: 2,
      durationMinutes: 60,
      rulesText: 'Test rules',
      refereeAllowed: false,
      joinDeadlineMinutes: 180,
      checkinOpenMinutes: 30,
      noShowGraceMinutes: 10,
      enabled: true,
    },
  });

  await prisma.availabilityTemplate.create({
    data: {
      id: templateId,
      resourceId,
      dayOfWeek: startTs.getUTCDay(),
      startMinute,
      endMinute: startMinute + 180,
      slotMinutes: 60,
      bufferMinutes: 0,
    },
  });

  return {
    ownerId,
    playerAId,
    playerBId,
    playerCId,
    vendorId,
    venueId,
    resourceId,
    formatId,
    templateId,
    startTs,
  };
}

async function cleanupFixture(prisma: PrismaService, fixture: Fixture): Promise<void> {
  const challenges = await prisma.challenge.findMany({
    where: {
      formatId: fixture.formatId,
    },
    select: {
      id: true,
      bookingId: true,
    },
  });
  const challengeIds = challenges.map((row) => row.id);
  const bookingIds = challenges.map((row) => row.bookingId);

  const teams = await prisma.team.findMany({
    where: {
      challengeId: {
        in: challengeIds,
      },
    },
    select: {
      id: true,
    },
  });
  const teamIds = teams.map((team) => team.id);

  const conversations = await prisma.conversation.findMany({
    where: {
      challengeId: {
        in: challengeIds,
      },
    },
    select: {
      id: true,
    },
  });
  const conversationIds = conversations.map((row) => row.id);

  await prisma.message.deleteMany({
    where: {
      conversationId: {
        in: conversationIds,
      },
    },
  });
  await prisma.conversationParticipant.deleteMany({
    where: {
      conversationId: {
        in: conversationIds,
      },
    },
  });
  await prisma.conversation.deleteMany({
    where: {
      id: {
        in: conversationIds,
      },
    },
  });

  await prisma.match.deleteMany({
    where: {
      challengeId: {
        in: challengeIds,
      },
    },
  });
  await prisma.teamMember.deleteMany({
    where: {
      teamId: {
        in: teamIds,
      },
    },
  });
  await prisma.team.deleteMany({
    where: {
      id: {
        in: teamIds,
      },
    },
  });
  await prisma.challenge.deleteMany({
    where: {
      id: {
        in: challengeIds,
      },
    },
  });
  await prisma.booking.deleteMany({
    where: {
      id: {
        in: bookingIds,
      },
    },
  });

  await prisma.availabilityTemplate.deleteMany({ where: { id: fixture.templateId } });
  await prisma.format.deleteMany({ where: { id: fixture.formatId } });
  await prisma.resource.deleteMany({ where: { id: fixture.resourceId } });
  await prisma.venue.deleteMany({ where: { id: fixture.venueId } });
  await prisma.vendor.deleteMany({ where: { id: fixture.vendorId } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [fixture.ownerId, fixture.playerAId, fixture.playerBId, fixture.playerCId],
      },
    },
  });
}

function alignedFutureSlot(): Date {
  const now = new Date();
  const rounded = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0,
    ),
  );
  return new Date(rounded.getTime() + 2 * 60 * 60 * 1000);
}

function asPlayer(id: string): RequestUser {
  return {
    id,
    role: 'PLAYER',
    vendorId: null,
    deviceId: 'db-test-device',
  };
}
