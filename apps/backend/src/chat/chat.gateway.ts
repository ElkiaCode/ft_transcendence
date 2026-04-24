import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

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
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
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
    } catch {
      client.disconnect();
    }
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

    return {
      ok: true,
      messageId: message.id,
    };
  }

  @SubscribeMessage('user.joinOwnRoom')
  async joinOwnRoom(@ConnectedSocket() client: Socket) {
    const socketUser = await this.getLiveSocketUserOrThrow(client);
    await client.join(`user:${socketUser.sub}`);
    return { ok: true };
  }

}