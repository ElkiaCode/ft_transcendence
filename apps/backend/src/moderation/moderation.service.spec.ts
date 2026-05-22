import { Test, TestingModule } from '@nestjs/testing';
import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { ModerationService } from './moderation.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../chat/chat.gateway';

describe('ModerationService', () => {
  let service: ModerationService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;
  let chatGateway: ChatGateway;
  let mockTransactionClient: any;

  beforeEach(async () => {
    mockTransactionClient = {
      moderationAction: {
        // create: jest.fn().mockResolvedValue({ id: 'act-1' }),
        // We use mockImplementation to "echo" the data back
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'act-1', ...data }),
          ),
      },
      report: {
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'rep-1', status: data.status }),
          ),
      },
      user: {
        //update: jest.fn().mockResolvedValue({}) },
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'user-1', ...data }),
          ),
      },
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((input) => {
              // If the service passes a function (callback style)
              if (typeof input === 'function') {
                return input(mockTransactionClient);
              }
              // If the service passes an array (standard style)
              return Promise.all(input);
            }),
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              // findFirst: jest.fn(),
              // create: jest.fn(),
            },
            message: { findUnique: jest.fn() },
            report: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createFromInputForMany: jest.fn().mockResolvedValue([
              { id: 'notif-1', userId: 'mod-1' },
              { id: 'notif-2', userId: 'mod-1' },
            ]),
            createFromInput: jest.fn().mockResolvedValue({ id: 'notif-1' }),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            emitNotificationCreated: jest.fn().mockResolvedValue(undefined),
            emitModerationBanAndDisconnect: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get<ModerationService>(ModerationService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    chatGateway = module.get<ChatGateway>(ChatGateway);
    // Mock global fetch for 42 OAuth
    // global.fetch = jest.fn();

    // Mock the private notification helper
    // jest.spyOn(service as any, 'notifyModerators').mockResolvedValue(undefined);
    // KEY FIX: This creates a Spy that WATCHES but does NOT block the real code
    jest.spyOn(service as any, 'notifyModerators');
  });
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
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
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

      it('Scenario 4 - should successfully create a user report and notify moderators', async () => {
        const targetUserId = 'target-id';
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
          id: targetUserId,
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
        });
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
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
          {
            id: 'mod-1',
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
        jest.spyOn(prisma.report, 'create').mockResolvedValue({
          id: 'report-1',
          reason: '',
          targetType: 'USER',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date(),
          creatorId: null,
          targetUserId: null,
          targetMessageId: null,
        });

        const result = await service.createReport(
          creatorId,
          'USER',
          targetUserId, //targetUserId
          undefined, //targetMessageId
          '  Toxic behavior  ',
        );

        expect(result.id).toBe('report-1');
        // Verify trimming logic
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(prisma.report.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ reason: 'Toxic behavior' }),
        });
        expect(service['notifyModerators']).toHaveBeenCalled();
        expect(
          notificationsService['createFromInputForMany'],
        ).toHaveBeenCalled();
        expect(chatGateway['emitNotificationCreated']).toHaveBeenCalledTimes(2); // One for each moderator
      });
    });

    describe('targetType: MESSAGE', () => {
      it('Scenario 5 - should throw BadRequest if targetMessageId is missing', async () => {
        await expect(
          service.createReport(
            creatorId,
            'MESSAGE',
            undefined, //targetUserId
            undefined, //targetMessageId
            'reason',
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('Scenario 6 - should throw NotFound if target message does not exist', async () => {
        jest.spyOn(prisma.message, 'findUnique').mockResolvedValue(null);
        await expect(
          service.createReport(
            creatorId,
            'MESSAGE',
            'target-id',
            'message',
            'reason',
          ),
        ).rejects.toThrow(NotFoundException);
      });
      it('Scenario 7 - should successfully create a message report and notify moderators', async () => {
        const targetMessageId = 'msg-123';
        jest.spyOn(prisma.message, 'findUnique').mockResolvedValue({
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
        jest.spyOn(prisma.report, 'create').mockResolvedValue({
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
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
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

        const result = await service.createReport(
          creatorId,
          'MESSAGE',
          undefined,
          targetMessageId,
          'Inappropriate',
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(prisma.message.findUnique).toHaveBeenCalledWith({
          where: { id: targetMessageId },
        });
        expect(result.id).toBe('report-2');
        expect(service['notifyModerators']).toHaveBeenCalled();
      });
    });

    it('Scenario 8 - should throw BadRequest for invalid targetType', async () => {
      await expect(
        service.createReport(
          creatorId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      jest.spyOn(prisma.report, 'findMany').mockResolvedValue(mockReports);

      const result = await service.listReports();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].creatorId).toBe(creatorId);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.report.findMany).toHaveBeenCalledWith({
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
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue(null);

      await expect(
        service.reviewReport(moderatorId, reportId, 'DISMISS_REPORT'),
      ).rejects.toThrow(new NotFoundException('report not found'));
    });

    it('Scenario 2: should DISMISS a report (No penalty, no ban)', async () => {
      // 1. Mock finding the report
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
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

      // The transaction callback will use these mocks
      // Note: ensure your smart $transaction mock is in place in beforeEach
      const result = await service.reviewReport(
        moderatorId,
        reportId,
        'DISMISS_REPORT',
      );

      expect(result.updatedReport.status).toBe('DISMISSED');
      // Use the transaction mock to verify NO user update happened
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockTransactionClient.user.update).not.toHaveBeenCalled();
    });

    it('Scenario 3: should WARN and subtract penalty points', async () => {
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
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
      // (Assuming your mockTick records these)
      expect(result.moderationAction.penaltyPointsChange).toBe(-50);
    });

    it('Scenario 4: should BAN user, revoke tokens, and disconnect via WebSocket', async () => {
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
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

      // Mock successful transaction
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
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
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

      const userUpdateCall = await service.reviewReport(
        moderatorId,
        reportId,
        'UNBAN',
      );

      // Verify the DB call to unban
      expect(userUpdateCall.updatedReport.status).toBe('RESOLVED');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockTransactionClient.user.update).toHaveBeenCalledWith(
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
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ id: targetId, penaltyPoints: 0 } as any);

      // We mock the first update to return 100 points
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      jest.spyOn(mockTransactionClient.user, 'update').mockResolvedValueOnce({
        id: targetId,
        username: 'marvin',
        penaltyPoints: 100,
        globalRole: 'USER',
        isActive: true,
        isBanned: false,
      });

      const result = await service.adjustPenaltyPoints(
        modId,
        targetId,
        100,
        'Good job',
      );

      expect(result.user.penaltyPoints).toBe(100);
      expect(result.promoted).toBe(false);
      expect(
        chatGateway['emitModerationBanAndDisconnect'],
      ).not.toHaveBeenCalled();
    });

    it('Scenario 4: should trigger Auto-Ban if points reach -500', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      jest.spyOn(mockTransactionClient.user, 'update').mockResolvedValueOnce({
        id: targetId,
        username: 'bad_user',
        penaltyPoints: -500,
        isBanned: false,
      });

      const result = await service.adjustPenaltyPoints(modId, targetId, -500);

      expect(result.user.isBanned).toBe(true);
      // Verify WebSocket disconnect was triggered
      expect(
        chatGateway['emitModerationBanAndDisconnect'],
      ).toHaveBeenCalledWith(
        targetId,
        expect.objectContaining({ penaltyPoints: -500 }),
      );
      // Verify Refresh Tokens were revoked in the transaction
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockTransactionClient.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('Scenario 5: should trigger Auto-Promotion if points reach +500', async () => {
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ id: targetId, penaltyPoints: 490 } as any);

      // 1. Mock first update (points increase)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      jest.spyOn(mockTransactionClient.user, 'update').mockResolvedValueOnce({
        id: targetId,
        username: 'helpful_user',
        penaltyPoints: 500,
        globalRole: 'USER',
        isActive: true,
        isBanned: false,
      });

      // 2. Mock second update (role change to MODERATOR)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      jest.spyOn(mockTransactionClient.user, 'update').mockResolvedValueOnce({
        id: targetId,
        globalRole: 'MODERATOR',
        penaltyPoints: 500,
      });

      const result = await service.adjustPenaltyPoints(modId, targetId, 10);

      expect(result.promoted).toBe(true);
      expect(result.user.globalRole).toBe('MODERATOR');
      // Verify that two notifications were sent (one for points, one for role)
      expect(service['notifyUser']).toHaveBeenCalledTimes(2);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
