import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingType,
  ChallengeStatus,
  ConversationStatus,
  ConversationType,
  MatchStatus,
  Prisma,
  TeamMemberStatus,
  TeamSide,
  UserStatus,
} from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { CacheService } from '../../common/cache/cache.service';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { isSlotBoundaryValid } from './challenges.slot-boundary';
import { deriveChallengeTimes } from './challenges.time';
import type {
  CreateChallengeDto,
  InviteTeamMemberDto,
  LobbyChallengesQueryDto,
  RemoveTeamMemberDto,
} from './challenges.dto';

@Injectable()
export class ChallengesService {
  private readonly createWindow = new Map<string, number[]>();
  private readonly acceptWindow = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly chatGateway: ChatGateway,
    private readonly metrics: MetricsService,
  ) {}

  async create(user: RequestUser, dto: CreateChallengeDto) {
    this.assertRateLimit(user.id, this.createWindow, 10, 60_000);

    const startTs = new Date(dto.startTs);
    if (!isFinite(startTs.getTime())) {
      throw new ConflictException('CONFLICT');
    }

    const resource = await this.prisma.resource.findFirst({
      where: {
        id: dto.resourceId,
        sportId: dto.sportId,
        deletedAt: null,
        status: 'ACTIVE',
        venue: {
          id: dto.venueId,
          deletedAt: null,
          status: 'LIVE',
          vendor: {
            status: 'APPROVED',
          },
        },
      },
      include: {
        venue: true,
      },
    });
    if (!resource) {
      throw new NotFoundException('NOT_FOUND');
    }

    const format = await this.prisma.format.findFirst({
      where: {
        id: dto.formatId,
        sportId: dto.sportId,
        enabled: true,
        deletedAt: null,
        OR: [{ vendorId: resource.venue.vendorId }, { vendorId: null }],
      },
    });
    if (!format) {
      throw new NotFoundException('NOT_FOUND');
    }

    const dayOfWeek = startTs.getUTCDay();
    const templates = await this.prisma.availabilityTemplate.findMany({
      where: {
        deletedAt: null,
        resourceId: dto.resourceId,
        dayOfWeek,
      },
      select: {
        startMinute: true,
        endMinute: true,
        slotMinutes: true,
        bufferMinutes: true,
      },
    });
    if (
      !isSlotBoundaryValid({
        startTs,
        durationMinutes: format.durationMinutes,
        templates,
      })
    ) {
      throw new ConflictException('CONFLICT');
    }

    const endTs = new Date(startTs.getTime() + format.durationMinutes * 60_000);
    const { joinDeadlineTs, checkinOpenTs } = deriveChallengeTimes({
      startTs,
      joinDeadlineMinutes: format.joinDeadlineMinutes,
      checkinOpenMinutes: format.checkinOpenMinutes,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const held = await tx.booking.create({
          data: {
            resourceId: dto.resourceId,
            startTs,
            endTs,
            type: BookingType.CHALLENGE,
            status: BookingStatus.HELD,
            createdByUserId: user.id,
            holdExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
          },
        });

        const booking = await tx.booking.update({
          where: { id: held.id },
          data: {
            status: BookingStatus.WAITING_OPPONENT,
            holdExpiresAt: null,
          },
        });

        const challenge = await tx.challenge.create({
          data: {
            bookingId: booking.id,
            sportId: dto.sportId,
            formatId: dto.formatId,
            status: ChallengeStatus.WAITING_OPPONENT,
            joinDeadlineTs,
            checkinOpenTs,
            createdByUserId: user.id,
          },
        });

        const teamA = await tx.team.create({
          data: {
            challengeId: challenge.id,
            side: TeamSide.A,
            captainUserId: user.id,
            isOpenFill: dto.teamMode === 'RANDOM_FILL',
          },
        });
        await tx.teamMember.create({
          data: {
            teamId: teamA.id,
            userId: user.id,
            status: TeamMemberStatus.ACCEPTED,
          },
        });

        return { booking, challenge };
      });

      await this.clearLobbyCache();
      await this.audit.log({
        actorUserId: user.id,
        action: 'challenge.create',
        objectType: 'challenge',
        objectId: result.challenge.id,
        beforeJson: null,
        afterJson: {
          bookingId: result.booking.id,
          status: result.challenge.status,
        },
      });
      this.metrics.incrementCounter('challenge_created_total');

      return {
        challengeId: result.challenge.id,
        bookingId: result.booking.id,
        joinDeadlineTs: result.challenge.joinDeadlineTs,
        checkinOpenTs: result.challenge.checkinOpenTs,
      };
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        this.metrics.incrementCounter('booking_conflict_total');
        throw new ConflictException('CONFLICT');
      }
      throw error;
    }
  }

  async lobby(query: LobbyChallengesQueryDto) {
    const cacheKey = `lobby:${query.cityId}:${query.sportId}:${query.fromTs}:${query.toTs}`;
    const cached = await this.cache.getJson<{ challenges: unknown[] }>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = await this.prisma.challenge.findMany({
      where: {
        deletedAt: null,
        status: ChallengeStatus.WAITING_OPPONENT,
        sportId: query.sportId,
        booking: {
          startTs: {
            gte: new Date(query.fromTs),
            lte: new Date(query.toTs),
          },
          resource: {
            venue: {
              cityId: query.cityId,
              status: 'LIVE',
              vendor: {
                status: 'APPROVED',
              },
            },
          },
        },
      },
      include: {
        booking: {
          include: {
            resource: {
              include: {
                venue: true,
              },
            },
          },
        },
        format: true,
      },
      orderBy: {
        booking: {
          startTs: 'asc',
        },
      },
      take: 200,
    });

    const mapped = rows.map((row) => ({
      id: row.id,
      venueId: row.booking.resource.venue.id,
      venueName: row.booking.resource.venue.name,
      area: row.booking.resource.venue.address,
      startTs: row.booking.startTs,
      formatName: row.format.name,
      levelRangeHint: null,
      refereeAvailable: row.format.refereeAllowed,
    }));

    const response = {
      challenges: mapped,
    };
    await this.cache.setJson(cacheKey, response, 10);

    return response;
  }

  async getById(challengeId: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: {
        id: challengeId,
        deletedAt: null,
      },
      include: {
        booking: {
          include: {
            resource: {
              include: {
                venue: true,
              },
            },
          },
        },
        format: true,
        teams: {
          where: {
            deletedAt: null,
          },
          include: {
            members: {
              where: {
                deletedAt: null,
                status: {
                  not: TeamMemberStatus.REMOVED,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            side: 'asc',
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!challenge) {
      throw new NotFoundException('NOT_FOUND');
    }

    return challenge;
  }

  async accept(user: RequestUser, challengeId: string) {
    this.assertRateLimit(user.id, this.acceptWindow, 20, 60_000);

    const accepted = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "challenges" WHERE "id" = ${challengeId} FOR UPDATE`;

      const challenge = await tx.challenge.findFirst({
        where: {
          id: challengeId,
          deletedAt: null,
        },
        include: {
          teams: {
            where: {
              deletedAt: null,
            },
            include: {
              members: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
          booking: true,
        },
      });

      if (!challenge) {
        throw new NotFoundException('NOT_FOUND');
      }
      if (challenge.status !== ChallengeStatus.WAITING_OPPONENT) {
        throw new ConflictException('CONFLICT');
      }
      if (challenge.joinDeadlineTs <= new Date()) {
        await tx.challenge.update({
          where: { id: challenge.id },
          data: { status: ChallengeStatus.CANCELLED },
        });
        await tx.booking.update({
          where: { id: challenge.bookingId },
          data: { status: BookingStatus.CANCELLED },
        });
        throw new ConflictException('CONFLICT');
      }
      if (challenge.createdByUserId === user.id) {
        throw new ConflictException('CONFLICT');
      }
      if (challenge.teams.some((team) => team.side === TeamSide.B)) {
        throw new ConflictException('CONFLICT');
      }

      const existingMembership = challenge.teams.flatMap((team) => team.members).find((member) => {
        return member.userId === user.id && member.status !== TeamMemberStatus.REMOVED;
      });
      if (existingMembership) {
        throw new ConflictException('CONFLICT');
      }

      const teamB = await tx.team.create({
        data: {
          challengeId: challenge.id,
          side: TeamSide.B,
          captainUserId: user.id,
          isOpenFill: false,
        },
      });
      await tx.teamMember.create({
        data: {
          teamId: teamB.id,
          userId: user.id,
          status: TeamMemberStatus.ACCEPTED,
        },
      });
      const updated = await tx.challenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          status: ChallengeStatus.OPPONENT_REQUESTED,
        },
      });

      return updated;
    });

    await this.clearLobbyCache();
    await this.audit.log({
      actorUserId: user.id,
      action: 'challenge.accept',
      objectType: 'challenge',
      objectId: accepted.id,
      beforeJson: {
        status: ChallengeStatus.WAITING_OPPONENT,
      },
      afterJson: {
        status: accepted.status,
      },
    });
    this.metrics.incrementCounter('challenge_accepted_total');

    return {
      challengeId: accepted.id,
      status: accepted.status,
    };
  }

  async confirmOpponent(user: RequestUser, challengeId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "challenges" WHERE "id" = ${challengeId} FOR UPDATE`;

      const challenge = await tx.challenge.findFirst({
        where: {
          id: challengeId,
          deletedAt: null,
        },
        include: {
          teams: {
            where: {
              deletedAt: null,
            },
            include: {
              members: {
                where: {
                  deletedAt: null,
                  status: {
                    not: TeamMemberStatus.REMOVED,
                  },
                },
              },
            },
          },
          booking: true,
        },
      });
      if (!challenge) {
        throw new NotFoundException('NOT_FOUND');
      }
      if (challenge.status !== ChallengeStatus.OPPONENT_REQUESTED) {
        throw new ConflictException('CONFLICT');
      }

      const teamA = challenge.teams.find((team) => team.side === TeamSide.A);
      const teamB = challenge.teams.find((team) => team.side === TeamSide.B);
      if (!teamA || !teamB || teamA.captainUserId !== user.id) {
        throw new ForbiddenException('FORBIDDEN');
      }

      const updated = await tx.challenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          status: ChallengeStatus.CONFIRMED,
        },
      });

      await tx.booking.update({
        where: {
          id: challenge.booking.id,
        },
        data: {
          status: BookingStatus.CONFIRMED,
        },
      });

      const match = await tx.match.upsert({
        where: {
          challengeId: challenge.id,
        },
        create: {
          challengeId: challenge.id,
          status: MatchStatus.SCHEDULED,
        },
        update: {
          status: MatchStatus.SCHEDULED,
        },
      });

      const conversation = await tx.conversation.upsert({
        where: {
          challengeId: challenge.id,
        },
        create: {
          type: ConversationType.CHALLENGE,
          challengeId: challenge.id,
          createdByUserId: user.id,
          status: ConversationStatus.ACTIVE,
        },
        update: {
          status: ConversationStatus.ACTIVE,
        },
      });

      const participantIds = collectParticipantIds(challenge.teams);
      if (participantIds.length > 0) {
        await tx.conversationParticipant.createMany({
          data: participantIds.map((participantId) => ({
            conversationId: conversation.id,
            userId: participantId,
          })),
          skipDuplicates: true,
        });
      }

      return {
        challenge: updated,
        match,
        conversation,
      };
    });

    await this.clearLobbyCache();
    await this.audit.log({
      actorUserId: user.id,
      action: 'challenge.confirm_opponent',
      objectType: 'challenge',
      objectId: result.challenge.id,
      beforeJson: {
        status: ChallengeStatus.OPPONENT_REQUESTED,
      },
      afterJson: {
        status: result.challenge.status,
        matchId: result.match.id,
        conversationId: result.conversation.id,
      },
    });
    this.metrics.incrementCounter('challenge_confirmed_total');
    await this.chatGateway.emitConversationParticipants(result.conversation.id);

    return {
      matchId: result.match.id,
      conversationId: result.conversation.id,
    };
  }

  async inviteToTeam(user: RequestUser, teamId: string, dto: InviteTeamMemberDto) {
    await this.assertPlayerActive(dto.userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({
        where: {
          id: teamId,
          deletedAt: null,
        },
        include: {
          challenge: {
            include: {
              format: true,
            },
          },
          members: {
            where: {
              deletedAt: null,
            },
          },
        },
      });
      if (!team) {
        throw new NotFoundException('NOT_FOUND');
      }
      if (team.captainUserId !== user.id) {
        throw new ForbiddenException('FORBIDDEN');
      }
      if (team.challenge.status === ChallengeStatus.CANCELLED || team.challenge.status === ChallengeStatus.CLOSED) {
        throw new ConflictException('CONFLICT');
      }
      if (dto.userId === team.captainUserId) {
        throw new ConflictException('CONFLICT');
      }

      const alreadyAssignedInChallenge = await tx.teamMember.findFirst({
        where: {
          userId: dto.userId,
          deletedAt: null,
          status: {
            in: [TeamMemberStatus.INVITED, TeamMemberStatus.ACCEPTED],
          },
          team: {
            challengeId: team.challengeId,
            deletedAt: null,
          },
        },
      });
      if (alreadyAssignedInChallenge) {
        throw new ConflictException('CONFLICT');
      }

      const seatCount = getSeatCount(team.captainUserId, team.members);
      if (seatCount >= team.challenge.format.teamSize) {
        throw new ConflictException('CONFLICT');
      }

      const member = await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: dto.userId,
          },
        },
        create: {
          teamId: team.id,
          userId: dto.userId,
          status: TeamMemberStatus.INVITED,
        },
        update: {
          status: TeamMemberStatus.INVITED,
          deletedAt: null,
        },
      });

      return {
        challengeId: team.challengeId,
        member,
      };
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'team.invite',
      objectType: 'team',
      objectId: teamId,
      beforeJson: null,
      afterJson: {
        userId: dto.userId,
        status: result.member.status,
      },
    });

    return {
      ok: true,
      challengeId: result.challengeId,
    };
  }

  async removeFromTeam(user: RequestUser, teamId: string, dto: RemoveTeamMemberDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({
        where: {
          id: teamId,
          deletedAt: null,
        },
      });
      if (!team) {
        throw new NotFoundException('NOT_FOUND');
      }
      if (team.captainUserId !== user.id) {
        throw new ForbiddenException('FORBIDDEN');
      }
      if (dto.userId === team.captainUserId) {
        throw new ConflictException('CONFLICT');
      }

      const member = await tx.teamMember.findFirst({
        where: {
          teamId,
          userId: dto.userId,
          deletedAt: null,
          status: {
            not: TeamMemberStatus.REMOVED,
          },
        },
      });
      if (!member) {
        throw new NotFoundException('NOT_FOUND');
      }

      const updated = await tx.teamMember.update({
        where: {
          teamId_userId: {
            teamId,
            userId: dto.userId,
          },
        },
        data: {
          status: TeamMemberStatus.REMOVED,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'team.remove',
      objectType: 'team',
      objectId: teamId,
      beforeJson: {
        userId: dto.userId,
      },
      afterJson: {
        status: result.status,
      },
    });

    return {
      ok: true,
    };
  }

  async joinTeam(user: RequestUser, teamId: string) {
    await this.assertPlayerActive(user.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({
        where: {
          id: teamId,
          deletedAt: null,
        },
        include: {
          challenge: {
            include: {
              format: true,
            },
          },
          members: {
            where: {
              deletedAt: null,
            },
          },
        },
      });
      if (!team) {
        throw new NotFoundException('NOT_FOUND');
      }
      if (!team.isOpenFill) {
        throw new ConflictException('CONFLICT');
      }
      if (team.challenge.status === ChallengeStatus.CANCELLED || team.challenge.status === ChallengeStatus.CLOSED) {
        throw new ConflictException('CONFLICT');
      }

      const alreadyAssignedInChallenge = await tx.teamMember.findFirst({
        where: {
          userId: user.id,
          deletedAt: null,
          status: {
            in: [TeamMemberStatus.INVITED, TeamMemberStatus.ACCEPTED],
          },
          team: {
            challengeId: team.challengeId,
            deletedAt: null,
          },
        },
      });
      if (alreadyAssignedInChallenge || team.captainUserId === user.id) {
        throw new ConflictException('CONFLICT');
      }

      const seatCount = getSeatCount(team.captainUserId, team.members);
      if (seatCount >= team.challenge.format.teamSize) {
        throw new ConflictException('CONFLICT');
      }

      const member = await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: user.id,
          },
        },
        create: {
          teamId: team.id,
          userId: user.id,
          status: TeamMemberStatus.ACCEPTED,
        },
        update: {
          status: TeamMemberStatus.ACCEPTED,
          deletedAt: null,
        },
      });

      return {
        challengeId: team.challengeId,
        member,
      };
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'team.join',
      objectType: 'team',
      objectId: teamId,
      beforeJson: null,
      afterJson: {
        userId: user.id,
        status: result.member.status,
      },
    });

    return {
      ok: true,
      challengeId: result.challengeId,
    };
  }

  private async assertPlayerActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('FORBIDDEN');
    }
  }

  private async clearLobbyCache() {
    await this.cache.deleteByPrefix('lobby:');
  }

  private assertRateLimit(
    userId: string,
    windowMap: Map<string, number[]>,
    limit: number,
    durationMs: number,
  ): void {
    const now = Date.now();
    const events = (windowMap.get(userId) ?? []).filter((ts) => now - ts <= durationMs);
    if (events.length >= limit) {
      throw new HttpException('RATE_LIMITED', 429);
    }
    events.push(now);
    windowMap.set(userId, events);
  }
}

function isOverlapConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2004';
  }
  return false;
}

function getSeatCount(
  captainUserId: string,
  members: Array<{ userId: string; status: TeamMemberStatus; deletedAt: Date | null }>,
): number {
  const activeIds = new Set<string>();
  activeIds.add(captainUserId);

  for (const member of members) {
    if (member.deletedAt) {
      continue;
    }
    if (member.status === TeamMemberStatus.INVITED || member.status === TeamMemberStatus.ACCEPTED) {
      activeIds.add(member.userId);
    }
  }

  return activeIds.size;
}

function collectParticipantIds(
  teams: Array<{
    captainUserId: string;
    members: Array<{ userId: string; status: TeamMemberStatus }>;
  }>,
): string[] {
  const participants = new Set<string>();
  for (const team of teams) {
    participants.add(team.captainUserId);
    for (const member of team.members) {
      if (member.status === TeamMemberStatus.ACCEPTED) {
        participants.add(member.userId);
      }
    }
  }
  return Array.from(participants);
}
