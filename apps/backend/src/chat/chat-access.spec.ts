import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { AutoModerationService } from '../moderation/auto-moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

describe('ChatService active membership checks', () => {
  function createService(membership: unknown) {
    const findUnique = jest.fn().mockResolvedValue(membership);
    const service = new ChatService(
      {
        client: {
          conversationParticipant: { findUnique },
        },
      } as unknown as PrismaService,
      {} as AutoModerationService,
    );

    return { service, findUnique };
  }

  it('rejects a participant who left or was removed', async () => {
    const { service } = createService({
      conversationId: 'conversation-1',
      userId: 'user-1',
      joinedAt: new Date('2026-01-01'),
      leftAt: new Date('2026-01-02'),
    });

    await expect(
      service.ensureConversationMembership('user-1', 'conversation-1'),
    ).rejects.toThrow(
      new ForbiddenException(
        'you are not an active participant of this conversation',
      ),
    );
  });

  it('allows an active participant', async () => {
    const membership = {
      conversationId: 'conversation-1',
      userId: 'user-1',
      joinedAt: new Date('2026-01-01'),
      leftAt: null,
    };
    const { service } = createService(membership);

    await expect(
      service.ensureConversationMembership('user-1', 'conversation-1'),
    ).resolves.toBe(membership);
  });

  it('rejects an inactive participant trying to invite users', async () => {
    const { service } = createService({
      conversationId: 'conversation-1',
      userId: 'user-1',
      leftAt: new Date('2026-01-02'),
      conversation: { type: 'GROUP' },
    });

    await expect(
      service.ensureCanInviteToConversation('user-1', 'conversation-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
