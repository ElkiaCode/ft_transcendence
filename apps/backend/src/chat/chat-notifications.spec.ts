import { describe, expect, it, jest } from '@jest/globals';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatController message notifications', () => {
  const actor: JwtPayload = {
    sub: 'user-1',
    email: 'alice@example.com',
    username: 'alice',
    role: 'USER',
  };

  function createController() {
    const editMessage = jest.fn().mockResolvedValue({ id: 'message-1' });
    const deleteMessage = jest.fn().mockResolvedValue({ id: 'message-1' });
    const getOtherParticipantIds = jest.fn().mockResolvedValue(['user-2']);
    const createFromInputForMany = jest.fn().mockResolvedValue([
      {
        id: 'notification-1',
        userId: 'user-2',
      },
    ]);

    const controller = new ChatController(
      {
        editMessage,
        deleteMessage,
        getOtherParticipantIds,
      } as unknown as ChatService,
      {
        emitMessageUpdated: jest.fn(),
        emitMessageDeleted: jest.fn(),
        emitNotificationCreated: jest.fn(),
      } as unknown as ChatGateway,
      {
        createFromInputForMany,
      } as unknown as NotificationsService,
    );

    return {
      controller,
      createFromInputForMany,
    };
  }

  it('links edited-message notifications to the conversation', async () => {
    const { controller, createFromInputForMany } = createController();

    await controller.editMessage(actor, 'conversation-1', 'message-1', {
      content: 'updated',
    });

    expect(createFromInputForMany).toHaveBeenCalledWith(
      ['user-2'],
      expect.objectContaining({
        entityType: 'CONVERSATION',
        entityId: 'conversation-1',
        action: 'message_updated',
        metadata: expect.objectContaining({
          messageId: 'message-1',
        }),
      }),
    );
  });

  it('links deleted-message notifications to the conversation', async () => {
    const { controller, createFromInputForMany } = createController();

    await controller.deleteMessage(actor, 'conversation-1', 'message-1');

    expect(createFromInputForMany).toHaveBeenCalledWith(
      ['user-2'],
      expect.objectContaining({
        entityType: 'CONVERSATION',
        entityId: 'conversation-1',
        action: 'message_deleted',
        metadata: expect.objectContaining({
          messageId: 'message-1',
        }),
      }),
    );
  });
});
