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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: PrismaService,
          useValue: {
            // $transaction: jest.fn((input) => Promise.all(input)),
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              // findFirst: jest.fn(),
              // create: jest.fn(),
            },
            message: { findUnique: jest.fn() },
            report: { create: jest.fn() },
            // refreshToken: {
            //   create: jest.fn(),
            //   findUnique: jest.fn(),
            //   update: jest.fn(),
            //   updateMany: jest.fn(),
            // },
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
        // },
        // {
        //   provide: ConfigService,
        //   useValue: {
        //     get: jest.fn().mockReturnValue('7'), // 7 days for refresh
        //     getOrThrow: jest.fn((key) => {
        //       if (key === 'JWT_REFRESH_DAYS') return '7';
        //       return key;
        //     }),
        //   },
        // },
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
    jest.spyOn(service as any, 'notifyModerators').mockResolvedValue(undefined);
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
        // expect(prisma.report.create).toHaveBeenCalledWith({
        //   data: expect.objectContaining({ reason: 'Toxic behavior' }),
        // });
        // expect((service as any).notifyModerators).toHaveBeenCalled();
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
      it('Scenario 7 - should successfully create a message report', async () => {
        const targetMessageId = 'msg-123';
        jest
          .spyOn(prisma.message, 'findUnique')
          .mockResolvedValue({ id: targetMessageId } as any);
        jest
          .spyOn(prisma.report, 'create')
          .mockResolvedValue({ id: 'report-2' } as any);

        const result = await service.createReport(
          creatorId,
          'MESSAGE',
          undefined,
          targetMessageId,
          'Inappropriate',
        );

        expect(result.id).toBe('report-2');
        expect(prisma.message.findUnique).toHaveBeenCalledWith({
          where: { id: targetMessageId },
        });
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

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
