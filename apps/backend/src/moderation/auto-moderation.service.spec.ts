import { Test, TestingModule } from '@nestjs/testing';
import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { PrismaService } from '../prisma/prisma.service';
import {
  AutoModerationService,
  AutoModerationResult,
} from './auto-moderation.service';

describe('AutoModerationService', () => {
  let service: AutoModerationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoModerationService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            message: { findUnique: jest.fn() },
            report: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();
    service = module.get<AutoModerationService>(AutoModerationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('analyze', () => {
    it('Scenario 1: should return ALLOW for clean text', async () => {
      const result = await service.analyze('I love coding');
      expect(result.flagged).toBe(false);
      expect(result.action).toBe('ALLOW');
    });

    it('Scenario 2: should return moderation from bad words dictionnary only', async () => {
      jest.spyOn(service as any, 'shouldUseOpenAi').mockReturnValue(false);
      const result = await service.analyze('there is a bamboula here');
      expect(result.flagged).toBe(true);
      expect(result.action).toBe('REPORT');
      expect(result.severity).toBe(200);
    });

    it('Scenario 3: should return moderation from OpenAI only', async () => {
      jest.spyOn(service as any, 'shouldUseOpenAi').mockReturnValue(true);
      jest.spyOn(service as any, 'analyzeWithOpenAi').mockResolvedValue([
        {
          provider: 'openai',
          value: 'bad text',
          category: 'toxic',
          severity: 50,
        },
      ]);
      const result = await service.analyze('some bad text');
      expect(result.flagged).toBe(true);
      expect(result.action).toBe('REPORT');
      expect(result.severity).toBe(50);
      expect(result.penaltyPointsToSubtract).toBe(25);
    });

    it('Scenario 4: should return moderation from both moderators', async () => {
      jest.spyOn(service as any, 'shouldUseOpenAi').mockReturnValue(true);
      jest.spyOn(service as any, 'analyzeWithOpenAi').mockResolvedValue([
        {
          provider: 'openai',
          value: 'bad text',
          category: 'toxic',
          severity: 50,
        },
      ]);
      const result = await service.analyze('some badword text');
      expect(result.flagged).toBe(true);
      expect(result.action).toBe('REPORT');
      expect(result.severity).toBe(100);
      expect(result.penaltyPointsToSubtract).toBe(25);
    });

    it('Scenario 5: should handle OpenAI API failure gracefully', async () => {
      // Mock private method or the external call to fail
      jest.spyOn(service as any, 'shouldUseOpenAi').mockReturnValue(true);
      jest
        .spyOn(service as any, 'analyzeWithOpenAi')
        .mockRejectedValue(new Error('API Down'));

      const result = await service.analyze('some text');
      expect(result.providerErrors).toContain('API Down');
    });
  });

  describe('applyBlockedMessage', () => {
    it('Scenario 1 - should create a MESSAGE report', async () => {
      const userId = 'user123';
      // THE FIX: Explicitly mock the return value here
      // Cast to 'any' to avoid the "type never" / "argument not assignable" errors
      jest.spyOn(prisma.client.user, 'update').mockResolvedValue({
        id: userId,
        penaltyPoints: 10,
        isBanned: false,
        email: '',
        username: '',
        passwordHash: null,
        globalRole: 'USER',
        isActive: false,
        preferredLanguage: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(prisma.client.report, 'create').mockResolvedValue({
        id: 'report-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'OPEN',
        creatorId: null,
        targetType: 'USER',
        targetUserId: null,
        targetMessageId: null,
        reason: '',
      });

      const result = await service.applyBlockedMessage(
        userId,
        'bad content',
        {
          penaltyPointsToSubtract: 25,
          flagged: false,
          action: 'ALLOW',
          severity: 0,
          categories: [],
          matches: [],
          providerErrors: [],
        },
        'msg456',
      );

      expect(result.report.id).toBe('report-1');
      expect(prisma.client.user.update).toHaveBeenCalled();
    });

    it('Scenario 2 - should create a USER report when userId is provided', async () => {
      const resultMock: AutoModerationResult = {
        penaltyPointsToSubtract: 25,
        severity: 50,
        flagged: false,
        action: 'ALLOW',
        categories: [],
        matches: [],
        providerErrors: [],
      };
      const user = { id: 'user123', penaltyPoints: 0, isBanned: false };
      jest.spyOn(service as any, 'applyPenaltyAndAutoBan').mockResolvedValue({
        penaltyPoints: 0,
        pointsLeftBeforeBan: 500,
        isBanned: false,
      });
      jest
        .spyOn(service as any, 'buildReason')
        .mockResolvedValue(' Reason: violation detected');
      await service.applyBlockedMessage(
        user.id,
        'what a badword',
        resultMock,
        '',
      );
      expect(prisma.client.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetType: 'USER',
          targetUserId: user.id,
        }),
      });
    });

    it('Scenario 3 - should apply penalty and autoban according to penaltyPointsToSubtract', async () => {
      const resultMock: AutoModerationResult = {
        penaltyPointsToSubtract: 25,
        severity: 50,
        flagged: false,
        action: 'ALLOW',
        categories: [],
        matches: [],
        providerErrors: [],
      };
      jest.spyOn(prisma.client.user, 'update').mockResolvedValue({
        id: 'user1',
        penaltyPoints: 10,
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
      const user = { id: 'user123', penaltyPoints: -475, isBanned: false };
      await service.applyBlockedMessage(
        user.id,
        'what a badword',
        resultMock,
        '',
      );
      expect(prisma.client.report.create).toHaveBeenCalled();
    });
  });

  describe('applyFlaggedMessage', () => {
    it('Scenario 1 - not flagged case', async () => {
      const resultMock: AutoModerationResult = {
        penaltyPointsToSubtract: 25,
        severity: 50,
        flagged: false,
        action: 'ALLOW',
        categories: [],
        matches: [],
        providerErrors: [],
      };
      const result = await service.applyFlaggedMessage(
        'user123',
        'mess123',
        'everything is fine',
        resultMock,
      );
      expect(result).toBe(null);
      expect(prisma.client.report.create).not.toHaveBeenCalled();
    });

    it('Scenario 2 - should flag the message, and create a report', async () => {
      const resultMock: AutoModerationResult = {
        penaltyPointsToSubtract: 25,
        severity: 50,
        flagged: true,
        action: 'ALLOW',
        categories: [],
        matches: [],
        providerErrors: [],
      };
      const userId = 'user123';
      jest.spyOn(prisma.client.user, 'update').mockResolvedValue({
        id: userId,
        penaltyPoints: 10,
        isBanned: false,
        email: '',
        username: '',
        passwordHash: null,
        globalRole: 'USER',
        isActive: false,
        preferredLanguage: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(prisma.client.report, 'create').mockResolvedValue({
        id: 'report-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'OPEN',
        creatorId: null,
        targetType: 'MESSAGE',
        targetUserId: null,
        targetMessageId: 'mess123',
        reason: '',
      });

      const result = await service.applyFlaggedMessage(
        'user123',
        'mess123',
        'everything is bad',
        resultMock,
      );
      expect(result).not.toBeNull();
      expect(result?.report.id).toBe('report-1');
      expect(result?.penalty.penaltyPoints).toBe(10);
    });

    it("Scenario 3 - should flag to targetType: 'MESSAGE' by default", async () => {
      const resultMock: AutoModerationResult = {
        penaltyPointsToSubtract: 25,
        severity: 50,
        flagged: true,
        action: 'ALLOW',
        categories: [],
        matches: [],
        providerErrors: [],
      };

      jest
        .spyOn(prisma.client.report, 'create')
        .mockResolvedValue({ id: 'report-1' } as any);
      jest.spyOn(prisma.client.user, 'update').mockResolvedValue({
        id: 'user1',
        penaltyPoints: 10,
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
      await service.applyFlaggedMessage(
        'user1',
        'mess123',
        'everything is bad',
        resultMock,
      );
      expect(prisma.client.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetType: 'MESSAGE',
          targetMessageId: 'mess123',
        }),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
