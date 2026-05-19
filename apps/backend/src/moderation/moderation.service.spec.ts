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
      moderationAction: { create: jest.fn().mockResolvedValue({ id: 'act-1' }) },
      report: { 
        update: jest.fn().mockImplementation(({ data }) => 
          Promise.resolve({ id: 'rep-1', status: data.status })) 
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
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
        jest
          .spyOn(prisma.user, 'findUnique')
          .mockResolvedValue({ id: targetUserId } as any);
        jest
          .spyOn(prisma.user, 'findMany')
          .mockResolvedValue([{ id: 'admin-1' }, { id: 'mod-1' }] as any);
        jest
          .spyOn(prisma.report, 'create')
          .mockResolvedValue({ id: 'report-1' } as any);

        const result = await service.createReport(
          creatorId,
          'USER',
          targetUserId, //targetUserId
          undefined, //targetMessageId
          '  Toxic behavior  ',
        );

        expect(result.id).toBe('report-1');
        // Verify trimming logic
        expect(prisma.report.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ reason: 'Toxic behavior' }),
        });
        expect((service as any).notifyModerators).toHaveBeenCalled();
        expect(notificationsService.createFromInputForMany).toHaveBeenCalled();
        expect(chatGateway.emitNotificationCreated).toHaveBeenCalledTimes(2); // One for each moderator
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
        jest
          .spyOn(prisma.message, 'findUnique')
          .mockResolvedValue({ id: targetMessageId } as any);
        jest
          .spyOn(prisma.report, 'create')
          .mockResolvedValue({ id: 'report-2' } as any);
        jest
          .spyOn(prisma.user, 'findMany')
          .mockResolvedValue([{ id: 'admin-1' }] as any);


        const result = await service.createReport(
          creatorId,
          'MESSAGE',
          undefined,
          targetMessageId,
          'Inappropriate',
        );

        
        expect(prisma.message.findUnique).toHaveBeenCalledWith({
          where: { id: targetMessageId },
        });
        expect(result.id).toBe('report-2');
        expect((service as any).notifyModerators).toHaveBeenCalled();
      });
    });

    it('Scenario 8 - should throw BadRequest for invalid targetType', async () => {
      await expect(
        service.createReport(
          creatorId,
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
    const mockReports = [
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
        actions: []
      }
    ];

    it('Scenario 1: succesfully list report', async () => {
      jest
        .spyOn(prisma.report, 'findMany')
        // .mockResolvedValue([{ 
        //   creatorId: creatorId,
        //   targetType: 'USER',
        //   targetUserId: targetUserId,
        //   targetMessageId: 'targetMessageId',
        //   reason: ' Toxic behavior  ',
        //   createdAt: new Date(),
        //   // Mock the includes if your service logic uses them
        //   creator: { username: 'reporter' },
        //   targetUser: { username: 'bad_user' },
        //   // targetMessage: { },
        //   actions: [], }] as any);
        .mockResolvedValue(mockReports as any);

      const result = await service.listReports();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect (result[0].creatorId).toBe(creatorId);
      expect(prisma.report.findMany).toHaveBeenCalledWith({
          include: expect.objectContaining({
          // Match the nested structure exactly
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
        service.reviewReport(moderatorId, reportId, 'DISMISS_REPORT')
      ).rejects.toThrow(new NotFoundException('report not found'));
    });

    it('Scenario 2: should DISMISS a report (No penalty, no ban)', async () => {
      // 1. Mock finding the report
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
        id: reportId,
        targetUserId,
      } as any);

      // 2. Mock transaction results
      const mockAction = { id: 'act-1' };
      const mockReport = { id: reportId, status: 'DISMISSED' };

      // The transaction callback will use these mocks
      // Note: ensure your smart $transaction mock is in place in beforeEach
      
      const result = await service.reviewReport(moderatorId, reportId, 'DISMISS_REPORT');

      expect(result.updatedReport.status).toBe('DISMISSED');
      expect(prisma.user.update).not.toHaveBeenCalled(); // No points changed, no ban
    });

    it('Scenario 3: should WARN and subtract penalty points', async () => {
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
        id: reportId,
        targetUserId,
      } as any);

      // Act
      const result = await service.reviewReport(moderatorId, reportId, 'WARN', 'Bad behavior', 50);

      // Assert: Check if penaltyPointsChange was calculated correctly (-50)
      // We check the transaction call for ModerationAction creation
      // (Assuming your mockTick records these)
      expect(result.moderationAction.penaltyPointsChange).toEqual(-50);
    });

    it('Scenario 4: should BAN user, revoke tokens, and disconnect via WebSocket', async () => {
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
        id: reportId,
        targetUserId,
      } as any);

      // Mock successful transaction
      const result = await service.reviewReport(moderatorId, reportId, 'BAN', 'Toxic');

      // Verify side effects
      expect(chatGateway.emitModerationBanAndDisconnect).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({ message: 'Your account was banned by moderation.' })
      );
    });

    it('Scenario 5: should UNBAN a user successfully', async () => {
      jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({ id: reportId, targetUserId } as any);
      
      const userUpdateCall = await service.reviewReport(moderatorId, reportId, 'UNBAN');

      // Verify the DB call to unban
      expect(userUpdateCall).toEqual({ isBanned: false, isActive: true });
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
});

