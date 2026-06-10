import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BAD_WORD_RULES, BadWordRule } from './bad-words.dictionary';

type AutoModerationAction = 'ALLOW' | 'REPORT' | 'BLOCK';

export type AutoModerationResult = {
  flagged: boolean;
  action: AutoModerationAction;
  severity: number;
  penaltyPointsToSubtract: number;
  categories: string[];
  matches: Array<{
    provider: 'dictionary' | 'openai';
    value: string;
    category: string;
    severity: number;
  }>;
  providerErrors: string[];
};

type OpenAiModerationResult = {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
};

export interface ModerationPenalty {
  penaltyPoints: number;
  pointsLeftBeforeBan: number;
  isBanned: boolean;
}

export interface ModerationApplyResult {
  report: any;
  penalty: ModerationPenalty;
}

interface OpenAiModerationResponse {
  id: string;
  model: string;
  results: OpenAiModerationResult[];
}

@Injectable()
export class AutoModerationService {
  private readonly logger = new Logger(AutoModerationService.name);
  private readonly openAiModerationModel =
    process.env.OPENAI_MODERATION_MODEL ?? 'omni-moderation-latest';

  constructor(private readonly prisma: PrismaService) {}

  async analyze(content: string): Promise<AutoModerationResult> {
    const dictionaryResult = this.analyzeWithDictionary(content);
    const providerErrors: string[] = [];
    let openAiMatches: AutoModerationResult['matches'] = [];

    if (this.shouldUseOpenAi()) {
      try {
        openAiMatches = await this.analyzeWithOpenAi(content);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'OpenAI moderation failed';
        providerErrors.push(message);
        this.logger.warn(`OpenAI moderation unavailable: ${message}`);
      }
    }

    const matches = [...dictionaryResult.matches, ...openAiMatches];
    const severity = matches.reduce(
      (total, match) => total + match.severity,
      0,
    );
    const categories = [...new Set(matches.map((match) => match.category))];
    const action = this.actionForSeverity(severity);

    return {
      flagged: severity > 0,
      action,
      severity,
      penaltyPointsToSubtract: this.penaltyForSeverity(severity),
      categories,
      matches,
      providerErrors,
    };
  }

  async applyBlockedMessage(
    userId: string,
    content: string,
    result: AutoModerationResult,
    messageId?: string,
  ): Promise<ModerationApplyResult> {
    const penaltyResult = await this.applyPenaltyAndAutoBan(
      userId,
      result.penaltyPointsToSubtract,
    );

    const report = await this.prisma.client.report.create({
      data: {
        creatorId: null,
        targetType: messageId ? 'MESSAGE' : 'USER',
        targetUserId: messageId ? undefined : userId,
        targetMessageId: messageId,
        reason: this.buildReason('blocked message', result, content),
      },
    });

    return {
      report,
      penalty: penaltyResult,
    };
  }

  async applyFlaggedMessage(
    userId: string,
    messageId: string,
    content: string,
    result: AutoModerationResult,
  ) {
    if (!result.flagged) {
      return null;
    }

    const penalty = await this.applyPenaltyAndAutoBan(
      userId,
      result.penaltyPointsToSubtract,
    );

    const report = await this.prisma.client.report.create({
      data: {
        creatorId: null,
        targetType: 'MESSAGE',
        targetMessageId: messageId,
        reason: this.buildReason('flagged message', result, content),
      },
    });

    return {
      report,
      penalty,
    };
  }

  private analyzeWithDictionary(
    content: string,
  ): Pick<AutoModerationResult, 'matches'> {
    const normalized = this.normalizeText(content);

    return {
      matches: BAD_WORD_RULES.filter((rule) =>
        this.ruleMatches(normalized, rule),
      ).map((rule) => ({
        provider: 'dictionary',
        value: rule.value,
        category: rule.category,
        severity: rule.severity,
      })),
    };
  }

