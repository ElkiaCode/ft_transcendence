import { describe, expect, it, jest } from '@jest/globals';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatController realtime conversation creation', () => {
  function createController() {
    const createOrGetDirectConversation = jest.fn();
    const createGroupConversation = jest.fn();
    const emitConversationCreated = jest.fn();
    const createFromInputForMany = jest.fn().mockResolvedValue([]);

    const controller = new ChatController(
      {
        createOrGetDirectConversation,
        createGroupConversation,
      } as unknown as ChatService,
      {
        emitConversationCreated,
        emitNotificationCreated: jest.fn(),
      } as unknown as ChatGateway,
      {
        createFromInputForMany,
      } as unknown as NotificationsService,
    );

    return {
      controller,
      createOrGetDirectConversation,
      createGroupConversation,
      emitConversationCreated,
    };
  }

  const actor: JwtPayload = {
    sub: 'user-a',
    email: 'a@example.com',
    username: 'alice',
    role: 'USER',
  };

  it('emits a personalized DM preview to both participants', async () => {
    const {
      controller,
      createOrGetDirectConversation,
      emitConversationCreated,
    } = createController();
    const conversation = {
      id: 'dm-1',
      type: 'DIRECT',
      title: null,
      participants: [
        {
          userId: 'user-a',
          leftAt: null,
          user: {
            username: 'alice',
            profile: { avatarUrl: '/uploads/alice.png' },
          },
        },
        {
          userId: 'user-b',
          leftAt: null,
          user: {
            username: 'bob',
            profile: { avatarUrl: '/uploads/bob.png' },
          },
        },
      ],
    };
    createOrGetDirectConversation.mockResolvedValue(conversation);

    await controller.createOrGetDirectConversation(actor, 'user-b');

    expect(emitConversationCreated).toHaveBeenCalledWith(
      'user-a',
      expect.objectContaining({
        id: 'dm-1',
        type: 'dm',
        name: 'bob',
        avatarUrl: '/uploads/bob.png',
      }),
    );
    expect(emitConversationCreated).toHaveBeenCalledWith(
      'user-b',
      expect.objectContaining({
        id: 'dm-1',
        type: 'dm',
        name: 'alice',
        avatarUrl: '/uploads/alice.png',
      }),
    );
  });

  it('emits a new group preview to every participant', async () => {
    const { controller, createGroupConversation, emitConversationCreated } =
      createController();
    const conversation = {
      id: 'group-1',
      type: 'GROUP',
      title: 'Project group',
      participants: ['user-a', 'user-b', 'user-c'].map((userId) => ({
        userId,
        leftAt: null,
        user: {
          username: userId,
          profile: null,
        },
      })),
    };
    createGroupConversation.mockResolvedValue({
      message: 'group conversation created',
      conversation,
    });

    await controller.createGroupConversation(actor, {
      title: 'Project group',
      userIds: ['user-b', 'user-c'],
    });

    expect(emitConversationCreated).toHaveBeenCalledTimes(3);
    for (const userId of ['user-a', 'user-b', 'user-c']) {
      expect(emitConversationCreated).toHaveBeenCalledWith(userId, {
        id: 'group-1',
        type: 'group',
        name: 'Project group',
        avatarUrl: null,
        lastMessage: null,
        unreadCount: 0,
      });
    }
  });
});
