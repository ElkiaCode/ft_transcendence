import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { User, GlobalRole } from '@prisma/client';
import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { ModerationService } from './moderation.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';

describe('ModerationService', () => {
  let service: ModerationService;
  let notificationsMock: DeepMockProxy<NotificationsService>;
  let prismaMock: DeepMockProxy<PrismaService>;
  let chatGateway: ChatGateway;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = mockDeep<PrismaService>();
    notificationsMock = mockDeep<NotificationsService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
        {
          provide: ChatGateway,
          useValue: {
            emitNotificationCreated: jest.fn(),
            emitModerationBanAndDisconnect: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get<ModerationService>(ModerationService);
    chatGateway = module.get<ChatGateway>(ChatGateway);
    jest.spyOn(service as any, 'notifyModerators');
  });

  const createMockUser = (overrides: Partial<User> = {}): User => {
    const defaultUser: User = {
      id: 'user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: null,
      globalRole: GlobalRole.USER,
      isActive: true,
      isBanned: false,
      penaltyPoints: 0,
      preferredLanguage: 'en',
      ...overrides,
    };
    return { ...defaultUser, ...overrides };
  };

  describe('createReport', () => {
    const creatorId = 'user-reporter';

    describe('targetType: USER', () => {
      it('Scenario 1 - should throw BadRequest if targetUserId is missing', async () => {
        await expect(
          service.createReport(
            creatorId,
            'USER',
            undefined, //targetUserId
            undefined, //targetMessageId
            'reason',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('Scenario 2 -should throw BadRequest if reporting self', async () => {
        await expect(
          service.createReport(
            creatorId,
            'USER',
            creatorId, //targetUserId
            undefined, //targetMessageId
            'reason',
          ),
        ).rejects.toThrow('cannot report yourself');
      });

      it('Scenario 3 - should throw NotFound if target user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        await expect(
          service.createReport(
            creatorId,
            'USER',
            'target-id', //targetUserId
            undefined, //targetMessageId
            'reason',
          ),
        ).rejects.toThrow(NotFoundException);
      });

      it('Scenario 4 - should successfully create a report', async () => {
        const mockUser: User = createMockUser({ id: 'target-id' });
        prismaMock.user.findUnique.mockResolvedValue(mockUser);
        // For findMany (Moderators notification logic)
        prismaMock.user.findMany.mockResolvedValue([
          createMockUser({ id: 'mod-1', globalRole: GlobalRole.MODERATOR }),
          createMockUser({ id: 'admin-1', globalRole: GlobalRole.ADMIN }),
        ]);
        prismaMock.report.create.mockResolvedValue({
          id: 'report-1',
          reason: '',
          targetType: 'USER',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date(),
          creatorId: 'target-id',
          targetUserId: null,
          targetMessageId: null,
        });

        notificationsMock.createFromInputForMany.mockResolvedValue([
          { id: 'notif-1', userId: 'mod-1' },
          { id: 'notif-2', userId: 'admin-1' },
        ] as any);

        prismaMock.$transaction.mockImplementation(async (callback) => {
          // This handles the transaction mock cleanly
          if (typeof callback === 'function') {
            return callback(prismaMock);
          }
          return callback;
        });

        const result = await service.createReport(
          creatorId,
          'USER',
          'target-id', //targetUserId
          undefined, //targetMessageId
          ' Toxic ',
        );

        expect(result.id).toBe('report-1');
        expect(prismaMock.report.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ reason: 'Toxic' }),
        });
        expect(service['notifyModerators']).toHaveBeenCalled();
        expect(notificationsMock.createFromInputForMany).toHaveBeenCalled();
        expect(chatGateway['emitNotificationCreated']).toHaveBeenCalledTimes(2); // One for each moderator
      });
    });

    describe('targetType: MESSAGE', () => {
      it('Scenario 5 - should throw BadRequest if targetMessageId is missing', async () => {
        await expect(
          service.createReport(
            'creatorId',
            'MESSAGE',
            undefined, //targetUserId
            undefined, //targetMessageId
            'reason',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('Scenario 6 - should throw NotFound if target message does not exist', async () => {
        prismaMock.message.findUnique.mockResolvedValue(null);
        await expect(
          service.createReport(
            'creatorId',
            'MESSAGE',
            'target-id',
            'message',
            'reason',
          ),
        ).rejects.toThrow(NotFoundException);
      });
      it('Scenario 7 - should successfully create a message report and notify moderators', async () => {
        const targetMessageId = 'msg-123';
        prismaMock.message.findUnique.mockResolvedValue({
          id: targetMessageId,
          createdAt: new Date(),
          updatedAt: new Date(),
          conversationId: '',
          senderId: '',
          content: null,
          type: 'TEXT',
          isEdited: false,
          deletedAt: null,
        });
        prismaMock.report.create.mockResolvedValue({
          id: 'report-2',
          targetType: 'USER',
          reason: '',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date(),
          creatorId: null,
          targetUserId: null,
          targetMessageId: null,
        });
        prismaMock.user.findMany.mockResolvedValue([
          {
            id: 'admin-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            email: '',
            username: '',
            passwordHash: null,
            globalRole: 'USER',
            isActive: false,
            isBanned: false,
            penaltyPoints: 0,
            preferredLanguage: '',
          },
        ]);

        notificationsMock.createFromInputForMany.mockResolvedValue([
          {
            id: 'notif-1',
            userId: 'admin-1',
            createdAt: new Date(),
            type: 'MESSAGE',
            title: '',
            body: null,
            actorId: null,
            entityType: null,
            entityId: null,
            action: null,
            metadata: null,
            isRead: false,
          },
        ]);

        const result = await service.createReport(
          'creatorId',
          'MESSAGE',
          undefined,
          targetMessageId,
          'Inappropriate',
        );

        expect(prismaMock.message.findUnique).toHaveBeenCalledWith({
          where: { id: targetMessageId },
        });
        expect(result.id).toBe('report-2');
        expect(service['notifyModerators']).toHaveBeenCalled();
      });
    });

    it('Scenario 8 - should throw BadRequest for invalid targetType', async () => {
      await expect(
        service.createReport(
          'creatorId',
          'INVALID' as any,
          undefined,
          undefined,
          'reason',
        ),
      ).rejects.toThrow('invalid targetType');
    });
  });

  describe('listReports', () => {
    const creatorId = 'user-reporter';
    const targetUserId = 'target-id';
    const mockReports: any[] = [
      {
        id: 'report-1',
        creatorId: creatorId,
        targetType: 'USER',
        targetUserId: targetUserId,
        reason: 'Toxic behavior',
        createdAt: new Date(),
        // Mock the includes if your service logic uses them
        creator: { username: 'reporter' },
        targetUser: { username: 'bad_user' },
        actions: [],
      },
    ];

    it('Scenario 1: succesfully list report', async () => {
      prismaMock.report.findMany.mockResolvedValue(mockReports);

      const result = await service.listReports();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].creatorId).toBe(creatorId);
      expect(prismaMock.report.findMany).toHaveBeenCalledWith({
        include: expect.objectContaining({
          creator: {
            include: { profile: true },
          },
          targetUser: {
            include: { profile: true },
          },
          targetMessage: {
            include: {
              sender: {
                include: { profile: true },
              },
            },
          },
          actions: true, // This one is just 'true' in your code, so it stays 'true' here
        }),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('reviewReport', () => {
    const moderatorId = 'mod-1';
    const reportId = 'rep-123';
    const targetUserId = 'target-user-456';

    beforeEach(() => {
      // Mock private notifyUser to avoid deep dependency testing
      jest.spyOn(service as any, 'notifyUser').mockResolvedValue({});
    });

    it('Scenario 1: should throw NotFoundException if report does not exist', async () => {
      prismaMock.report.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewReport(moderatorId, reportId, 'DISMISS_REPORT'),
      ).rejects.toThrow(new NotFoundException('report not found'));
    });

    it('Scenario 2: should DISMISS a report (No penalty, no ban)', async () => {
      // 1. Mock finding the report
      prismaMock.report.findUnique.mockResolvedValue({
        id: reportId,
        targetUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        targetType: 'USER',
        reason: '',
        status: 'OPEN',
        creatorId: null,
        targetMessageId: null,
      });

      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'DISMISS_REPORT',
        moderatorId,
        targetUserId,
      } as any);

      prismaMock.report.update.mockResolvedValue({
        id: reportId,
        status: 'DISMISSED',
        moderationAction: {
          id: 'act-456',
          action: 'DISMISS_REPORT',
        },
      } as any);

      // Ensure the transaction returns the report (which now has the moderationAction)
      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
      // The transaction callback will use these mocks
      // Note: ensure your smart $transaction mock is in place in beforeEach
      const result = await service.reviewReport(
        moderatorId,
        reportId,
        'DISMISS_REPORT', // Action
        'No violation found', // Reason
      );

      expect(result.updatedReport.status).toBe('DISMISSED');
      expect(result.moderationAction.id).toBe('act-456');
      // Use the transaction mock to verify NO user update happened
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('Scenario 3: should WARN and subtract penalty points', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: reportId,
        targetUserId,
        creatorId: null,
        targetType: 'USER',
        targetMessageId: null,
        reason: '',
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'WARN',
        moderatorId,
        targetUserId,
        penaltyPointsChange: -50,
      } as any);

      prismaMock.report.update.mockResolvedValue({
        id: reportId,
        status: 'RESOLVED',
        moderationAction: {
          id: 'act-456',
          action: 'WARN',
          penaltyPointsChange: -50,
        },
      } as any);

      // Ensure the transaction returns the report (which now has the moderationAction)
      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
      // Act
      const result = await service.reviewReport(
        moderatorId,
        reportId,
        'WARN',
        'Bad behavior',
        50,
      );

      // Assert: Check if penaltyPointsChange was calculated correctly (-50)
      // We check the transaction call for ModerationAction creation
      expect(result.moderationAction.penaltyPointsChange).toBe(-50);
      expect(prismaMock.moderationAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          penaltyPointsChange: -50,
        }),
      });
    });

    it('Scenario 4: should BAN user, revoke tokens, and disconnect via WebSocket', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: reportId,
        targetUserId,
        createdAt: new Date(),
        creatorId: null,
        targetType: 'USER',
        targetMessageId: null,
        reason: '',
        status: 'OPEN',
        updatedAt: new Date(),
      });

      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'BAN',
        moderatorId,
        targetUserId,
        penaltyPointsChange: -500,
      } as any);

      prismaMock.report.update.mockResolvedValue({
        id: reportId,
        status: 'RESOLVED',
        moderationAction: {
          id: 'act-456',
          action: 'BAN',
          penaltyPointsChange: -500,
        },
      } as any);

      // Ensure the transaction returns the report (which now has the moderationAction)
      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));

      const result = await service.reviewReport(
        moderatorId,
        reportId,
        'BAN',
        'Toxic',
        500,
      );
      expect(result.moderationAction.penaltyPointsChange).toBe(-500);
      // Verify side effects
      expect(
        chatGateway['emitModerationBanAndDisconnect'],
      ).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          message: 'Your account was banned by moderation.',
        }),
      );
    });

    it('Scenario 5: should UNBAN a user successfully', async () => {
      prismaMock.report.findUnique.mockResolvedValue({
        id: reportId,
        targetUserId,
        createdAt: new Date(),
        creatorId: null,
        targetType: 'USER',
        targetMessageId: null,
        reason: '',
        status: 'OPEN',
        updatedAt: new Date(),
      });

      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'UNBAN',
        moderatorId,
        targetUserId,
      } as any);

      prismaMock.report.update.mockResolvedValue({
        id: reportId,
        status: 'RESOLVED',
        moderationAction: {
          id: 'act-456',
          action: 'UNBAN',
        },
      } as any);

      // Ensure the transaction returns the report (which now has the moderationAction)
      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));

      const userUpdateCall = await service.reviewReport(
        moderatorId,
        reportId,
        'UNBAN',
      );

      // Verify the DB call to unban
      expect(userUpdateCall.updatedReport.status).toBe('RESOLVED');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetUserId },
          data: { isBanned: false, isActive: true },
        }),
      );
    });
  });

  describe('adjustPenaltyPoints', () => {
    const modId = 'admin-1';
    const targetId = 'user-1';

    beforeEach(() => {
      jest.spyOn(service as any, 'notifyUser').mockResolvedValue({});
    });

    it('Scenario 1: should throw BadRequest if moderator tries to adjust his own points', async () => {
      await expect(
        service.adjustPenaltyPoints(modId, modId, 10),
      ).rejects.toThrow('you cannot adjust your own penalty points');
    });

    it('Scenario 2: should throw NotFoundException if user does not exist', async () => {
      await expect(service.adjustPenaltyPoints(modId, '', 10)).rejects.toThrow(
        'target user not found',
      );
    });

    it('Scenario 3: Normal Adjustment (No Ban/Promotion)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        createMockUser({
          id: targetId,
          penaltyPoints: 0,
        }),
      );

      // We mock the first update to return 100 points
      prismaMock.user.update.mockResolvedValue(
        createMockUser({
          id: targetId,
          username: 'marvin',
          penaltyPoints: 100,
          globalRole: 'USER',
          isActive: true,
          isBanned: false,
        }),
      );

      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'UNBAN',
        moderatorId: modId,
        targetUserId: targetId,
      } as any);

      prismaMock.$transaction.mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(prismaMock);
        return cb;
      });

      const result = await service.adjustPenaltyPoints(
        modId,
        targetId,
        100,
        'Good job',
      );

      expect(result.user.penaltyPoints).toBe(100);
      expect(result.moderationAction.id).toBe('act-456');
      expect(result.promoted).toBe(false);
      expect(
        chatGateway['emitModerationBanAndDisconnect'],
      ).not.toHaveBeenCalled();
    });

    it('Scenario 4: should trigger Auto-Ban if points reach -500', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: targetId,
        penaltyPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: '',
        username: '',
        passwordHash: null,
        globalRole: 'USER',
        isActive: false,
        isBanned: false,
        preferredLanguage: '',
      });
      // Mock first update to return -500
      prismaMock.user.update.mockResolvedValue(
        createMockUser({
          id: targetId,
          username: 'bad_user',
          penaltyPoints: -500,
          isBanned: false,
        }),
      );
      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'BAN',
        moderatorId: modId,
        targetUserId: targetId,
      } as any);

      prismaMock.$transaction.mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(prismaMock);
        return cb;
      });

      const result = await service.adjustPenaltyPoints(modId, targetId, -500);

      expect(result.user.isBanned).toBe(true);
      expect(
        chatGateway['emitModerationBanAndDisconnect'],
      ).toHaveBeenCalledWith(
        targetId,
        expect.objectContaining({ penaltyPoints: -500 }),
      );
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('Scenario 5: should trigger Auto-Promotion if points reach +500', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        createMockUser({
          id: targetId,
          penaltyPoints: 490,
        }),
      );

      prismaMock.user.update.mockResolvedValueOnce(
        createMockUser({
          id: targetId,
          username: 'helpful_user',
          penaltyPoints: 500,
          globalRole: 'USER',
          isActive: true,
          isBanned: false,
        }),
      );

      // 2. Mock second update (role change to MODERATOR)
      prismaMock.user.update.mockResolvedValueOnce(
        createMockUser({
          id: targetId,
          globalRole: 'MODERATOR',
          penaltyPoints: 500,
        }),
      );

      prismaMock.moderationAction.create.mockResolvedValue({
        id: 'act-456',
        action: 'ADJUST_POINTS',
        moderatorId: modId,
        targetUserId: targetId,
      } as any);

      prismaMock.$transaction.mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(prismaMock);
        return cb;
      });

      const result = await service.adjustPenaltyPoints(modId, targetId, 10);

      expect(result.promoted).toBe(true);
      expect(result.user.globalRole).toBe('MODERATOR');
      expect(service['notifyUser']).toHaveBeenCalledTimes(2);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
