import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, ReviewType, TeamMemberStatus, TeamSide } from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateReviewDto } from './reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createReview(user: RequestUser, matchId: string, dto: CreateReviewDto) {
    const match = await this.prisma.match.findFirst({
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
                    venue: true,
                  },
                },
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
                      in: [TeamMemberStatus.ACCEPTED, TeamMemberStatus.INVITED],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!match || !match.challenge) {
      throw new NotFoundException('NOT_FOUND');
    }

    if (match.status !== MatchStatus.SETTLED && match.status !== MatchStatus.FORFEIT) {
      throw new ConflictException('CONFLICT');
    }

    const participantIds = new Set<string>();
    for (const team of match.challenge.teams) {
      participantIds.add(team.captainUserId);
      for (const member of team.members) {
        participantIds.add(member.userId);
      }
    }
    if (!participantIds.has(user.id)) {
      throw new ForbiddenException('FORBIDDEN');
    }

    if (dto.type === ReviewType.PLAYER) {
      if (!dto.targetUserId) {
        throw new BadRequestException('VALIDATION_ERROR');
      }
      if (!participantIds.has(dto.targetUserId)) {
        throw new BadRequestException('VALIDATION_ERROR');
      }
      if (dto.targetUserId === user.id) {
        throw new BadRequestException('VALIDATION_ERROR');
      }
    }

    try {
      const created = await this.prisma.review.create({
        data: {
          type: dto.type,
          matchId,
          reviewerUserId: user.id,
          targetVenueId: dto.type === ReviewType.VENUE ? match.challenge.booking.resource.venue.id : null,
          targetUserId: dto.type === ReviewType.PLAYER ? dto.targetUserId ?? null : null,
          rating: dto.rating,
          text: dto.text?.trim() || null,
        },
      });

      await this.audit.log({
        actorUserId: user.id,
        action: 'review.create',
        objectType: 'review',
        objectId: created.id,
        beforeJson: null,
        afterJson: {
          type: created.type,
          rating: created.rating,
        },
      });

      return created;
    } catch {
      throw new ConflictException('CONFLICT');
    }
  }
}
