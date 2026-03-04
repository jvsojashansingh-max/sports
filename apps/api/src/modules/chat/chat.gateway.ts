import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Message, UserRole } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { parseAccessToken } from '../../common/auth/token';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type AuthedSocket = Socket & {
  data: {
    userId?: string;
    role?: UserRole;
  };
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token = this.extractToken(client);
    const parsed = token ? parseAccessToken(token) : null;
    if (!parsed) {
      client.emit('chat.error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
      return;
    }

    client.data.userId = parsed.id;
    client.data.role = parsed.role;
    client.join(userRoom(parsed.id));
    this.refreshConnectedUsersMetric();
  }

  async handleDisconnect(client: AuthedSocket) {
    if (client.data.userId) {
      client.leave(userRoom(client.data.userId));
    }
    this.refreshConnectedUsersMetric();
  }

  @SubscribeMessage('chat.join_conversation')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = client.data.userId;
    const conversationId = body?.conversationId;
    if (!userId || !conversationId) {
      client.emit('chat.error', { code: 'VALIDATION_ERROR' });
      return;
    }

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
      select: {
        id: true,
      },
    });
    if (!participant) {
      client.emit('chat.error', { code: 'FORBIDDEN' });
      return;
    }

    client.join(conversationRoom(conversationId));
    client.emit('chat.joined_conversation', { conversationId });
  }

  @SubscribeMessage('chat.leave_conversation')
  leaveConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const conversationId = body?.conversationId;
    if (!conversationId) {
      return;
    }
    client.leave(conversationRoom(conversationId));
  }

  async emitMessageCreated(message: Message): Promise<void> {
    this.server.to(conversationRoom(message.conversationId)).emit('chat.message_created', {
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
    });

    // Reliable fallback path: notify participants in user rooms too.
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: message.conversationId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });
    for (const participant of participants) {
      this.server.to(userRoom(participant.userId)).emit('chat.message_created', {
        id: message.id,
        conversationId: message.conversationId,
        senderUserId: message.senderUserId,
        body: message.body,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      });
    }
  }

  async emitMessageUpdated(message: Message): Promise<void> {
    this.server.to(conversationRoom(message.conversationId)).emit('chat.message_updated', {
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    });

    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: message.conversationId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });
    for (const participant of participants) {
      this.server.to(userRoom(participant.userId)).emit('chat.message_updated', {
        id: message.id,
        conversationId: message.conversationId,
        senderUserId: message.senderUserId,
        body: message.body,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      });
    }
  }

  async emitConversationParticipants(conversationId: string): Promise<void> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, deletedAt: null },
      select: { userId: true },
    });
    for (const participant of participants) {
      this.server.to(userRoom(participant.userId)).emit('chat.conversation_available', {
        conversationId,
      });
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    return null;
  }

  private refreshConnectedUsersMetric(): void {
    const connectedClients = this.server?.engine?.clientsCount ?? 0;
    this.metrics.setGauge('websocket_connected_users', connectedClients);
  }
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}
