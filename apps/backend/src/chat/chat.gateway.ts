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

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: 'https://localhost',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private readonly connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        throw new WsException('missing token');
      }

      const payload = await this.jwtService.verifyAsync<SocketUser & { sub: string }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive || user.isBanned) {
        throw new WsException('unauthorized');
      }

      client.data.user = {
        sub: user.id,
        username: user.username,
        role: user.globalRole,
      } satisfies SocketUser;

      await client.join(`user:${user.id}`);
      this.addConnectedUser(user.id, client.id);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
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

  private async getLiveSocketUserOrThrow(client: Socket) {
    const socketUser = client.data.user as SocketUser | undefined;

    if (!socketUser) {
      throw new WsException('missing authenticated user');
    }

    const user = await this.prisma.user.findUnique({
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

  async emitMessageCreated(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('chat.message.created', message);
  }

  async emitMessageUpdated(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('chat.message.updated', message);
  }

  async emitMessageDeleted(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('chat.message.deleted', message);
  }

  async emitConversationRead(conversationId: string, payload: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('chat.conversation.read', payload);
  }

  async emitNotificationCreated(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification.created', notification);
  }

  @SubscribeMessage('chat.joinConversation')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    const membership = await this.prisma.conversationParticipant.findFirst({
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
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    await this.getLiveSocketUserOrThrow(client);

    await client.leave(`conversation:${body.conversationId}`);

    return { ok: true };
  }

  @SubscribeMessage('chat.sendMessage')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; content: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string' || typeof body?.content !== 'string') {
      throw new WsException('invalid message payload');
    }

    const message = await this.chatService.sendMessage(
      socketUser.sub,
      body.conversationId,
      body.content,
    );

    await this.emitMessageCreated(body.conversationId, message);
    /*await this.emitNotificationCreated(body.conversationId, {
      id: message.id,
      type: 'message',
      content: `New message from ${socketUser.username}`,
      link: `/chat/${body.conversationId}`,
    });*/

    const recipientIds = await this.chatService.getOtherParticipantIds(
      body.conversationId,
      socketUser.sub,
    );

    const preview =
      body.content.trim().length > 80
        ? `${body.content.trim().slice(0, 80)}...`
        : body.content.trim();

    const notifications = await this.notificationsService.createForMany(
      recipientIds,
      'MESSAGE',
      'New message',
      preview,
    );

    for (const notification of notifications) {
      await this.emitNotificationCreated(notification.userId, notification);
    }

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('chat.editMessage')
  async editMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; messageId: string; content: string },
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

    await this.emitMessageUpdated(body.conversationId, message);

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('chat.deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; messageId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string' || typeof body?.messageId !== 'string') {
      throw new WsException('invalid delete payload');
    }

    const message = await this.chatService.deleteMessage(
      socketUser.sub,
      body.conversationId,
      body.messageId,
    );

    await this.emitMessageDeleted(body.conversationId, message);

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('chat.markRead')
  async markRead(
    @ConnectedSocket() client: Socket,
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

    await this.emitConversationRead(body.conversationId, {
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
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string') {
      throw new WsException('invalid typing payload');
    }

    await this.chatService.ensureConversationMembership(socketUser.sub, body.conversationId);

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
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);

    if (typeof body?.conversationId !== 'string') {
      throw new WsException('invalid typing payload');
    }

    await this.chatService.ensureConversationMembership(socketUser.sub, body.conversationId);

    client.to(`conversation:${body.conversationId}`).emit('chat.typing', {
      conversationId: body.conversationId,
      userId: socketUser.sub,
      username: socketUser.username,
      isTyping: false,
    });

    return { ok: true };
  }

  @SubscribeMessage('presence.list')
  async listPresence(@ConnectedSocket() client: Socket) {
    await this.getLiveSocketUserOrThrow(client);

    return {
      onlineUserIds: [...this.connectedUsers.keys()],
    };
  }

  @SubscribeMessage('user.joinOwnRoom')
  async joinOwnRoom(@ConnectedSocket() client: Socket) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);
    await client.join(`user:${socketUser.sub}`);
    return { ok: true };
  }

}
