import { Injectable, NotFoundException } from '@nestjs/common';
import { TeamMemberStatus, TournamentEntryStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateMeDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        defaultCityId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('NOT_FOUND');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId: userId,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    return {
      id: user.id,
      role: user.role,
      vendorId: vendor?.id ?? null,
      defaultCityId: user.defaultCityId,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    let updated;
    try {
      updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          displayName: dto.displayName,
          defaultCityId: dto.defaultCityId,
        },
        select: {
          id: true,
          role: true,
          defaultCityId: true,
        },
      });
    } catch {
      throw new NotFoundException('NOT_FOUND');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId: userId,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    return {
      id: updated.id,
      role: updated.role,
      vendorId: vendor?.id ?? null,
      defaultCityId: updated.defaultCityId,
    };
  }

  async getActivity(userId: string) {
    const [bookings, challengeRows, tournamentEntries] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          createdByUserId: userId,
          deletedAt: null,
        },
        orderBy: {
          startTs: 'desc',
        },
        take: 100,
        include: {
          resource: {
            include: {
              venue: true,
            },
          },
          challenge: {
            include: {
              match: {
                select: {
                  id: true,
                  status: true,
                },
              },
              conversation: {
                select: {
                  id: true,
                },
              },
              format: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.challenge.findMany({
        where: {
          deletedAt: null,
          teams: {
            some: {
              deletedAt: null,
              members: {
                some: {
                  userId,
                  deletedAt: null,
                  status: {
                    not: TeamMemberStatus.REMOVED,
                  },
                },
              },
            },
          },
        },
        orderBy: {
          booking: {
            startTs: 'desc',
          },
        },
        take: 100,
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
          format: {
            select: {
              id: true,
              name: true,
            },
          },
          match: {
            select: {
              id: true,
              status: true,
            },
          },
          conversation: {
            select: {
              id: true,
            },
          },
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
        },
      }),
      this.prisma.tournamentEntry.findMany({
        where: {
          captainUserId: userId,
          deletedAt: null,
          status: {
            in: [TournamentEntryStatus.PENDING, TournamentEntryStatus.CONFIRMED],
          },
        },
        orderBy: {
          tournament: {
            startTs: 'desc',
          },
        },
        take: 50,
        include: {
          tournament: {
            include: {
              venue: true,
              matches: {
                where: {
                  deletedAt: null,
                  OR: [{ sideAEntryId: { not: null } }, { sideBEntryId: { not: null } }],
                },
                orderBy: [{ round: 'asc' }, { matchIndex: 'asc' }],
              },
            },
          },
        },
      }),
    ]);

    const seenChallengeIds = new Set<string>();
    const challenges = challengeRows
      .filter((row) => {
        if (seenChallengeIds.has(row.id)) {
          return false;
        }
        seenChallengeIds.add(row.id);
        return true;
      })
      .map((row) => {
        const participantTeam = row.teams.find((team) =>
          team.members.some((member) => member.userId === userId),
        );
        const isCaptain = participantTeam?.captainUserId === userId;

        return {
          id: row.id,
          status: row.status,
          joinDeadlineTs: row.joinDeadlineTs,
          booking: {
            id: row.booking.id,
            status: row.booking.status,
            startTs: row.booking.startTs,
            endTs: row.booking.endTs,
            resource: {
              id: row.booking.resource.id,
              name: row.booking.resource.name,
              sportId: row.booking.resource.sportId,
              venue: {
                id: row.booking.resource.venue.id,
                name: row.booking.resource.venue.name,
                cityId: row.booking.resource.venue.cityId,
                address: row.booking.resource.venue.address,
              },
            },
          },
          format: row.format,
          teamSide: participantTeam?.side ?? null,
          participationRole: isCaptain ? 'CAPTAIN' : 'PLAYER',
          match: row.match,
          conversationId: row.conversation?.id ?? null,
        };
      });

    const createdBookingIds = new Set(bookings.map((row) => row.id));
    const myBookings = bookings.map((row) => ({
      id: row.id,
      status: row.status,
      type: row.type,
      startTs: row.startTs,
      endTs: row.endTs,
      resource: {
        id: row.resource.id,
        name: row.resource.name,
        sportId: row.resource.sportId,
        venue: {
          id: row.resource.venue.id,
          name: row.resource.venue.name,
          cityId: row.resource.venue.cityId,
          address: row.resource.venue.address,
        },
      },
      challenge: row.challenge
        ? {
            id: row.challenge.id,
            status: row.challenge.status,
            formatName: row.challenge.format.name,
            match: row.challenge.match,
            conversationId: row.challenge.conversation?.id ?? null,
          }
        : null,
    }));

    const joinedChallenges = challenges.filter((row) => !createdBookingIds.has(row.booking.id));

    const tournamentFixtures = tournamentEntries.map((entry) => {
      const relevantMatches = entry.tournament.matches
        .filter((match) => match.sideAEntryId === entry.id || match.sideBEntryId === entry.id)
        .map((match) => ({
          id: match.id,
          round: match.round,
          matchIndex: match.matchIndex,
          startTs: match.startTs,
          status: match.status,
          resourceId: match.resourceId,
          isAwaitingOpponent: !match.sideAEntryId || !match.sideBEntryId,
        }));

      return {
        entryId: entry.id,
        status: entry.status,
        tournament: {
          id: entry.tournament.id,
          sportId: entry.tournament.sportId,
          status: entry.tournament.status,
          startTs: entry.tournament.startTs,
          registrationDeadline: entry.tournament.registrationDeadline,
          venue: {
            id: entry.tournament.venue.id,
            name: entry.tournament.venue.name,
            cityId: entry.tournament.venue.cityId,
            address: entry.tournament.venue.address,
          },
        },
        fixtures: relevantMatches,
      };
    });

    return {
      bookings: myBookings,
      challengeParticipations: joinedChallenges,
      tournamentEntries: tournamentFixtures,
    };
  }
}
