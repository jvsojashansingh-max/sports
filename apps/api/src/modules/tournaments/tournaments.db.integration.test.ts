import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  ChatRole,
  ResourceStatus,
  SportId,
  TeamSide,
  UserRole,
  UserStatus,
  VendorStatus,
  VenueStatus,
} from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MatchesService } from '../matches/matches.service';
import { StatsService } from '../stats/stats.service';
import { TournamentsService } from './tournaments.service';

test('db integration: tournament create + register wires chat participants', async (t) => {
  const prisma = new PrismaService();
  const connected = await canConnect(prisma);
  if (!connected) {
    t.skip('Postgres not reachable; skipping DB integration test');
    return;
  }

  const fixture = await seedFixture(prisma);
  const service = buildService(prisma);
  const owner = asUser(fixture.ownerId, 'VENDOR_OWNER', fixture.vendorId);
  const playerA = asUser(fixture.playerAId, 'PLAYER', null);
  const playerB = asUser(fixture.playerBId, 'PLAYER', null);

  try {
    const created = await service.create(owner, {
      venueId: fixture.venueId,
      sportId: SportId.BADMINTON,
      registrationDeadline: fixture.registrationDeadline.toISOString(),
      startTs: fixture.startTs.toISOString(),
      slotMinutes: 60,
      resourceIds: [fixture.resourceId],
    });

    await service.register(playerA, created.id, { teamMode: 'SOLO' });
    await service.register(playerB, created.id, { teamMode: 'SOLO' });

    const tournament = await service.getById(created.id);
    assert.ok(tournament.conversationId);
    assert.equal(tournament.entries.length, 2);

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId: tournament.conversationId!,
        deletedAt: null,
      },
    });

    const ownerParticipant = participants.find((participant) => participant.userId === fixture.ownerId);
    assert.ok(ownerParticipant);
    assert.equal(ownerParticipant.roleInChat, ChatRole.MODERATOR);
    assert.ok(participants.some((participant) => participant.userId === fixture.playerAId));
    assert.ok(participants.some((participant) => participant.userId === fixture.playerBId));
  } finally {
    await cleanupFixture(prisma, fixture);
    await prisma.$disconnect();
  }
});

test('db integration: generate-bracket creates fixtures and tournament bookings', async (t) => {
  const prisma = new PrismaService();
  const connected = await canConnect(prisma);
  if (!connected) {
    t.skip('Postgres not reachable; skipping DB integration test');
    return;
  }

  const fixture = await seedFixture(prisma);
  const service = buildService(prisma);
  const owner = asUser(fixture.ownerId, 'VENDOR_OWNER', fixture.vendorId);
  const players = [
    asUser(fixture.playerAId, 'PLAYER', null),
    asUser(fixture.playerBId, 'PLAYER', null),
    asUser(fixture.playerCId, 'PLAYER', null),
    asUser(fixture.playerDId, 'PLAYER', null),
  ];

  try {
    const created = await service.create(owner, {
      venueId: fixture.venueId,
      sportId: SportId.BADMINTON,
      registrationDeadline: fixture.registrationDeadline.toISOString(),
      startTs: fixture.startTs.toISOString(),
      slotMinutes: 60,
      resourceIds: [fixture.resourceId],
    });

    for (const player of players) {
      await service.register(player, created.id, { teamMode: 'SOLO' });
    }

    const generated = await service.generateBracket(owner, created.id, {
      resourceIds: [fixture.resourceId],
    });
    assert.equal(generated.bracketVersion, 2);
    assert.equal(generated.createdMatches, 3);
    assert.equal(generated.scheduledCount, 2);
    assert.equal(generated.unscheduledCount, 0);

    const tournament = await prisma.tournament.findUnique({
      where: { id: created.id },
      select: {
        status: true,
        bracketVersion: true,
      },
    });
    assert.ok(tournament);
    assert.equal(tournament.status, 'LIVE');
    assert.equal(tournament.bracketVersion, 2);

    const tournamentMatches = await prisma.tournamentMatch.findMany({
      where: {
        tournamentId: created.id,
        deletedAt: null,
      },
    });
    assert.equal(tournamentMatches.length, 3);
    assert.equal(
      tournamentMatches.filter((match) => Boolean(match.resourceId)).length,
      2,
    );
    assert.equal(
      tournamentMatches.filter((match) => Boolean(match.startTs)).length,
      2,
    );

    const linkedMatches = await prisma.match.findMany({
      where: {
        tournamentMatchId: {
          in: tournamentMatches.map((row) => row.id),
        },
        deletedAt: null,
      },
    });
    assert.equal(linkedMatches.length, 2);

    const bookings = await prisma.booking.findMany({
      where: {
        resourceId: fixture.resourceId,
        type: 'TOURNAMENT',
        createdByUserId: fixture.ownerId,
        deletedAt: null,
      },
    });
    assert.equal(bookings.length, 2);
  } finally {
    await cleanupFixture(prisma, fixture);
    await prisma.$disconnect();
  }
});

