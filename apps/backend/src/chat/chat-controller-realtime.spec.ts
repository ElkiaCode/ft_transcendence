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
    const addMessageReaction = jest.fn();
    const emitConversationCreated = jest.fn();
    const emitMessageReactionCreated = jest.fn();
    const createFromInput = jest.fn().mockResolvedValue({
      userId: 'sender-id',
    });
    const createFromInputForMany = jest.fn().mockResolvedValue([]);

    const controller = new ChatController(
      {
        createOrGetDirectConversation,
        createGroupConversation,
        addMessageReaction,
      } as unknown as ChatService,
      {
        emitConversationCreated,
        emitMessageReactionCreated,
        emitNotificationCreated: jest.fn(),
      } as unknown as ChatGateway,
      {
        createFromInput,
        createFromInputForMany,
      } as unknown as NotificationsService,
    );

    return {
      controller,
      createOrGetDirectConversation,
      createGroupConversation,
      addMessageReaction,
      emitConversationCreated,
      emitMessageReactionCreated,
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

  it('emits a realtime reaction event when a new reaction is created', async () => {
    const { controller, addMessageReaction, emitMessageReactionCreated } =
      createController();
    const createdAt = new Date('2026-06-28T10:00:00.000Z');
    addMessageReaction.mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      reaction: {
        id: 'reaction-1',
        userId: 'user-a',
        type: 'HEART',
        createdAt,
      },
      pointsAwarded: 5,
      sender: {
        id: 'sender-id',
        username: 'sender',
        penaltyPoints: 5,
        globalRole: 'USER',
      },
      senderPromoted: false,
    });

    await controller.addMessageReaction(actor, 'conversation-1', 'message-1', {
      type: 'HEART',
    });

    expect(emitMessageReactionCreated).toHaveBeenCalledWith('conversation-1', {
      conversationId: 'conversation-1',
      messageId: 'message-1',
      reaction: {
        id: 'reaction-1',
        userId: 'user-a',
        type: 'HEART',
        createdAt,
      },
    });
  });
});
