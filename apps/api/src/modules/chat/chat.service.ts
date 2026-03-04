import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatRole,
  ConversationStatus,
  ConversationType,
  MessageReportStatus,
  MessageStatus,
} from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  DeleteMessageDto,
  ListMessagesQueryDto,
  MuteParticipantDto,
  ReportMessageDto,
  ReviewMessageReportDto,
  SendMessageDto,
} from './chat.dto';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  private readonly userWindow = new Map<string, number[]>();
  private readonly conversationWindow = new Map<string, number[]>();
  private readonly reportWindow = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
    private readonly metrics: MetricsService,
  ) {}

  async listConversations(user: RequestUser) {
    const participantRows = await this.prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        conversation: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      include: {
        conversation: {
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
              },
            },
            tournament: {
              include: {
                venue: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 200,
    });

    const supportVenueIds = participantRows
      .filter((row) => row.conversation.type === ConversationType.VENUE_SUPPORT && row.conversation.venueId)
      .map((row) => row.conversation.venueId as string);
    const supportVenues = supportVenueIds.length
      ? await this.prisma.venue.findMany({
          where: {
            id: {
              in: supportVenueIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];
    const venueNameById = new Map(supportVenues.map((row) => [row.id, row.name]));

    return {
      conversations: participantRows.map((row) => ({
        id: row.conversation.id,
        type: row.conversation.type,
        status: row.conversation.status,
        challengeId: row.conversation.challengeId,
        title: resolveConversationTitle(row, venueNameById),
      })),
    };
  }

  async openVenueSupportConversation(user: RequestUser, venueId: string) {
    const venue = await this.prisma.venue.findFirst({
      where: {
        id: venueId,
        deletedAt: null,
      },
      include: {
        vendor: {
          select: {
            ownerUserId: true,
            status: true,
          },
        },
      },
    });
    if (!venue) {
      throw new NotFoundException('NOT_FOUND');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.VENUE_SUPPORT,
        venueId,
        createdByUserId: user.id,
        status: ConversationStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
    const conversation = existing
      ? await this.prisma.conversation.update({
          where: { id: existing.id },
          data: { status: ConversationStatus.ACTIVE },
        })
      : await this.prisma.conversation.create({
          data: {
            type: ConversationType.VENUE_SUPPORT,
            venueId,
            createdByUserId: user.id,
            status: ConversationStatus.ACTIVE,
          },
        });

    await this.prisma.conversationParticipant.createMany({
      data: [
        {
          conversationId: conversation.id,
          userId: user.id,
          roleInChat: ChatRole.MEMBER,
        },
        {
          conversationId: conversation.id,
          userId: venue.vendor.ownerUserId,
          roleInChat: ChatRole.MODERATOR,
        },
      ],
      skipDuplicates: true,
    });

    await this.gateway.emitConversationParticipants(conversation.id);

    return {
      conversationId: conversation.id,
    };
  }

  async listMessages(user: RequestUser, conversationId: string, query: ListMessagesQueryDto) {
    await this.assertParticipant(user.id, conversationId);

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return {
      messages: rows.reverse().map((row) => ({
        ...row,
        body:
          row.status === MessageStatus.DELETED_BY_MOD || row.status === MessageStatus.DELETED_BY_USER
            ? '[Message removed]'
            : row.body,
      })),
      nextCursor: rows.length === 50 ? rows[rows.length - 1].createdAt.toISOString() : null,
    };
  }

  async sendMessage(user: RequestUser, conversationId: string, dto: SendMessageDto) {
    const participant = await this.assertParticipant(user.id, conversationId);
    if (participant.mutedUntil && participant.mutedUntil > new Date()) {
      throw new ForbiddenException('FORBIDDEN');
    }

    this.assertRateLimits(user.id, conversationId, participant.conversation.type);

    const created = await this.prisma.message.create({
      data: {
        conversationId,
        senderUserId: user.id,
        body: dto.body.trim(),
      },
    });

    this.metrics.incrementCounter('chat_messages_total', 1, {
      conversationType: participant.conversation.type,
    });
    await this.gateway.emitMessageCreated(created);
    return created;
  }

  async muteParticipant(
    user: RequestUser,
    conversationId: string,
    dto: MuteParticipantDto,
  ): Promise<{ ok: true }> {
    await this.assertModerationAccess(user, conversationId);

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: dto.userId,
        deletedAt: null,
      },
    });
    if (!participant) {
      throw new NotFoundException('NOT_FOUND');
    }

    const mutedUntil = dto.mutedUntilTs ? new Date(dto.mutedUntilTs) : new Date(Date.now() + 60 * 60 * 1000);
    const updated = await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: dto.userId,
        },
      },
      data: {
        mutedUntil,
      },
    });

    await this.logAudit({
      actorUserId: user.id,
      action: 'chat.participant.mute',
      objectType: 'conversation_participant',
      objectId: updated.id,
      beforeJson: {
        mutedUntil: participant.mutedUntil?.toISOString() ?? null,
      },
      afterJson: {
        mutedUntil: updated.mutedUntil?.toISOString() ?? null,
      },
    });

    return { ok: true };
  }

  async deleteMessageByModerator(
    user: RequestUser,
    messageId: string,
    dto: DeleteMessageDto,
  ): Promise<{ ok: true }> {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        deletedAt: null,
      },
      include: {
        conversation: {
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
              },
            },
          },
        },
      },
    });
    if (!message) {
      throw new NotFoundException('NOT_FOUND');
    }

    await this.assertModerationAccess(user, message.conversationId);

    const updated = await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        status: MessageStatus.DELETED_BY_MOD,
        body: '',
      },
    });

    await this.logAudit({
      actorUserId: user.id,
      action: 'chat.message.delete_by_mod',
      objectType: 'message',
      objectId: messageId,
      beforeJson: {
        status: message.status,
        body: message.body,
      },
      afterJson: {
        status: updated.status,
        reason: dto.reason ?? null,
      },
    });
    await this.gateway.emitMessageUpdated(updated);

    return { ok: true };
  }

  async reportMessage(
    user: RequestUser,
    messageId: string,
    dto: ReportMessageDto,
  ): Promise<{ ok: true }> {
    this.assertReportRateLimit(user.id);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        deletedAt: null,
      },
      select: {
        conversationId: true,
      },
    });
    if (!message) {
      throw new NotFoundException('NOT_FOUND');
    }

    await this.assertParticipant(user.id, message.conversationId);

    await this.prisma.messageReport.create({
      data: {
        messageId,
        reportedByUserId: user.id,
        reason: dto.reason,
        status: MessageReportStatus.OPEN,
      },
    });
    this.metrics.incrementCounter('chat_reports_total');

    await this.logAudit({
      actorUserId: user.id,
      action: 'chat.message.report',
      objectType: 'message',
      objectId: messageId,
      beforeJson: null,
      afterJson: {
        reason: dto.reason,
      },
    });

    return { ok: true };
  }

  async listMessageReports(status?: MessageReportStatus) {
    return this.prisma.messageReport.findMany({
      where: {
        ...(status ? { status } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });
  }

  async reviewMessageReport(
    user: RequestUser,
    reportId: string,
    dto: ReviewMessageReportDto,
  ): Promise<{ ok: true }> {
    const report = await this.prisma.messageReport.findUnique({
      where: {
        id: reportId,
      },
    });
    if (!report) {
      throw new NotFoundException('NOT_FOUND');
    }

    await this.prisma.messageReport.update({
      where: { id: reportId },
      data: {
        status: dto.status,
      },
    });

    await this.logAudit({
      actorUserId: user.id,
      action: 'chat.report.review',
      objectType: 'message_report',
      objectId: reportId,
      beforeJson: {
        status: report.status,
      },
      afterJson: {
        status: dto.status,
      },
    });

    return { ok: true };
  }

  private assertRateLimits(userId: string, conversationId: string, type: ConversationType) {
    const now = Date.now();

    const userKey = `u:${userId}`;
    const userEvents = (this.userWindow.get(userKey) ?? []).filter((ts) => now - ts <= 10_000);
    if (userEvents.length >= 10) {
      throw new HttpException('RATE_LIMITED', 429);
    }
    userEvents.push(now);
    this.userWindow.set(userKey, userEvents);

    const conversationKey = `c:${conversationId}`;
    const conversationEvents = (this.conversationWindow.get(conversationKey) ?? []).filter(
      (ts) => now - ts <= 60_000,
    );
    const maxPerMinute = type === ConversationType.TOURNAMENT ? 40 : 60;
    if (conversationEvents.length >= maxPerMinute) {
      throw new HttpException('RATE_LIMITED', 429);
    }
    conversationEvents.push(now);
    this.conversationWindow.set(conversationKey, conversationEvents);
  }

  private assertReportRateLimit(userId: string): void {
    const now = Date.now();
    const reportEvents = (this.reportWindow.get(userId) ?? []).filter((ts) => now - ts <= 60_000);
    if (reportEvents.length >= 5) {
      throw new HttpException('RATE_LIMITED', 429);
    }
    reportEvents.push(now);
    this.reportWindow.set(userId, reportEvents);
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        deletedAt: null,
        conversation: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      include: {
        conversation: {
          select: {
            type: true,
          },
        },
      },
    });
    if (!participant) {
      throw new NotFoundException('NOT_FOUND');
    }
    return participant;
  }

  private async assertModerationAccess(user: RequestUser, conversationId: string): Promise<void> {
    if (user.role === 'ADMIN') {
      return;
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
        status: ConversationStatus.ACTIVE,
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
          },
        },
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
    if (!conversation) {
      throw new NotFoundException('NOT_FOUND');
    }

    let vendorRef:
      | {
          id: string;
          ownerUserId: string;
        }
      | undefined;
    if (conversation.type === ConversationType.CHALLENGE) {
      vendorRef = conversation.challenge?.booking.resource.venue.vendor;
    } else if (conversation.type === ConversationType.TOURNAMENT) {
      vendorRef = conversation.tournament?.venue.vendor;
    } else if (conversation.type === ConversationType.VENUE_SUPPORT && conversation.venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: {
          id: conversation.venueId,
        },
        include: {
          vendor: {
            select: {
              id: true,
              ownerUserId: true,
            },
          },
        },
      });
      vendorRef = venue?.vendor;
    }
    if (!vendorRef) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const canModerate =
      user.id === vendorRef.ownerUserId ||
      (user.vendorId !== null && user.vendorId === vendorRef.id);
    if (!canModerate) {
      throw new ForbiddenException('FORBIDDEN');
    }
  }

  private async logAudit(params: {
    actorUserId: string;
    action: string;
    objectType: string;
    objectId: string;
    beforeJson: Record<string, unknown> | null;
    afterJson: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: params.actorUserId,
          action: params.action,
          objectType: params.objectType,
          objectId: params.objectId,
          beforeJson: (params.beforeJson as Prisma.InputJsonValue | null | undefined) ?? undefined,
          afterJson: (params.afterJson as Prisma.InputJsonValue | null | undefined) ?? undefined,
        },
      });
    } catch {
      // Best-effort audit persistence.
    }
  }
}

function resolveConversationTitle(
  row: {
    conversation: {
      type: ConversationType;
      venueId: string | null;
      challenge?: { booking: { resource: { venue: { name: string } } } } | null;
      tournament?: { venue: { name: string } } | null;
    };
  },
  venueNameById: Map<string, string>,
): string {
  if (row.conversation.type === ConversationType.CHALLENGE) {
    return row.conversation.challenge?.booking.resource.venue.name ?? 'Challenge conversation';
  }
  if (row.conversation.type === ConversationType.VENUE_SUPPORT) {
    return row.conversation.venueId
      ? `Support: ${venueNameById.get(row.conversation.venueId) ?? row.conversation.venueId}`
      : 'Venue support';
  }
  if (row.conversation.type === ConversationType.TOURNAMENT) {
    return row.conversation.tournament?.venue.name
      ? `Tournament: ${row.conversation.tournament.venue.name}`
      : 'Tournament conversation';
  }
  return `${row.conversation.type} conversation`;
}
