import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

type NotificationCreateArgs = {
  data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  };
};

describe('NotificationsService', () => {
  const notificationCreate = jest.fn<
    Promise<unknown>,
    [NotificationCreateArgs]
  >();
  const prisma = {
    notification: {
      create: notificationCreate,
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma);
  });

  it('Scenario 1: creates a notification with structured action context', async () => {
    const createdNotification = {
      id: 'notification-1',
      userId: 'user-1',
      title: 'Friend request received',
    };

    notificationCreate.mockResolvedValue(createdNotification);

    await expect(
      service.createForUser(
        'user-1',
        'SYSTEM',
        'Friend request received',
        'alice sent you a friend request.',
        {
          actorId: 'actor-1',
          entityType: 'friendship',
          entityId: 'friendship-1',
          action: 'friend_request_created',
          metadata: {
            requesterUsername: 'alice',
          },
        },
      ),
    ).resolves.toBe(createdNotification);

    expect(notificationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'SYSTEM',
        title: 'Friend request received',
        body: 'alice sent you a friend request.',
        actorId: 'actor-1',
        entityType: 'friendship',
        entityId: 'friendship-1',
        action: 'friend_request_created',
        metadata: {
          requesterUsername: 'alice',
        },
      },
    });
  });

  it('Scenario 2: creates one structured notification for each recipient', async () => {
    notificationCreate
      .mockResolvedValueOnce({ id: 'notification-1', userId: 'user-1' })
      .mockResolvedValueOnce({ id: 'notification-2', userId: 'user-2' });

    const result = await service.createFromInputForMany(['user-1', 'user-2'], {
      type: 'MESSAGE',
      title: 'New message',
      body: 'hello',
      actorId: 'sender-1',
      entityType: 'message',
      entityId: 'message-1',
      action: 'message_created',
      metadata: {
        conversationId: 'conversation-1',
      },
    });

    expect(result).toEqual([
      { id: 'notification-1', userId: 'user-1' },
      { id: 'notification-2', userId: 'user-2' },
    ]);
    const secondCall = notificationCreate.mock.calls[1]?.[0];

    expect(notificationCreate).toHaveBeenCalledTimes(2);
    expect(secondCall).toMatchObject({
      data: {
        userId: 'user-2',
        action: 'message_created',
        entityId: 'message-1',
      },
    });
  });
});