  private async analyzeWithOpenAi(
    content: string,
  ): Promise<AutoModerationResult['matches']> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return [];
    }

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.openAiModerationModel,
        input: content,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI moderation returned ${response.status}`);
    }

    const data = (await response.json()) as OpenAiModerationResponse;
    const result = data.results?.[0];

    if (!result?.flagged || !result.categories) {
      return [];
    }

    return Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => ({
        provider: 'openai',
        value: category,
        category,
        severity: this.openAiSeverity(
          category,
          result.category_scores?.[category] ?? 0,
        ),
      }));
  }

  private shouldUseOpenAi() {
    return (
      Boolean(process.env.OPENAI_API_KEY) &&
      process.env.AUTO_MODERATION_USE_OPENAI !== 'false'
    );
  }

  private normalizeText(input: string) {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[@]/g, 'a')
      .replace(/[0]/g, 'o')
      .replace(/[1!]/g, 'i')
      .replace(/[3]/g, 'e')
      .replace(/[5$]/g, 's')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private ruleMatches(normalizedContent: string, rule: BadWordRule) {
    const normalizedRule = this.normalizeText(rule.value);
    const escapedRule = normalizedRule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-z0-9])${escapedRule}([^a-z0-9]|$)`, 'i');

    return pattern.test(normalizedContent);
  }

  private actionForSeverity(severity: number): AutoModerationAction {
    if (severity >= 300) return 'BLOCK';
    if (severity >= 50) return 'REPORT';
    return 'ALLOW';
  }

  private penaltyForSeverity(severity: number) {
    if (severity >= 300) return 200;
    if (severity >= 150) return 75;
    if (severity >= 50) return 25;
    return 0;
  }

  private openAiSeverity(category: string, score: number) {
    const baseSeverityByCategory: Record<string, number> = {
      harassment: 100,
      'harassment/threatening': 250,
      hate: 180,
      'hate/threatening': 350,
      illicit: 100,
      'illicit/violent': 250,
      'self-harm': 250,
      'self-harm/intent': 350,
      'self-harm/instructions': 400,
      sexual: 120,
      'sexual/minors': 500,
      violence: 120,
      'violence/graphic': 250,
    };

    const baseSeverity = baseSeverityByCategory[category] ?? 100;
    return Math.max(
      baseSeverity,
      Math.round(baseSeverity * Math.max(score, 0.5)),
    );
  }

  private async applyPenaltyAndAutoBan(
    userId: string,
    penaltyPointsToSubtract: number,
  ): Promise<ModerationPenalty> {
    if (penaltyPointsToSubtract <= 0) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: {
          penaltyPoints: true,
          isBanned: true,
        },
      });

      return {
        penaltyPoints: user?.penaltyPoints ?? 0,
        pointsLeftBeforeBan: Math.max(0, (user?.penaltyPoints ?? 0) + 500),
        isBanned: user?.isBanned ?? false,
      };
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        penaltyPoints: {
          decrement: penaltyPointsToSubtract,
        },
      },
      select: {
        id: true,
        penaltyPoints: true,
        isBanned: true,
      },
    });

    if (updatedUser.penaltyPoints > -500) {
      return {
        penaltyPoints: updatedUser.penaltyPoints,
        pointsLeftBeforeBan: updatedUser.penaltyPoints + 500,
        isBanned: updatedUser.isBanned,
      };
    }

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          isActive: false,
        },
      }),
      this.prisma.client.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      penaltyPoints: updatedUser.penaltyPoints,
      pointsLeftBeforeBan: 0,
      isBanned: true,
    };
  }

  private buildReason(
    label: string,
    result: AutoModerationResult,
    content: string,
  ) {
    const matches = result.matches
      .map((match) => `${match.provider}:${match.category}:${match.value}`)
      .join(', ');
    const preview =
      content.length > 160 ? `${content.slice(0, 160)}...` : content;

    return `[AUTO] ${label}; action=${result.action}; severity=${result.severity}; penalty=${result.penaltyPointsToSubtract}; matches=${matches}; content="${preview}"`;
  }
}