test('db integration: tournament result submissions settle through matches engine', async (t) => {
  const prisma = new PrismaService();
  const connected = await canConnect(prisma);
  if (!connected) {
    t.skip('Postgres not reachable; skipping DB integration test');
    return;
  }

  const fixture = await seedFixture(prisma);
  const tournaments = buildService(prisma);
  const matches = buildMatchesService(prisma);
  const owner = asUser(fixture.ownerId, 'VENDOR_OWNER', fixture.vendorId);
  const players = [
    asUser(fixture.playerAId, 'PLAYER', null),
    asUser(fixture.playerBId, 'PLAYER', null),
  ];

  try {
    const created = await tournaments.create(owner, {
      venueId: fixture.venueId,
      sportId: SportId.BADMINTON,
      registrationDeadline: fixture.registrationDeadline.toISOString(),
      startTs: fixture.startTs.toISOString(),
      slotMinutes: 60,
      resourceIds: [fixture.resourceId],
    });
    for (const player of players) {
      await tournaments.register(player, created.id, { teamMode: 'SOLO' });
    }
    await tournaments.generateBracket(owner, created.id, {
      resourceIds: [fixture.resourceId],
    });

    const tournamentMatch = await prisma.tournamentMatch.findFirst({
      where: {
        tournamentId: created.id,
        deletedAt: null,
      },
      orderBy: [{ round: 'asc' }, { matchIndex: 'asc' }],
    });
    assert.ok(tournamentMatch);
    assert.ok(tournamentMatch.sideAEntryId);
    assert.ok(tournamentMatch.sideBEntryId);

    const entries = await prisma.tournamentEntry.findMany({
      where: {
        id: {
          in: [tournamentMatch.sideAEntryId as string, tournamentMatch.sideBEntryId as string],
        },
      },
      select: {
        id: true,
        captainUserId: true,
      },
    });
    const captainByEntryId = new Map(entries.map((row) => [row.id, row.captainUserId]));

    const sideACaptainId = captainByEntryId.get(tournamentMatch.sideAEntryId as string);
    const sideBCaptainId = captainByEntryId.get(tournamentMatch.sideBEntryId as string);
    assert.ok(sideACaptainId);
    assert.ok(sideBCaptainId);

    const linkedMatch = await prisma.match.findFirst({
      where: {
        tournamentMatchId: tournamentMatch.id,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
    assert.ok(linkedMatch);

    await matches.submitResult(asUser(sideACaptainId as string, 'PLAYER', null), linkedMatch.id, {
      winnerSide: TeamSide.A,
    });
    const pendingRow = await prisma.match.findUnique({
      where: {
        id: linkedMatch.id,
      },
      select: {
        status: true,
      },
    });
    assert.ok(pendingRow);
    assert.equal(pendingRow.status, 'RESULT_PENDING');

    await matches.submitResult(asUser(sideBCaptainId as string, 'PLAYER', null), linkedMatch.id, {
      winnerSide: TeamSide.A,
    });

    const settledMatch = await prisma.match.findUnique({
      where: {
        id: linkedMatch.id,
      },
      select: {
        status: true,
      },
    });
    assert.ok(settledMatch);
    assert.equal(settledMatch.status, 'SETTLED');

    const settledTournamentMatch = await prisma.tournamentMatch.findUnique({
      where: {
        id: tournamentMatch.id,
      },
      select: {
        status: true,
        winnerEntryId: true,
        sideAEntryId: true,
      },
    });
    assert.ok(settledTournamentMatch);
    assert.equal(settledTournamentMatch.status, 'SETTLED');
    assert.equal(settledTournamentMatch.winnerEntryId, settledTournamentMatch.sideAEntryId);
  } finally {
    await cleanupFixture(prisma, fixture);
    await prisma.$disconnect();
  }
});

function buildService(prisma: PrismaService): TournamentsService {
  const audit = new AuditService(prisma);
  return new TournamentsService(prisma, audit);
}

function buildMatchesService(prisma: PrismaService): MatchesService {
  const audit = new AuditService(prisma);
  const stats = new StatsService(prisma);
  const metrics = new MetricsService();
  return new MatchesService(prisma, audit, stats, metrics);
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
  playerDId: string;
  vendorId: string;
  venueId: string;
  resourceId: string;
  cityId: string;
  stateId: string;
  registrationDeadline: Date;
  startTs: Date;
};

async function seedFixture(prisma: PrismaService): Promise<Fixture> {
  const ownerId = randomUUID();
  const playerAId = randomUUID();
  const playerBId = randomUUID();
  const playerCId = randomUUID();
  const playerDId = randomUUID();
  const vendorId = randomUUID();
  const venueId = randomUUID();
  const resourceId = randomUUID();
  const cityId = randomUUID();
  const stateId = randomUUID();

  const now = new Date();
  const registrationDeadline = new Date(now.getTime() + 90 * 60_000);
  const startTs = new Date(now.getTime() + 3 * 60 * 60_000);

  await prisma.user.createMany({
    data: [
      { id: ownerId, role: UserRole.VENDOR_OWNER, status: UserStatus.ACTIVE },
      { id: playerAId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
      { id: playerBId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
      { id: playerCId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
      { id: playerDId, role: UserRole.PLAYER, status: UserStatus.ACTIVE },
    ],
  });

  await prisma.vendor.create({
    data: {
      id: vendorId,
      ownerUserId: ownerId,
      status: VendorStatus.APPROVED,
      approvedAt: now,
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
      address: 'Tournament District',
      status: VenueStatus.LIVE,
    },
  });

  await prisma.resource.create({
    data: {
      id: resourceId,
      venueId,
      sportId: SportId.BADMINTON,
      name: 'Court T1',
      capacity: 4,
      status: ResourceStatus.ACTIVE,
    },
  });

  return {
    ownerId,
    playerAId,
    playerBId,
    playerCId,
    playerDId,
    vendorId,
    venueId,
    resourceId,
    cityId,
    stateId,
    registrationDeadline,
    startTs,
  };
}

async function cleanupFixture(prisma: PrismaService, fixture: Fixture): Promise<void> {
  const tournaments = await prisma.tournament.findMany({
    where: {
      venueId: fixture.venueId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
  const tournamentIds = tournaments.map((row) => row.id);
  const tournamentMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId: {
        in: tournamentIds,
      },
    },
    select: {
      id: true,
    },
  });
  const tournamentMatchIds = tournamentMatches.map((row) => row.id);
  const matches = tournamentMatchIds.length
    ? await prisma.match.findMany({
        where: {
          tournamentMatchId: {
            in: tournamentMatchIds,
          },
        },
        select: {
          id: true,
        },
      })
    : [];
  const matchIds = matches.map((row) => row.id);

  const conversations = await prisma.conversation.findMany({
    where: {
      tournamentId: {
        in: tournamentIds,
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

  await prisma.matchResult.deleteMany({
    where: {
      matchId: {
        in: matchIds,
      },
    },
  });
  await prisma.dispute.deleteMany({
    where: {
      matchId: {
        in: matchIds,
      },
    },
  });
  await prisma.review.deleteMany({
    where: {
      matchId: {
        in: matchIds,
      },
    },
  });
  await prisma.matchCheckin.deleteMany({
    where: {
      matchId: {
        in: matchIds,
      },
    },
  });
  await prisma.match.deleteMany({
    where: {
      id: {
        in: matchIds,
      },
    },
  });

  await prisma.tournamentMatch.deleteMany({
    where: {
      tournamentId: {
        in: tournamentIds,
      },
    },
  });
  await prisma.tournamentBracket.deleteMany({
    where: {
      tournamentId: {
        in: tournamentIds,
      },
    },
  });
  await prisma.tournamentEntry.deleteMany({
    where: {
      tournamentId: {
        in: tournamentIds,
      },
    },
  });
  await prisma.tournament.deleteMany({
    where: {
      id: {
        in: tournamentIds,
      },
    },
  });

  await prisma.booking.deleteMany({
    where: {
      resourceId: fixture.resourceId,
      type: 'TOURNAMENT',
      createdByUserId: fixture.ownerId,
    },
  });

  await prisma.resource.deleteMany({ where: { id: fixture.resourceId } });
  await prisma.venue.deleteMany({ where: { id: fixture.venueId } });
  await prisma.vendor.deleteMany({ where: { id: fixture.vendorId } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [fixture.ownerId, fixture.playerAId, fixture.playerBId, fixture.playerCId, fixture.playerDId],
      },
    },
  });
}

function asUser(id: string, role: RequestUser['role'], vendorId: string | null): RequestUser {
  return {
    id,
    role,
    vendorId,
    deviceId: 'db-test-device',
  };
}
