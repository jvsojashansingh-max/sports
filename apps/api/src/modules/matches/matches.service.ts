import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingType,
  BookingStatus,
  DisputeStatus,
  MatchStatus,
  Prisma,
  SportId,
  TeamSide,
  TournamentStatus,
  type PaymentStatus,
} from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import type {
  MarkPaymentStatusDto,
  MatchCheckinDto,
  MatchForfeitDto,
  ResolveDisputeDto,
  SubmitResultDto,
} from './matches.dto';

type MatchContext = {
  matchId: string;
  kind: 'CHALLENGE' | 'TOURNAMENT';
  bookingId: string | null;
  challengeId: string | null;
  tournamentId: string | null;
  tournamentMatchId: string | null;
  sideAEntryId: string | null;
  sideBEntryId: string | null;
  sportId: SportId;
  vendorId: string;
  ownerUserId: string;
  captainAUserId: string | null;
  captainBUserId: string | null;
};

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statsService: StatsService,
    private readonly metrics: MetricsService,
  ) {}

  async checkin(user: RequestUser, matchId: string, dto: MatchCheckinDto) {
    const managed = await this.mustGetManagedMatch(user, matchId);

    await this.prisma.matchCheckin.upsert({
      where: {
        matchId_side: {
          matchId,
          side: dto.side,
        },
      },
      create: {
        matchId,
        side: dto.side,
        present: dto.present,
        checkedInAt: dto.present ? new Date() : null,
        checkedInByUserId: user.id,
      },
      update: {
        present: dto.present,
        checkedInAt: dto.present ? new Date() : null,
        checkedInByUserId: user.id,
      },
    });

    const checkins = await this.prisma.matchCheckin.findMany({
      where: {
        matchId,
      },
      select: {
        side: true,
        present: true,
      },
    });
    const sideAPresent = checkins.some((row) => row.side === TeamSide.A && row.present);
    const sideBPresent = checkins.some((row) => row.side === TeamSide.B && row.present);
    const bothPresent = sideAPresent && sideBPresent;

    const status = bothPresent ? MatchStatus.IN_PROGRESS : MatchStatus.CHECKIN_OPEN;
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status,
      },
    });
    await this.updateBookingStatus(
      managed.bookingId,
      bothPresent ? BookingStatus.IN_PROGRESS : BookingStatus.CHECKIN_OPEN,
    );
    await this.syncTournamentMatchStatus(managed, status);

    await this.audit.log({
      actorUserId: user.id,
      action: 'match.checkin',
      objectType: 'match',
      objectId: matchId,
      beforeJson: null,
      afterJson: {
        side: dto.side,
        present: dto.present,
        matchStatus: status,
      },
    });

    return {
      matchId,
      status,
      bothPresent,
    };
  }

  async forfeit(user: RequestUser, matchId: string, dto: MatchForfeitDto) {
    const managed = await this.mustGetManagedMatch(user, matchId);
    const currentMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { status: true },
    });

    await this.prisma.match.update({
      where: {
        id: matchId,
      },
      data: {
        status: MatchStatus.FORFEIT,
        endedAt: new Date(),
      },
    });
    await this.updateBookingStatus(managed.bookingId, BookingStatus.COMPLETED);
    await this.syncTournamentMatchStatus(managed, MatchStatus.FORFEIT, dto.winnerSide);
    await this.advanceTournamentBracketFromWinner(managed, dto.winnerSide);
    if (currentMatch?.status !== MatchStatus.SETTLED && currentMatch?.status !== MatchStatus.FORFEIT) {
      await this.applySettlementStats(managed, dto.winnerSide);
      this.metrics.incrementCounter('match_settled_total', 1, {
        mode: managed.kind,
        reason: 'FORFEIT',
      });
    }
    await this.maybeCompleteTournament(managed.tournamentId);

    await this.audit.log({
      actorUserId: user.id,
      action: 'match.forfeit',
      objectType: 'match',
      objectId: matchId,
      beforeJson: null,
      afterJson: {
        winnerSide: dto.winnerSide,
        reason: dto.reason ?? null,
      },
    });

    return {
      ok: true,
      winnerSide: dto.winnerSide,
    };
  }

  async markPaymentStatus(user: RequestUser, matchId: string, dto: MarkPaymentStatusDto) {
    const managed = await this.mustGetManagedMatch(user, matchId);
    if (!managed.challengeId) {
      throw new ConflictException('CONFLICT');
    }

    const updated = await this.prisma.challenge.update({
      where: {
        id: managed.challengeId,
      },
      data: {
        paymentStatus: dto.paymentStatus,
      },
      select: {
        id: true,
        paymentStatus: true,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'match.payment_status.mark',
      objectType: 'challenge',
      objectId: managed.challengeId,
      beforeJson: null,
      afterJson: {
        paymentStatus: updated.paymentStatus,
      },
    });

    return {
      challengeId: updated.id,
      paymentStatus: updated.paymentStatus as PaymentStatus,
    };
  }

  async submitResult(user: RequestUser, matchId: string, dto: SubmitResultDto) {
    const captainContext = await this.mustGetCaptainContext(user, matchId);
    const currentMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { status: true },
    });

    await this.prisma.matchResult.upsert({
      where: {
        matchId_submittedByUserId: {
          matchId,
          submittedByUserId: user.id,
        },
      },
      create: {
        matchId,
        submittedByUserId: user.id,
        winnerSide: dto.winnerSide,
        scoreJson: (dto.scoreJson as Prisma.InputJsonValue | undefined) ?? undefined,
      },
      update: {
        winnerSide: dto.winnerSide,
        scoreJson: (dto.scoreJson as Prisma.InputJsonValue | undefined) ?? undefined,
        submittedAt: new Date(),
      },
    });

    const submissions = await this.prisma.matchResult.findMany({
      where: {
        matchId,
      },
      orderBy: {
        submittedAt: 'asc',
      },
    });

    let nextStatus: MatchStatus = MatchStatus.RESULT_PENDING;
    if (submissions.length >= 2) {
      const uniqueWinners = new Set(submissions.map((row) => row.winnerSide));
      if (uniqueWinners.size === 1) {
        nextStatus = MatchStatus.SETTLED;
        const winnerSide = submissions[0].winnerSide;
        await this.prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.SETTLED,
            endedAt: new Date(),
          },
        });
        await this.updateBookingStatus(captainContext.bookingId, BookingStatus.COMPLETED);
        await this.syncTournamentMatchStatus(captainContext, MatchStatus.SETTLED, winnerSide);
        await this.advanceTournamentBracketFromWinner(captainContext, winnerSide);
        if (currentMatch?.status !== MatchStatus.SETTLED && currentMatch?.status !== MatchStatus.FORFEIT) {
          await this.applySettlementStats(captainContext, winnerSide);
          this.metrics.incrementCounter('match_settled_total', 1, {
            mode: captainContext.kind,
            reason: 'CAPTAIN_AGREEMENT',
          });
        }
        await this.maybeCompleteTournament(captainContext.tournamentId);
      } else {
        nextStatus = MatchStatus.DISPUTED;
        await this.prisma.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.DISPUTED,
          },
        });
        await this.prisma.dispute.upsert({
          where: {
            matchId,
          },
          create: {
            matchId,
            status: DisputeStatus.OPEN,
            reason: 'captain_result_mismatch',
          },
          update: {
            status: DisputeStatus.OPEN,
            reason: 'captain_result_mismatch',
            resolvedByUserId: null,
            resolutionJson: Prisma.DbNull,
          },
        });
        await this.syncTournamentMatchStatus(captainContext, MatchStatus.DISPUTED);
        if (currentMatch?.status !== MatchStatus.DISPUTED) {
          this.metrics.incrementCounter('match_disputes_total', 1, {
            mode: captainContext.kind,
            reason: 'CAPTAIN_MISMATCH',
          });
        }
      }
    } else {
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.RESULT_PENDING,
        },
      });
      await this.syncTournamentMatchStatus(captainContext, MatchStatus.RESULT_PENDING);
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'match.result.submit',
      objectType: 'match',
      objectId: matchId,
      beforeJson: null,
      afterJson: {
        winnerSide: dto.winnerSide,
        matchStatus: nextStatus,
      },
    });

    return {
      matchId,
      status: nextStatus,
    };
  }

  async resolveDispute(user: RequestUser, matchId: string, dto: ResolveDisputeDto) {
    const managed = await this.mustGetManagedMatch(user, matchId);
    const currentMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { status: true },
    });

    const dispute = await this.prisma.dispute.findUnique({
      where: {
        matchId,
      },
    });
    if (!dispute) {
      throw new NotFoundException('NOT_FOUND');
    }
    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new ConflictException('CONFLICT');
    }

    await this.prisma.dispute.update({
      where: { matchId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolvedByUserId: user.id,
        resolutionJson: {
          winnerSide: dto.winnerSide,
          resolutionNote: dto.resolutionNote ?? null,
        },
      },
    });

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.SETTLED,
        endedAt: new Date(),
      },
    });
    await this.updateBookingStatus(managed.bookingId, BookingStatus.COMPLETED);
    await this.syncTournamentMatchStatus(managed, MatchStatus.SETTLED, dto.winnerSide);
    await this.advanceTournamentBracketFromWinner(managed, dto.winnerSide);
    if (currentMatch?.status !== MatchStatus.SETTLED && currentMatch?.status !== MatchStatus.FORFEIT) {
      await this.applySettlementStats(managed, dto.winnerSide);
      this.metrics.incrementCounter('match_settled_total', 1, {
        mode: managed.kind,
        reason: 'VENDOR_RESOLUTION',
      });
    }
    await this.maybeCompleteTournament(managed.tournamentId);

    await this.audit.log({
      actorUserId: user.id,
      action: 'dispute.resolve',
      objectType: 'match',
      objectId: matchId,
      beforeJson: {
        disputeStatus: dispute.status,
      },
      afterJson: {
        disputeStatus: DisputeStatus.RESOLVED,
        winnerSide: dto.winnerSide,
      },
    });

    return {
      matchId,
      status: MatchStatus.SETTLED,
    };
  }

  async listDisputes(status?: DisputeStatus) {
    return this.prisma.dispute.findMany({
      where: {
        ...(status ? { status } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async adminResolveDispute(
    user: RequestUser,
    disputeId: string,
    dto: ResolveDisputeDto,
    nextStatus: DisputeStatus = DisputeStatus.RESOLVED,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: {
        id: disputeId,
      },
    });
    if (!dispute) {
      throw new NotFoundException('NOT_FOUND');
    }

    const currentMatch = await this.prisma.match.findUnique({
      where: { id: dispute.matchId },
      select: { status: true },
    });
    const context = await this.getMatchContext(dispute.matchId);
    if (!context) {
      throw new NotFoundException('NOT_FOUND');
    }

    await this.prisma.dispute.update({
      where: {
        id: disputeId,
      },
      data: {
        status: nextStatus,
        resolvedByUserId: user.id,
        resolutionJson: {
          winnerSide: dto.winnerSide,
          resolutionNote: dto.resolutionNote ?? null,
        },
      },
    });
    if (nextStatus === DisputeStatus.RESOLVED) {
      await this.prisma.match.update({
        where: {
          id: dispute.matchId,
        },
        data: {
          status: MatchStatus.SETTLED,
          endedAt: new Date(),
        },
      });
      await this.updateBookingStatus(context.bookingId, BookingStatus.COMPLETED);
      await this.syncTournamentMatchStatus(context, MatchStatus.SETTLED, dto.winnerSide);
      await this.advanceTournamentBracketFromWinner(context, dto.winnerSide);
      if (currentMatch?.status !== MatchStatus.SETTLED && currentMatch?.status !== MatchStatus.FORFEIT) {
        await this.applySettlementStats(context, dto.winnerSide);
        this.metrics.incrementCounter('match_settled_total', 1, {
          mode: context.kind,
          reason: 'ADMIN_RESOLUTION',
        });
      }
      await this.maybeCompleteTournament(context.tournamentId);
    }

    await this.audit.log({
      actorUserId: user.id,
      action: nextStatus === DisputeStatus.ESCALATED ? 'dispute.escalate' : 'dispute.admin_resolve',
      objectType: 'dispute',
      objectId: disputeId,
      beforeJson: {
        status: dispute.status,
      },
      afterJson: {
        status: nextStatus,
        winnerSide: dto.winnerSide,
      },
    });

    return {
      disputeId,
      status: nextStatus,
    };
  }

  private async mustGetManagedMatch(user: RequestUser, matchId: string): Promise<MatchContext> {
    const context = await this.getMatchContext(matchId);
    if (!context) {
      throw new NotFoundException('NOT_FOUND');
    }

    const canManage =
      user.role === 'ADMIN' ||
      user.id === context.ownerUserId ||
      (user.vendorId !== null && user.vendorId === context.vendorId);
    if (!canManage) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return context;
  }

  private async mustGetCaptainContext(user: RequestUser, matchId: string): Promise<MatchContext> {
    const context = await this.getMatchContext(matchId);
    if (!context) {
      throw new NotFoundException('NOT_FOUND');
    }

    const isCaptain = context.captainAUserId === user.id || context.captainBUserId === user.id;
    if (!isCaptain) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return context;
  }

  private async getMatchContext(matchId: string): Promise<MatchContext | null> {
    const challengeMatch = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        deletedAt: null,
      },
      include: {
        challenge: {
          include: {
            booking: {
              include: {
                resource: {
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
                },
              },
            },
            teams: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });
    if (challengeMatch?.challenge) {
      const teamA = challengeMatch.challenge.teams.find((team) => team.side === TeamSide.A);
      const teamB = challengeMatch.challenge.teams.find((team) => team.side === TeamSide.B);
      return {
        matchId,
        kind: 'CHALLENGE',
        bookingId: challengeMatch.challenge.booking.id,
        challengeId: challengeMatch.challenge.id,
        tournamentId: null,
        tournamentMatchId: null,
        sideAEntryId: null,
        sideBEntryId: null,
        sportId: challengeMatch.challenge.sportId,
        vendorId: challengeMatch.challenge.booking.resource.venue.vendor.id,
        ownerUserId: challengeMatch.challenge.booking.resource.venue.vendor.ownerUserId,
        captainAUserId: teamA?.captainUserId ?? null,
        captainBUserId: teamB?.captainUserId ?? null,
      };
    }

    const tournamentMatchLink = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        deletedAt: null,
      },
      select: {
        tournamentMatchId: true,
      },
    });
    if (!tournamentMatchLink?.tournamentMatchId) {
      return null;
    }

    const tournamentMatch = await this.prisma.tournamentMatch.findFirst({
      where: {
        id: tournamentMatchLink.tournamentMatchId,
        deletedAt: null,
      },
      include: {
        tournament: {
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
        },
      },
    });
    if (!tournamentMatch) {
      return null;
    }

    const sideEntryIds = [
      tournamentMatch.sideAEntryId,
      tournamentMatch.sideBEntryId,
    ].filter((value): value is string => Boolean(value));
    const entries = sideEntryIds.length
      ? await this.prisma.tournamentEntry.findMany({
          where: {
            id: {
              in: sideEntryIds,
            },
            deletedAt: null,
          },
          select: {
            id: true,
            captainUserId: true,
          },
        })
      : [];
    const captainByEntryId = new Map(entries.map((row) => [row.id, row.captainUserId]));

    const booking =
      tournamentMatch.resourceId && tournamentMatch.startTs
        ? await this.prisma.booking.findFirst({
            where: {
              resourceId: tournamentMatch.resourceId,
              startTs: tournamentMatch.startTs,
              type: BookingType.TOURNAMENT,
              deletedAt: null,
            },
            select: {
              id: true,
            },
          })
        : null;

    return {
      matchId,
      kind: 'TOURNAMENT',
      bookingId: booking?.id ?? null,
      challengeId: null,
      tournamentId: tournamentMatch.tournament.id,
      tournamentMatchId: tournamentMatch.id,
      sideAEntryId: tournamentMatch.sideAEntryId,
      sideBEntryId: tournamentMatch.sideBEntryId,
      sportId: tournamentMatch.tournament.sportId,
      vendorId: tournamentMatch.tournament.venue.vendor.id,
      ownerUserId: tournamentMatch.tournament.venue.vendor.ownerUserId,
      captainAUserId: tournamentMatch.sideAEntryId
        ? (captainByEntryId.get(tournamentMatch.sideAEntryId) ?? null)
        : null,
      captainBUserId: tournamentMatch.sideBEntryId
        ? (captainByEntryId.get(tournamentMatch.sideBEntryId) ?? null)
        : null,
    };
  }

  private async updateBookingStatus(bookingId: string | null, status: BookingStatus): Promise<void> {
    if (!bookingId) {
      return;
    }
    await this.prisma.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status,
      },
    });
  }

  private async syncTournamentMatchStatus(
    context: MatchContext,
    status: MatchStatus,
    winnerSide?: TeamSide,
  ): Promise<void> {
    if (context.kind !== 'TOURNAMENT' || !context.tournamentMatchId) {
      return;
    }

    const winnerEntryId =
      winnerSide === TeamSide.A
        ? context.sideAEntryId
        : winnerSide === TeamSide.B
          ? context.sideBEntryId
          : null;

    await this.prisma.tournamentMatch.update({
      where: {
        id: context.tournamentMatchId,
      },
      data: {
        status,
        ...(winnerSide ? { winnerEntryId } : {}),
      },
    });
  }

  private async advanceTournamentBracketFromWinner(
    context: MatchContext,
    winnerSide: TeamSide,
  ): Promise<void> {
    if (
      context.kind !== 'TOURNAMENT' ||
      !context.tournamentId ||
      !context.tournamentMatchId
    ) {
      return;
    }

    const winnerEntryId =
      winnerSide === TeamSide.A ? context.sideAEntryId : context.sideBEntryId;
    if (!winnerEntryId) {
      return;
    }

    const current = await this.prisma.tournamentMatch.findUnique({
      where: {
        id: context.tournamentMatchId,
      },
      select: {
        tournamentId: true,
        round: true,
        matchIndex: true,
      },
    });
    if (!current) {
      return;
    }

    const nextRound = current.round + 1;
    const nextMatchIndex = Math.ceil(current.matchIndex / 2);
    const next = await this.prisma.tournamentMatch.findUnique({
      where: {
        tournamentId_round_matchIndex: {
          tournamentId: current.tournamentId,
          round: nextRound,
          matchIndex: nextMatchIndex,
        },
      },
      select: {
        id: true,
        sideAEntryId: true,
        sideBEntryId: true,
        winnerEntryId: true,
      },
    });
    if (!next) {
      return;
    }
    if (next.winnerEntryId) {
      return;
    }

    const winningSideField = current.matchIndex % 2 === 1 ? 'sideAEntryId' : 'sideBEntryId';
    const currentSideValue =
      winningSideField === 'sideAEntryId' ? next.sideAEntryId : next.sideBEntryId;
    if (currentSideValue && currentSideValue !== winnerEntryId) {
      return;
    }
    if (currentSideValue === winnerEntryId) {
      if (next.sideAEntryId && next.sideBEntryId) {
        await this.ensureTournamentLinkedMatch(next.id);
      }
      return;
    }

    const nextUpdated = await this.prisma.tournamentMatch.update({
      where: {
        id: next.id,
      },
      data: {
        [winningSideField]: winnerEntryId,
        status: MatchStatus.SCHEDULED,
        winnerEntryId: null,
      },
      select: {
        id: true,
        sideAEntryId: true,
        sideBEntryId: true,
      },
    });

    if (nextUpdated.sideAEntryId && nextUpdated.sideBEntryId) {
      await this.ensureTournamentLinkedMatch(nextUpdated.id);
    }
  }

  private async ensureTournamentLinkedMatch(tournamentMatchId: string): Promise<void> {
    const existing = await this.prisma.match.findFirst({
      where: {
        tournamentMatchId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
    if (existing) {
      return;
    }

    await this.prisma.match.create({
      data: {
        tournamentMatchId,
        status: MatchStatus.SCHEDULED,
      },
    });
  }

  private async maybeCompleteTournament(tournamentId: string | null): Promise<void> {
    if (!tournamentId) {
      return;
    }

    const unresolved = await this.prisma.tournamentMatch.findFirst({
      where: {
        tournamentId,
        deletedAt: null,
        status: {
          in: [
            MatchStatus.SCHEDULED,
            MatchStatus.CHECKIN_OPEN,
            MatchStatus.IN_PROGRESS,
            MatchStatus.RESULT_PENDING,
            MatchStatus.DISPUTED,
          ],
        },
      },
      select: {
        id: true,
      },
    });
    if (!unresolved) {
      await this.prisma.tournament.update({
        where: {
          id: tournamentId,
        },
        data: {
          status: TournamentStatus.COMPLETED,
        },
      });
    }
  }

  private async applySettlementStats(context: MatchContext, winnerSide: TeamSide): Promise<void> {
    const winnerCaptainUserId =
      winnerSide === TeamSide.A ? context.captainAUserId : context.captainBUserId;
    const loserCaptainUserId =
      winnerSide === TeamSide.A ? context.captainBUserId : context.captainAUserId;
    if (!winnerCaptainUserId || !loserCaptainUserId) {
      return;
    }

    await this.statsService.applyMatchSettlement({
      sportId: context.sportId,
      winnerCaptainUserId,
      loserCaptainUserId,
    });
  }
}
