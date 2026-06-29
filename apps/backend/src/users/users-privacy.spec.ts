import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { ChatGateway } from '../chat/chat.gateway';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { hashDataErasureToken } from './utils/data-erasure-token.util';

describe('UsersService privacy behavior', () => {
  function createService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const findUnique = jest.fn();
    const deleteUser = jest.fn().mockResolvedValue({});
    const dataErasureRequest = {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const client = {
      user: {
        findMany,
        findUnique,
        delete: deleteUser,
      },
      notification: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      report: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      moderationAction: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      conversationParticipant: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      dataErasureRequest,
      $transaction: jest.fn(
        (callback: (transactionClient: unknown) => unknown) =>
          Promise.resolve(callback(client)),
      ),
    };
    const mailService = {
      sendDataErasureConfirmation: jest.fn().mockResolvedValue(undefined),
      sendDataErasureCompleted: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      createFromInputForMany: jest.fn().mockResolvedValue([]),
    };
    const chatGateway = {
      revokeConversationAccess: jest.fn(),
    };
    const service = new UsersService(
      {
        client,
      } as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
      chatGateway as unknown as ChatGateway,
      mailService as unknown as MailService,
    );

    return {
      service,
      findMany,
      findUnique,
      deleteUser,
      dataErasureRequest,
      mailService,
      chatGateway,
      client,
    };
  }

  it('keeps blocked and banned users searchable with public safety flags', async () => {
    const { service, findMany } = createService();
    findMany.mockResolvedValue([
      {
        id: 'user-b',
        username: 'blocked-user',
        isBanned: false,
        profile: null,
        blocksReceived: [{ id: 'block-a-to-b' }],
        blocksInitiated: [],
      },
      {
        id: 'user-c',
        username: 'blocker-user',
        isBanned: false,
        profile: null,
        blocksReceived: [],
        blocksInitiated: [{ id: 'block-c-to-a' }],
      },
      {
        id: 'user-d',
        username: 'banned-user',
        isBanned: true,
        profile: null,
        blocksReceived: [],
        blocksInitiated: [],
      },
    ]);

    const result = await service.searchUsers('user-a', 'user');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'user-b',
        isBlockedByCurrentUser: true,
        hasBlockedCurrentUser: false,
      }),
      expect.objectContaining({
        id: 'user-c',
        isBlockedByCurrentUser: false,
        hasBlockedCurrentUser: true,
      }),
      expect.objectContaining({
        id: 'user-d',
        isBanned: true,
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ NOT: expect.anything() }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([{ isBanned: true }]),
            }),
          ]),
        }),
      }),
    );
  });

  it('stores only a token hash and sends the raw token by email', async () => {
    const { service, findUnique, deleteUser, dataErasureRequest, mailService } =
      createService();

    findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: null,
    });

    await expect(
      service.requestDataErasure('user-id', {}),
    ).resolves.toMatchObject({
      success: true,
      message: 'A confirmation email has been sent.',
    });

    const rawToken = mailService.sendDataErasureConfirmation.mock.calls[0][1];
    const storedTokenHash =
      dataErasureRequest.upsert.mock.calls[0][0].create.tokenHash;

    expect(rawToken).toEqual(expect.any(String));
    expect(storedTokenHash).toBe(hashDataErasureToken(rawToken));
    expect(storedTokenHash).not.toBe(rawToken);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('requires the current password for a local account', async () => {
    const { service, findUnique, dataErasureRequest, mailService } =
      createService();

    findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: 'stored-password-hash',
    });

    await expect(service.requestDataErasure('user-id', {})).rejects.toThrow(
      'current password is required',
    );
    expect(dataErasureRequest.upsert).not.toHaveBeenCalled();
    expect(mailService.sendDataErasureConfirmation).not.toHaveBeenCalled();
  });

  it('removes the pending request when the confirmation email cannot be sent', async () => {
    const { service, findUnique, dataErasureRequest, mailService } =
      createService();
    const deliveryError = new Error('SMTP unavailable');

    findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: null,
    });
    mailService.sendDataErasureConfirmation.mockRejectedValue(deliveryError);

    await expect(service.requestDataErasure('user-id', {})).rejects.toBe(
      deliveryError,
    );
    expect(dataErasureRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        tokenHash: expect.any(String),
      },
    });
  });

  it('anonymizes deletion notifications and deletes the local avatar after email confirmation', async () => {
    const { service, deleteUser, dataErasureRequest, mailService, client } =
      createService();
    const filename = `gdpr-avatar-${Date.now()}.png`;
    const avatarPath = join(process.cwd(), 'uploads', filename);
    const localApiUrl = (
      process.env.API_URL || 'https://localhost:8443'
    ).replace(/\/$/, '');
    const notifySpy = jest
      .spyOn(service as never, 'notifyAdminsAndModerators' as never)
      .mockResolvedValue([] as never);
    const rawToken = 'a'.repeat(64);

    await writeFile(avatarPath, 'avatar');
    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'deleted-user-id',
      tokenHash: hashDataErasureToken(rawToken),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: {
        id: 'deleted-user-id',
        username: 'personal-username',
        email: 'personal@example.com',
        passwordHash: null,
        profile: {
          avatarUrl: `${localApiUrl}/uploads/${filename}`,
        },
      },
    });

    await service.confirmDataErasure('deleted-user-id', rawToken);

    const notificationInput = notifySpy.mock.calls[0][0];
    const serializedNotification = JSON.stringify(notificationInput);

    expect(serializedNotification).not.toContain('personal@example.com');
    expect(serializedNotification).not.toContain('personal-username');
    expect(serializedNotification).not.toContain('deleted-user-id');
    await expect(access(avatarPath)).rejects.toThrow();
    expect(deleteUser).toHaveBeenCalledWith({
      where: { id: 'deleted-user-id' },
    });
    expect(mailService.sendDataErasureCompleted).toHaveBeenCalledWith(
      'personal@example.com',
    );
    expect(client.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ actorId: 'deleted-user-id' }, { entityId: 'deleted-user-id' }],
      },
    });
    expect(client.report.deleteMany).toHaveBeenCalledWith({
      where: { creatorId: 'deleted-user-id' },
    });
    expect(client.moderationAction.deleteMany).toHaveBeenCalledWith({
      where: { targetUserId: 'deleted-user-id' },
    });
    expect(client.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        participants: {
          some: { userId: 'deleted-user-id' },
        },
      },
      data: {
        participantHash: null,
      },
    });
  });

  it('closes orphaned chat conversations and transfers group ownership during data erasure', async () => {
    const { service, dataErasureRequest, client, chatGateway } =
      createService();
    const rawToken = 'h'.repeat(64);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'deleted-user-id',
      tokenHash: hashDataErasureToken(rawToken),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: {
        id: 'deleted-user-id',
        username: 'personal-username',
        email: 'personal@example.com',
        passwordHash: null,
        profile: null,
      },
    });
    client.conversation.findMany.mockResolvedValue([
      {
        id: 'direct-conversation-id',
        type: 'DIRECT',
        participants: [
          {
            userId: 'deleted-user-id',
            role: 'OWNER',
            joinedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            userId: 'remaining-user-id',
            role: 'OWNER',
            joinedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
      {
        id: 'group-conversation-id',
        type: 'GROUP',
        participants: [
          {
            userId: 'deleted-user-id',
            role: 'OWNER',
            joinedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            userId: 'member-one-id',
            role: 'MEMBER',
            joinedAt: new Date('2026-01-02T00:00:00.000Z'),
          },
          {
            userId: 'member-two-id',
            role: 'MEMBER',
            joinedAt: new Date('2026-01-03T00:00:00.000Z'),
          },
        ],
      },
    ]);

    await service.confirmDataErasure('deleted-user-id', rawToken);

    expect(client.conversationParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: { in: ['direct-conversation-id'] },
        userId: { not: 'deleted-user-id' },
        leftAt: null,
      },
      data: {
        leftAt: expect.any(Date),
      },
    });
    expect(client.conversationParticipant.update).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 'group-conversation-id',
          userId: 'member-one-id',
        },
      },
      data: {
        role: 'OWNER',
      },
    });
    expect(chatGateway.revokeConversationAccess).toHaveBeenCalledWith(
      'remaining-user-id',
      'direct-conversation-id',
    );
  });

  it('rejects a valid token used by another authenticated user', async () => {
    const { service, deleteUser, dataErasureRequest } = createService();
    const rawToken = 'd'.repeat(64);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'token-owner-id',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'token-owner-id',
        email: 'owner@example.com',
        passwordHash: null,
        profile: null,
      },
    });

    await expect(
      service.confirmDataErasure('another-user-id', rawToken),
    ).rejects.toThrow(
      'deletion confirmation does not belong to authenticated user',
    );
    expect(dataErasureRequest.deleteMany).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('requires the current password again to confirm a local account deletion', async () => {
    const { service, deleteUser, dataErasureRequest } = createService();
    const rawToken = 'e'.repeat(64);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'local-user-id',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'local-user-id',
        email: 'local@example.com',
        passwordHash: 'stored-password-hash',
        profile: null,
      },
    });

    await expect(
      service.confirmDataErasure('local-user-id', rawToken),
    ).rejects.toThrow('current password is required');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password during final confirmation', async () => {
    const { service, deleteUser, dataErasureRequest } = createService();
    const rawToken = 'f'.repeat(64);
    const passwordHash = await bcrypt.hash('CorrectPass123!', 4);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'local-user-id',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'local-user-id',
        email: 'local@example.com',
        passwordHash,
        profile: null,
      },
    });

    await expect(
      service.confirmDataErasure('local-user-id', rawToken, 'WrongPass123!'),
    ).rejects.toThrow('invalid credentials');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('allows the token owner to confirm a local account with the correct password', async () => {
    const { service, deleteUser, dataErasureRequest } = createService();
    const rawToken = 'g'.repeat(64);
    const password = 'CorrectPass123!';
    const passwordHash = await bcrypt.hash(password, 4);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'local-user-id',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'local-user-id',
        email: 'local@example.com',
        passwordHash,
        profile: null,
      },
    });

    await expect(
      service.confirmDataErasure('local-user-id', rawToken, password),
    ).resolves.toMatchObject({ success: true });
    expect(deleteUser).toHaveBeenCalledWith({
      where: { id: 'local-user-id' },
    });
  });

  it('rejects and removes an expired deletion confirmation', async () => {
    const { service, deleteUser, dataErasureRequest } = createService();
    const rawToken = 'b'.repeat(64);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'expired-request',
      expiresAt: new Date(Date.now() - 1),
      user: {
        id: 'user-id',
        email: 'user@example.com',
        profile: null,
      },
    });

    await expect(
      service.confirmDataErasure('user-id', rawToken),
    ).rejects.toThrow('invalid or expired deletion confirmation');
    expect(dataErasureRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 'expired-request' },
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('rejects a confirmation token that was already consumed', async () => {
    const { service, deleteUser, dataErasureRequest } = createService();
    const rawToken = 'c'.repeat(64);

    dataErasureRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: null,
        profile: null,
      },
    });
    dataErasureRequest.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.confirmDataErasure('user-id', rawToken),
    ).rejects.toThrow('invalid or expired deletion confirmation');
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
