import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../types/jwt-payload.type';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  function createStrategy(databaseUser: unknown) {
    const findUnique = jest.fn().mockResolvedValue(databaseUser);
    const strategy = new JwtStrategy(
      {
        getOrThrow: jest.fn().mockReturnValue('test-access-secret'),
      } as unknown as ConfigService,
      {
        client: {
          user: { findUnique },
        },
      } as unknown as PrismaService,
    );

    return { strategy, findUnique };
  }

  const tokenPayload: JwtPayload = {
    sub: 'user-1',
    email: 'old@example.com',
    username: 'old-name',
    role: 'MODERATOR',
  };

  it('returns the current database identity and role', async () => {
    const { strategy } = createStrategy({
      id: 'user-1',
      email: 'current@example.com',
      username: 'current-name',
      globalRole: 'USER',
      isBanned: false,
      isActive: true,
    });

    await expect(strategy.validate(tokenPayload)).resolves.toEqual({
      sub: 'user-1',
      email: 'current@example.com',
      username: 'current-name',
      role: 'USER',
    });
  });

  it('rejects a user who was banned after the token was issued', async () => {
    const { strategy } = createStrategy({
      id: 'user-1',
      email: 'current@example.com',
      username: 'current-name',
      globalRole: 'USER',
      isBanned: true,
      isActive: false,
    });

    await expect(strategy.validate(tokenPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
