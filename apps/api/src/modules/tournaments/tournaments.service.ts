import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingType,
  ChatRole,
  ConversationStatus,
  ConversationType,
  MatchStatus,
  Prisma,
  SportId,
  TournamentEntryStatus,
  TournamentFormatType,
  TournamentStatus,
  VendorStatus,
} from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateTournamentDto,
  GenerateBracketDto,
  ListTournamentsQueryDto,
  RegisterTournamentDto,
} from './tournaments.dto';

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(user: RequestUser, dto: CreateTournamentDto) {
    const venueWhere: Prisma.VenueWhereInput = {
      id: dto.venueId,
      deletedAt: null,
    };

    if (user.role === 'ADMIN') {
      venueWhere.vendor = {
        status: VendorStatus.APPROVED,
      };
    } else {
      const vendor = await this.mustGetManagedVendor(user);
      venueWhere.vendorId = vendor.id;
    }

    const venue = await this.prisma.venue.findFirst({
      where: venueWhere,
      select: {
        id: true,
        vendor: {
          select: {
            ownerUserId: true,
          },
        },
      },
    });
    if (!venue) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const registrationDeadline = new Date(dto.registrationDeadline);
    const startTs = new Date(dto.startTs);
    if (!isFinite(registrationDeadline.getTime()) || !isFinite(startTs.getTime())) {
      throw new ConflictException('CONFLICT');
    }
    if (registrationDeadline >= startTs) {
      throw new ConflictException('CONFLICT');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          venueId: dto.venueId,
          sportId: dto.sportId,
          formatType: TournamentFormatType.SINGLE_ELIM,
          rulesJson: {
            ...(dto.rulesJson ?? {}),
            resourceIds: dto.resourceIds ?? [],
            slotMinutes: dto.slotMinutes ?? 60,
          } as Prisma.InputJsonValue,
          status: TournamentStatus.REG_OPEN,
          registrationDeadline,
          startTs,
          createdByUserId: user.id,
        },
      });

      const conversation = await tx.conversation.create({
        data: {
          type: ConversationType.TOURNAMENT,
          tournamentId: tournament.id,
          createdByUserId: user.id,
          status: ConversationStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      await tx.conversationParticipant.createMany({
        data: Array.from(new Set([user.id, venue.vendor.ownerUserId])).map((participantUserId) => ({
          conversationId: conversation.id,
          userId: participantUserId,
          roleInChat: ChatRole.MODERATOR,
        })),
        skipDuplicates: true,
      });

      return tournament;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'tournament.create',
      objectType: 'tournament',
      objectId: created.id,
      beforeJson: null,
      afterJson: {
        venueId: created.venueId,
        sportId: created.sportId,
        status: created.status,
      },
    });

    return created;
  }

  async list(query: ListTournamentsQueryDto) {
    return this.prisma.tournament.findMany({
      where: {
        deletedAt: null,
        ...(query.sportId ? { sportId: query.sportId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ startTs: 'asc' }],
      take: 200,
    });
  }

  async getById(tournamentId: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        id: tournamentId,
        deletedAt: null,
      },
      include: {
        entries: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        matches: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ round: 'asc' }, { matchIndex: 'asc' }],
        },
        brackets: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            version: 'desc',
          },
          take: 1,
        },
      },
    });
    if (!tournament) {
      throw new NotFoundException('NOT_FOUND');
    }

    const tournamentMatchIds = tournament.matches.map((row) => row.id);
    const linkedMatches = tournamentMatchIds.length
      ? await this.prisma.match.findMany({
          where: {
            tournamentMatchId: {
              in: tournamentMatchIds,
            },
            deletedAt: null,
          },
          select: {
            id: true,
            tournamentMatchId: true,
            status: true,
          },
        })
      : [];
    const linkedMatchByTournamentMatchId = new Map(
      linkedMatches
        .filter((row): row is { id: string; tournamentMatchId: string; status: MatchStatus } => Boolean(row.tournamentMatchId))
        .map((row) => [row.tournamentMatchId, { id: row.id, status: row.status }]),
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        tournamentId,
        type: ConversationType.TOURNAMENT,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return {
      ...tournament,
      matches: tournament.matches.map((row) => {
        const linked = linkedMatchByTournamentMatchId.get(row.id);
        return {
          ...row,
          matchId: linked?.id ?? null,
          linkedMatchStatus: linked?.status ?? null,
        };
      }),
      conversationId: conversation?.id ?? null,
    };
  }

  async register(user: RequestUser, tournamentId: string, _dto: RegisterTournamentDto) {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        id: tournamentId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        registrationDeadline: true,
        venue: {
          select: {
            vendor: {
              select: {
                ownerUserId: true,
              },
            },
          },
        },
      },
    });
    if (!tournament) {
      throw new NotFoundException('NOT_FOUND');
    }
    if (tournament.status !== TournamentStatus.REG_OPEN) {
      throw new ConflictException('CONFLICT');
    }
    if (new Date() > tournament.registrationDeadline) {
      throw new ConflictException('CONFLICT');
    }

    const existing = await this.prisma.tournamentEntry.findFirst({
      where: {
        tournamentId,
        captainUserId: user.id,
        deletedAt: null,
        status: {
          not: TournamentEntryStatus.CANCELLED,
        },
      },
      select: {
        id: true,
      },
    });
    if (existing) {
      throw new ConflictException('CONFLICT');
    }

    const entry = await this.prisma.tournamentEntry.create({
      data: {
        tournamentId,
        captainUserId: user.id,
        status: TournamentEntryStatus.CONFIRMED,
      },
    });

    const conversation = await this.mustGetTournamentConversation(tournamentId, user.id);
    await this.prisma.conversationParticipant.createMany({
      data: [
        {
          conversationId: conversation.id,
          userId: tournament.venue.vendor.ownerUserId,
          roleInChat: ChatRole.MODERATOR,
        },
        {
          conversationId: conversation.id,
          userId: user.id,
          roleInChat: ChatRole.MEMBER,
        },
      ],
      skipDuplicates: true,
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'tournament.register',
      objectType: 'tournament_entry',
      objectId: entry.id,
      beforeJson: null,
      afterJson: {
        tournamentId,
        status: entry.status,
      },
    });

    return entry;
  }

  async generateBracket(user: RequestUser, tournamentId: string, body: GenerateBracketDto) {
    const tournament = await this.mustGetManagedTournament(user, tournamentId);

    const entries = await this.prisma.tournamentEntry.findMany({
      where: {
        tournamentId,
        deletedAt: null,
        status: TournamentEntryStatus.CONFIRMED,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    if (entries.length < 2) {
      throw new ConflictException('CONFLICT');
    }

    const nextVersion = tournament.bracketVersion + 1;
    const shuffledEntryIds = deterministicShuffle(
      entries.map((entry) => entry.id),
      `${tournament.id}:${nextVersion}`,
    );

    const bracketSize = nextPowerOfTwo(shuffledEntryIds.length);
    while (shuffledEntryIds.length < bracketSize) {
      shuffledEntryIds.push(null);
    }

    const resourceIds = await this.resolveResourcePool(
      tournament.venueId,
      tournament.sportId,
      tournament.rulesJson,
      body.resourceIds,
    );
    const slotMinutes = resolveSlotMinutes(tournament.rulesJson);
    const roundBlueprints = buildSingleElimRoundBlueprints(shuffledEntryIds);
    const createdMatches: Array<{
      id: string;
      matchId: string | null;
      round: number;
      matchIndex: number;
      sideAEntryId: string | null;
      sideBEntryId: string | null;
      winnerEntryId: string | null;
      resourceId: string | null;
      startTs: string | null;
      status: MatchStatus;
    }> = [];

    let scheduledCount = 0;
    let unscheduledCount = 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          status: TournamentStatus.REG_CLOSED,
        },
      });

      for (let roundIndex = 0; roundIndex < roundBlueprints.length; roundIndex += 1) {
        const round = roundIndex + 1;
        const matchesInRound = roundBlueprints[roundIndex];

        for (let i = 0; i < matchesInRound.length; i += 1) {
          const blueprint = matchesInRound[i];
          let resourceId: string | null = null;
          let startTs: Date | null = null;

          const isRoundOnePlayablePair =
            round === 1 &&
            blueprint.status === MatchStatus.SCHEDULED &&
            Boolean(blueprint.sideAEntryId) &&
            Boolean(blueprint.sideBEntryId);
          if (isRoundOnePlayablePair && resourceIds.length > 0) {
            const scheduled = await this.tryScheduleTournamentMatch(tx, {
              resourceIds,
              baseStartTs: tournament.startTs,
              slotMinutes,
              createdByUserId: user.id,
            });
            resourceId = scheduled.resourceId;
            startTs = scheduled.startTs;
            if (scheduled.resourceId) {
              scheduledCount += 1;
            } else {
              unscheduledCount += 1;
            }
          } else if (isRoundOnePlayablePair && resourceIds.length === 0) {
            unscheduledCount += 1;
          }

          const tournamentMatch = await tx.tournamentMatch.create({
            data: {
              tournamentId,
              round,
              matchIndex: i + 1,
              resourceId,
              startTs,
              status: blueprint.status,
              sideAEntryId: blueprint.sideAEntryId,
              sideBEntryId: blueprint.sideBEntryId,
              winnerEntryId: blueprint.winnerEntryId,
            },
          });

          const linkedMatch =
            tournamentMatch.status === MatchStatus.SCHEDULED &&
            tournamentMatch.sideAEntryId &&
            tournamentMatch.sideBEntryId
              ? await tx.match.create({
                  data: {
                    tournamentMatchId: tournamentMatch.id,
                    status: MatchStatus.SCHEDULED,
                  },
                  select: {
                    id: true,
                  },
                })
              : null;

          createdMatches.push({
            id: tournamentMatch.id,
            matchId: linkedMatch?.id ?? null,
            round: tournamentMatch.round,
            matchIndex: tournamentMatch.matchIndex,
            sideAEntryId: tournamentMatch.sideAEntryId,
            sideBEntryId: tournamentMatch.sideBEntryId,
            winnerEntryId: tournamentMatch.winnerEntryId,
            resourceId: tournamentMatch.resourceId,
            startTs: tournamentMatch.startTs?.toISOString() ?? null,
            status: tournamentMatch.status,
          });
        }
      }

      await tx.tournamentBracket.create({
        data: {
          tournamentId,
          version: nextVersion,
          bracketJson: {
            size: bracketSize,
            seed: `${tournament.id}:${nextVersion}`,
            entries: shuffledEntryIds,
            rounds: createdMatches,
          } as Prisma.InputJsonValue,
          createdByUserId: user.id,
        },
      });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          bracketVersion: nextVersion,
          status: TournamentStatus.LIVE,
        },
      });
    });

    await this.ensureTournamentModerators(
      tournamentId,
      [user.id, tournament.venue.vendor.ownerUserId],
      user.id,
    );
    await this.ensureTournamentParticipants(tournamentId, entries.map((entry) => entry.captainUserId), user.id);
    await this.audit.log({
      actorUserId: user.id,
      action: 'tournament.bracket.generate',
      objectType: 'tournament',
      objectId: tournamentId,
      beforeJson: {
        bracketVersion: tournament.bracketVersion,
      },
      afterJson: {
        bracketVersion: nextVersion,
        scheduledCount,
        unscheduledCount,
      },
    });

    return {
      tournamentId,
      bracketVersion: nextVersion,
      createdMatches: createdMatches.length,
      scheduledCount,
      unscheduledCount,
    };
  }

  private async mustGetManagedVendor(user: RequestUser) {
    if (user.role === 'ADMIN') {
      throw new ForbiddenException('FORBIDDEN');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: {
        status: 'APPROVED',
        OR: [{ ownerUserId: user.id }, ...(user.vendorId ? [{ id: user.vendorId }] : [])],
      },
      select: {
        id: true,
        ownerUserId: true,
      },
    });
    if (!vendor) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return vendor;
  }

  private async mustGetManagedTournament(user: RequestUser, tournamentId: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        id: tournamentId,
        deletedAt: null,
      },
      include: {
        venue: {
          include: {
            vendor: {
              select: {
                id: true,
                ownerUserId: true,
              },
            },
          },
        },
      },
    });
    if (!tournament) {
      throw new NotFoundException('NOT_FOUND');
    }

    const canManage =
      user.role === 'ADMIN' ||
      user.id === tournament.venue.vendor.ownerUserId ||
      (user.vendorId !== null && user.vendorId === tournament.venue.vendor.id);
    if (!canManage) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return tournament;
  }

  private async mustGetTournamentConversation(tournamentId: string, createdByUserId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        tournamentId,
        type: ConversationType.TOURNAMENT,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.conversation.create({
      data: {
        tournamentId,
        type: ConversationType.TOURNAMENT,
        createdByUserId,
        status: ConversationStatus.ACTIVE,
      },
      select: { id: true },
    });
  }

  private async resolveResourcePool(
    venueId: string,
    sportId: SportId,
    rulesJson: Prisma.JsonValue,
    overrideResourceIds?: string[],
  ): Promise<string[]> {
    if (overrideResourceIds && overrideResourceIds.length > 0) {
      return overrideResourceIds;
    }

    if (rulesJson && typeof rulesJson === 'object' && !Array.isArray(rulesJson)) {
      const raw = (rulesJson as Record<string, unknown>).resourceIds;
      if (Array.isArray(raw)) {
        const ids = raw.filter((value): value is string => typeof value === 'string');
        if (ids.length > 0) {
          return ids;
        }
      }
    }

    const resources = await this.prisma.resource.findMany({
      where: {
        venueId,
        sportId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });
    return resources.map((row) => row.id);
  }

  private async tryScheduleTournamentMatch(
    tx: Prisma.TransactionClient,
    params: {
      resourceIds: string[];
      baseStartTs: Date;
      slotMinutes: number;
      createdByUserId: string;
    },
  ): Promise<{ resourceId: string | null; startTs: Date | null }> {
    const attempts = Math.max(1, params.resourceIds.length) * 120;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const resourceId = params.resourceIds[attempt % params.resourceIds.length];
      const slotIndex = Math.floor(attempt / params.resourceIds.length);
      const startTs = new Date(params.baseStartTs.getTime() + slotIndex * params.slotMinutes * 60_000);
      const endTs = new Date(startTs.getTime() + params.slotMinutes * 60_000);

      try {
        await tx.booking.create({
          data: {
            resourceId,
            startTs,
            endTs,
            type: BookingType.TOURNAMENT,
            status: BookingStatus.CONFIRMED,
            createdByUserId: params.createdByUserId,
          },
        });
        return { resourceId, startTs };
      } catch (error) {
        if (isOverlapConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    return { resourceId: null, startTs: null };
  }

  private async ensureTournamentParticipants(
    tournamentId: string,
    captainUserIds: string[],
    actorUserId: string,
  ): Promise<void> {
    const conversation = await this.mustGetTournamentConversation(tournamentId, actorUserId);
    const uniqueIds = Array.from(new Set(captainUserIds));
    if (uniqueIds.length > 0) {
      await this.prisma.conversationParticipant.createMany({
        data: uniqueIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
          roleInChat: ChatRole.MEMBER,
        })),
        skipDuplicates: true,
      });
    }
  }

  private async ensureTournamentModerators(
    tournamentId: string,
    moderatorUserIds: string[],
    actorUserId: string,
  ): Promise<void> {
    const conversation = await this.mustGetTournamentConversation(tournamentId, actorUserId);
    const uniqueIds = Array.from(new Set(moderatorUserIds));
    if (uniqueIds.length > 0) {
      await this.prisma.conversationParticipant.createMany({
        data: uniqueIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
          roleInChat: ChatRole.MODERATOR,
        })),
        skipDuplicates: true,
      });
    }
  }
}

