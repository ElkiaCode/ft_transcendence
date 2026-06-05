import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { NotificationsService } from '../notifications/notifications.service';

type SocketUser = {
  sub: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
};

interface CustomSocketData {
  user: SocketUser;
}

// Define a custom Socket type that uses our data interface
type AuthenticatedSocket = Socket<any, any, any, CustomSocketData>;

interface JwtPayload {
  sub: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

// Define what your sendMessage returns so we don't use 'any'
interface ChatMessageResult {
  id: string;
  content: string;
  banAnnouncementMessage?: any; // Replace 'any' with your actual Message type
  moderationWarning?: {
    isBanned: boolean;
    banReason?: string;
    penaltyPoints?: number;
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: 'https://localhost',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  private readonly connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly notificationsService: NotificationsService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      this.authenticateSocket(socket as AuthenticatedSocket)
        .then(() => next())
        .catch((err: unknown) => {
          if (err instanceof Error) {
            return next(err);
          }
          next(new Error('Authentication error'));
        });
    });
  }

  private async authenticateSocket(socket: AuthenticatedSocket) {
    const token = socket.handshake.auth?.['token'] as string | undefined;
    if (!token) {
      throw new Error('Authentication error: Missing token');
    }

    try {
      // Verify JWT
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      });
      // Fetch User
      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive || user.isBanned) {
        throw new Error('Authentication error: Unauthorized');
      }
      // 2. SET THE USER HERE (Guaranteed to be ready for events)
      socket.data.user = {
        sub: user.id,
        username: user.username,
        role: user.globalRole,
      } as SocketUser;
    } catch {
      throw new Error('Authentication error: Invalid token');
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    const user = client.data.user; //no more linting error since AuthenticatedSocket
    if (user) {
      await client.join(`user:${user.sub}`);
      this.addConnectedUser(user.sub, client.id);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const socketUser = client.data.user as SocketUser | undefined;

    if (!socketUser) {
      return;
    }

    this.removeConnectedUser(socketUser.sub, client.id);
  }

  private addConnectedUser(userId: string, socketId: string) {
    const sockets = this.connectedUsers.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    this.connectedUsers.set(userId, sockets);

    if (wasOffline) {
      this.server.emit('presence.changed', {
        userId,
        isOnline: true,
      });
    }
  }

  private removeConnectedUser(userId: string, socketId: string) {
    const sockets = this.connectedUsers.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size > 0) {
      return;
    }

    this.connectedUsers.delete(userId);
    this.server.emit('presence.changed', {
      userId,
      isOnline: false,
    });
  }

  private async getLiveSocketUserOrThrow(client: AuthenticatedSocket) {
    const socketUser = client.data.user as SocketUser | undefined;

    if (!socketUser) {
      throw new WsException('missing authenticated user');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: socketUser.sub },
    });

    if (!user) {
      throw new WsException('user not found');
    }

    if (!user.isActive) {
      throw new WsException('account is inactive');
    }

    if (user.isBanned) {
      throw new WsException('account is banned');
    }

    return socketUser;
  }

  emitMessageCreated(conversationId: string, message: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('chat.message.created', message);
  }

  emitMessageUpdated(conversationId: string, message: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('chat.message.updated', message);
  }

  emitMessageDeleted(conversationId: string, message: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('chat.message.deleted', message);
  }

  emitConversationRead(conversationId: string, payload: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('chat.conversation.read', payload);
  }

  emitNotificationCreated(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification.created', notification);
  }

  emitModerationWarning(userId: string, warning: unknown) {
    this.server.to(`user:${userId}`).emit('chat.moderation.warning', warning);
  }

  async emitModerationBanAndDisconnect(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('chat.moderation.banned', payload);
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.server.in(`user:${userId}`).disconnectSockets(true);
  }

  @SubscribeMessage('chat.joinConversation')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    const membership =
      await this.prisma.client.conversationParticipant.findFirst({
        where: {
          conversationId: body.conversationId,
          userId: socketUser.sub,
        },
      });

    if (!membership) {
      throw new WsException('not a participant');
    }

    await client.join(`conversation:${body.conversationId}`);

    return {
      ok: true,
      conversationId: body.conversationId,
    };
  }

  @SubscribeMessage('chat.leaveConversation')
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = await this.getLiveSocketUserOrThrow(client);

    await this.prisma.client.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: body.conversationId,
          userId: user.sub,
        },
      },
      data: { leftAt: new Date() },
    });

    await client.leave(`conversation:${body.conversationId}`);

    return { ok: true };
  }

  @SubscribeMessage('chat.sendMessage')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; content: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (
      typeof body?.conversationId !== 'string' ||
      typeof body?.content !== 'string'
    ) {
      throw new WsException('invalid message payload');
    }

    const message = (await this.chatService.sendMessage(
      socketUser.sub,
      body.conversationId,
      body.content,
    )) as unknown as ChatMessageResult;

    console.log(`📩 Message received from ${client.id}:`, body);

    this.emitMessageCreated(body.conversationId, message);

    if (message.banAnnouncementMessage) {
      this.emitMessageCreated(
        body.conversationId,
        message.banAnnouncementMessage,
      );
    }

    if (message.moderationWarning) {
      this.emitModerationWarning(socketUser.sub, message.moderationWarning);

      if (message.moderationWarning.isBanned) {
        await this.emitModerationBanAndDisconnect(socketUser.sub, {
          message: 'Your account was banned by automatic moderation.',
          reason: message.moderationWarning.banReason ?? 'harmful message',
          penaltyPoints: message.moderationWarning.penaltyPoints,
        });
      }
    }

    const recipientIds = await this.chatService.getOtherParticipantIds(
      body.conversationId,
      socketUser.sub,
    );

    const messageContent = message.content ?? 'New message';
    const preview =
      messageContent.trim().length > 80
        ? `${messageContent.trim().slice(0, 80)}...`
        : messageContent.trim();

    const notifications = await this.notificationsService.createForMany(
      recipientIds,
      'MESSAGE',
      'New message',
      preview,
    );

    for (const notification of notifications) {
      this.emitNotificationCreated(notification.userId, notification);
    }

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('chat.editMessage')
  async editMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { conversationId: string; messageId: string; content: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (
      typeof body?.conversationId !== 'string' ||
      typeof body?.messageId !== 'string' ||
      typeof body?.content !== 'string'
    ) {
      throw new WsException('invalid edit payload');
    }

    const message = await this.chatService.editMessage(
      socketUser.sub,
      body.conversationId,
      body.messageId,
      body.content,
    );

    this.emitMessageUpdated(body.conversationId, message);

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('chat.deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; messageId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (
      typeof body?.conversationId !== 'string' ||
      typeof body?.messageId !== 'string'
    ) {
      throw new WsException('invalid delete payload');
    }

    const message = await this.chatService.deleteMessage(
      socketUser.sub,
      body.conversationId,
      body.messageId,
    );

    this.emitMessageDeleted(body.conversationId, message);

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('chat.markRead')
  async markRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; messageId?: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string') {
      throw new WsException('invalid read payload');
    }

    const result = await this.chatService.markConversationRead(
      socketUser.sub,
      body.conversationId,
      typeof body.messageId === 'string' ? body.messageId : undefined,
    );

    this.emitConversationRead(body.conversationId, {
      userId: socketUser.sub,
      conversationId: body.conversationId,
      messageId: body.messageId ?? null,
      readCount: result.readCount,
    });

    return {
      ok: true,
      readCount: result.readCount,
    };
  }

  @SubscribeMessage('chat.typing.start')
  async startTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string') {
      throw new WsException('invalid typing payload');
    }

    await this.chatService.ensureConversationMembership(
      socketUser.sub,
      body.conversationId,
    );

    client.to(`conversation:${body.conversationId}`).emit('chat.typing', {
      conversationId: body.conversationId,
      userId: socketUser.sub,
      username: socketUser.username,
      isTyping: true,
    });

    return { ok: true };
  }

  @SubscribeMessage('chat.typing.stop')
  async stopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string') {
      throw new WsException('invalid typing payload');
    }

    await this.chatService.ensureConversationMembership(
      socketUser.sub,
      body.conversationId,
    );

    client.to(`conversation:${body.conversationId}`).emit('chat.typing', {
      conversationId: body.conversationId,
      userId: socketUser.sub,
      username: socketUser.username,
      isTyping: false,
    });

    return { ok: true };
  }

  @SubscribeMessage('presence.list')
  async listPresence(@ConnectedSocket() client: AuthenticatedSocket) {
    await this.getLiveSocketUserOrThrow(client);

    return {
      onlineUserIds: [...this.connectedUsers.keys()],
    };
  }

  @SubscribeMessage('user.joinOwnRoom')
  async joinOwnRoom(@ConnectedSocket() client: AuthenticatedSocket) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);
    await client.join(`user:${socketUser.sub}`);
    return { ok: true };
  }
}

// async handleConnection(client: Socket) {
//   console.log('New connection attempt...');
//   try {
//     const token = client.handshake.auth?.token;

//     if (!token) {
//       throw new WsException('missing token');
//     }

//     const payload = await this.jwtService.verifyAsync<
//       SocketUser & { sub: string }
//     >(token, {
//       secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
//     });

//     const user = await this.prisma.user.findUnique({
//       where: { id: payload.sub },
//     });

//     if (!user || !user.isActive || user.isBanned) {
//       throw new WsException('unauthorized');
//     }

//     client.data.user = {
//       sub: user.id,
//       username: user.username,
//       role: user.globalRole,
//     } satisfies SocketUser;

//     await client.join(`user:${user.id}`);
//     this.addConnectedUser(user.id, client.id);
//   } catch (err) {
//     console.error('❌ Connection Auth Failed:', err.message);
//     client.disconnect();
//   }
// }
