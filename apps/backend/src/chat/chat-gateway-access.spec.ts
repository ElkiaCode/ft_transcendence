import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { describe, expect, it, jest } from '@jest/globals';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatGateway conversation access', () => {
  function createGateway() {
    const participantFindFirst = jest.fn().mockResolvedValue(null);
    const participantFindMany = jest.fn().mockResolvedValue([]);
    const ensureConversationMembership = jest.fn().mockResolvedValue({});
    const gateway = new ChatGateway(
      {} as JwtService,
      {} as ConfigService,
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-1',
              username: 'user',
              globalRole: 'USER',
              isActive: true,
              isBanned: false,
            }),
          },
          conversationParticipant: {
            findFirst: participantFindFirst,
            findMany: participantFindMany,
          },
        },
      } as unknown as PrismaService,
      {
        ensureConversationMembership,
      } as unknown as ChatService,
      {} as NotificationsService,
    );

    return {
      gateway,
      participantFindFirst,
      participantFindMany,
      ensureConversationMembership,
    };
  }

  it('only joins a conversation room for an active membership', async () => {
    const { gateway, participantFindFirst } = createGateway();
    const client = {
      data: {
        user: {
          sub: 'user-1',
          username: 'user',
          role: 'USER',
        },
      },
      join: jest.fn(),
    };

    await expect(
      gateway.joinConversation(client as never, {
        conversationId: 'conversation-1',
      }),
    ).rejects.toThrow(WsException);
    expect(participantFindFirst).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-1',
        userId: 'user-1',
        leftAt: null,
      },
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('evicts every user socket from the conversation room', () => {
    const { gateway } = createGateway();
    const emit = jest.fn();
    const socketsLeave = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const inRoom = jest.fn().mockReturnValue({ socketsLeave });

    gateway.server = {
      to,
      in: inRoom,
    } as never;

    gateway.revokeConversationAccess('user-1', 'conversation-1');

    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith('chat.conversation.accessRevoked', {
      conversationId: 'conversation-1',
    });
    expect(inRoom).toHaveBeenCalledWith('user:user-1');
    expect(socketsLeave).toHaveBeenCalledWith('conversation:conversation-1');
  });

  it('lists only connected active participants of the requested conversation', async () => {
    const { gateway, participantFindMany, ensureConversationMembership } =
      createGateway();
    const client = {
      data: {
        user: {
          sub: 'user-1',
          username: 'user',
          role: 'USER',
        },
      },
    };
    participantFindMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ]);
    const connectedUsers = Reflect.get(gateway, 'connectedUsers') as Map<
      string,
      Set<string>
    >;
    connectedUsers.set('user-1', new Set(['socket-1']));
    connectedUsers.set('user-3', new Set(['socket-3']));
    connectedUsers.set('unrelated-user', new Set(['socket-4']));

    await expect(
      gateway.listConversationPresence(client as never, {
        conversationId: 'conversation-1',
      }),
    ).resolves.toEqual({
      participantUserIds: ['user-1', 'user-2', 'user-3'],
      onlineUserIds: ['user-1', 'user-3'],
    });
    expect(ensureConversationMembership).toHaveBeenCalledWith(
      'user-1',
      'conversation-1',
    );
    expect(participantFindMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-1',
        leftAt: null,
      },
      select: { userId: true },
    });
  });
});