function resolveSlotMinutes(rulesJson: Prisma.JsonValue): number {
  if (rulesJson && typeof rulesJson === 'object' && !Array.isArray(rulesJson)) {
    const raw = (rulesJson as Record<string, unknown>).slotMinutes;
    if (typeof raw === 'number' && raw >= 15) {
      return raw;
    }
  }
  return 60;
}

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
}

type RoundBlueprint = {
  sideAEntryId: string | null;
  sideBEntryId: string | null;
  winnerEntryId: string | null;
  status: MatchStatus;
  pendingWinner: boolean;
};

function buildSingleElimRoundBlueprints(seedEntries: Array<string | null>): RoundBlueprint[][] {
  const rounds: RoundBlueprint[][] = [];
  const firstRound: RoundBlueprint[] = [];

  for (let index = 0; index < seedEntries.length / 2; index += 1) {
    const sideAEntryId = seedEntries[index * 2] ?? null;
    const sideBEntryId = seedEntries[index * 2 + 1] ?? null;

    if (sideAEntryId && sideBEntryId) {
      firstRound.push({
        sideAEntryId,
        sideBEntryId,
        winnerEntryId: null,
        status: MatchStatus.SCHEDULED,
        pendingWinner: true,
      });
      continue;
    }

    if (sideAEntryId || sideBEntryId) {
      firstRound.push({
        sideAEntryId,
        sideBEntryId,
        winnerEntryId: sideAEntryId ?? sideBEntryId,
        status: MatchStatus.SETTLED,
        pendingWinner: false,
      });
      continue;
    }

    firstRound.push({
      sideAEntryId: null,
      sideBEntryId: null,
      winnerEntryId: null,
      status: MatchStatus.CANCELLED,
      pendingWinner: false,
    });
  }

  rounds.push(firstRound);

  while (rounds[rounds.length - 1].length > 1) {
    const previousRound = rounds[rounds.length - 1];
    const currentRound: RoundBlueprint[] = [];

    for (let index = 0; index < previousRound.length; index += 2) {
      const left = previousRound[index];
      const right = previousRound[index + 1];

      const leftKnown = left.winnerEntryId;
      const rightKnown = right.winnerEntryId;
      const hasPendingSource = left.pendingWinner || right.pendingWinner;

      if (hasPendingSource || (leftKnown && rightKnown)) {
        currentRound.push({
          sideAEntryId: leftKnown ?? null,
          sideBEntryId: rightKnown ?? null,
          winnerEntryId: null,
          status: MatchStatus.SCHEDULED,
          pendingWinner: true,
        });
        continue;
      }

      if (leftKnown || rightKnown) {
        currentRound.push({
          sideAEntryId: leftKnown ?? null,
          sideBEntryId: rightKnown ?? null,
          winnerEntryId: leftKnown ?? rightKnown,
          status: MatchStatus.SETTLED,
          pendingWinner: false,
        });
        continue;
      }

      currentRound.push({
        sideAEntryId: null,
        sideBEntryId: null,
        winnerEntryId: null,
        status: MatchStatus.CANCELLED,
        pendingWinner: false,
      });
    }

    rounds.push(currentRound);
  }

  return rounds;
}

function deterministicShuffle(values: string[], seedInput: string): Array<string | null> {
  const result = [...values];
  let seed = hashSeed(seedInput);
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = nextSeed(seed);
    const j = seed % (i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function isOverlapConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2004';
  }
  return false;
}
