import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn<any>((input: any[]) => Promise.all(input)),
            user: {
              findUnique: jest.fn<any>(),
              findFirst: jest.fn<any>(),
              create: jest.fn<any>(),
            },
            refreshToken: {
              create: jest.fn<any>(),
              findUnique: jest.fn<any>(),
              update: jest.fn<any>(),
              updateMany: jest.fn<any>(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn<any>().mockResolvedValue('mock-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn<any>().mockReturnValue('7'), // 7 days for refresh
            getOrThrow: jest.fn<any>((key: string) => {
              if (key === 'JWT_REFRESH_DAYS') return '7';
              return key;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    // Mock global fetch for 42 OAuth
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  describe('register', () => {
    const dto = {
      email: 'test@42.fr',
      username: 'marvin',
      password: 'password123',
    };

    it('Scenario 1 - should throw BadRequestException if email already exists', async () => {
      jest
        .spyOn(prisma.client.user, 'findUnique')
        .mockResolvedValue({ id: '1' } as any);
      await expect(service.register(dto)).rejects.toThrow(
        'email already in use',
      );
    });

    it('Scenario 2 - should throw BadRequestException if username already exists', async () => {
      jest
        .spyOn(prisma.client.user, 'findUnique')
        .mockResolvedValueOnce(null) // 1st call (Email check) -> Not found
        .mockResolvedValueOnce({ id: '1' } as any); // 2nd call (Username check) -> Found!
      await expect(service.register(dto)).rejects.toThrow(
        'username already in use',
      );
    });

    it('Scenario 3 - should create user and session on success', async () => {
      jest.spyOn(prisma.client.user, 'findUnique').mockResolvedValue(null);

      jest.spyOn(prisma.client.user, 'create').mockResolvedValue({
        id: 'new-id',
        email: dto.email,
        username: dto.username,
        globalRole: 'USER',
      } as any);

      jest.mocked(bcrypt.hash).mockResolvedValue('hashed-pass' as never);

      const result = await service.register(dto);

      expect(result.accessToken).toBeDefined();
      expect(prisma.client.user.create).toHaveBeenCalled();
      expect(result.user.username).toBe('marvin');
      expect(jest.mocked(bcrypt.hash)).toHaveBeenCalledWith(dto.password, 12);
    });
  });

  describe('login', () => {
    const dto = {
      email: 'test@42.fr',
      username: 'marvin',
      password: 'password123',
    };

    it('Scenario 1 - should throw UnauthorizedException if no user or no password hash found in DB', async () => {
      jest.spyOn(prisma.client.user, 'findUnique').mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('invalid credentials'),
      );
    });

    it('Scenario 2 - should throw UnauthorizedException if password given is bad', async () => {
      jest.spyOn(prisma.client.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
        passwordHash: 'some-random-hash-from-db', // The value doesn't matter
        isActive: true,
        isBanned: false,
      } as any);
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('invalid credentials'),
      );
      expect(jest.mocked(bcrypt.compare)).toHaveBeenCalledWith(
        dto.password,
        'some-random-hash-from-db',
      );
    });
    it('Scenario 3 - should throw UnauthorizedException if account is inactive', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: dto.email,
        passwordHash: 'some-random-hash-from-db', // The value doesn't matter
        isActive: false,
        isBanned: false,
      };

      jest
        .spyOn(prisma.client.user, 'findUnique')
        .mockResolvedValue(mockUser as any);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('account is inactive'),
      );
    });

    it('Scenario 4 - should throw UnauthorizedException if user is banned', async () => {
      jest.spyOn(prisma.client.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
        passwordHash: 'some-random-hash-from-db', // The value doesn't matter
        isActive: true,
        isBanned: true,
      } as any);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('account is banned'),
      );
    });
    it('Scenario 5 - should create a session on success', async () => {
      jest.spyOn(prisma.client.user, 'findUnique').mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
        username: dto.username,
        passwordHash: 'some-random-hash-from-db', // The value doesn't matter
        isActive: true,
        isBanned: false,
      } as any);

      jest.mocked(bcrypt.hash).mockResolvedValue('hashed-pass' as never);

      const result = await service.login(dto);

      expect(result.accessToken).toBeDefined();
      expect(result.user.username).toBe('marvin');
    });
  });

  describe('refresh', () => {
    const rawToken = 'some-valid-raw-token';
    it('Scenario 1 - should throw UnauthorizedException if no refresh token found in DB', async () => {
      const fakeToken = 'some-token';
      jest
        .spyOn(prisma.client.refreshToken, 'findUnique')
        .mockResolvedValue(null);
      await expect(service.refresh(fakeToken)).rejects.toThrow(
        new UnauthorizedException('invalid refresh token'),
      );
    });

    it('Scenario 2 - should throw UnauthorizedException if no refresh token in refresh token tab', async () => {
      const mockStoredToken = null;
      jest
        .spyOn(prisma.client.refreshToken, 'findUnique')
        .mockResolvedValue(mockStoredToken);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('invalid refresh token'),
      );
    });
    it('Scenario 3 - should throw UnauthorizedException if stored token is revoked', async () => {
      const mockStoredToken = {
        id: 'token-id',
        revokedAt: new Date(), // This triggers the error
        user: { isActive: true, isBanned: false },
      };
      jest
        .spyOn(prisma.client.refreshToken, 'findUnique')
        .mockResolvedValue(mockStoredToken as any);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('refresh token revoked'),
      );
    });

    it('Scenario 4 - should throw UnauthorizedException if stored token is expired', async () => {
      const mockStoredToken = {
        id: 'token-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 10000), //expired 10 seconds ago
        user: { isActive: true, isBanned: false },
      };
      jest
        .spyOn(prisma.client.refreshToken, 'findUnique')
        .mockResolvedValue(mockStoredToken as any);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('refresh token expired'),
      );
    });

    it('Scenario 5 - should throw UnauthorizedException if user is not active', async () => {
      const mockStoredToken = {
        id: 'token-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10000), // Valid for this scenario
        user: { isActive: false, isBanned: false },
      };
      jest
        .spyOn(prisma.client.refreshToken, 'findUnique')
        .mockResolvedValue(mockStoredToken as any);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('account is inactive'),
      );
    });
    it('Scenario 6 - should throw UnauthorizedException if user is banned', async () => {
      const mockStoredToken = {
        id: 'token-id',
        user: { isActive: true, isBanned: true },
      };
      jest
        .spyOn(prisma.client.refreshToken, 'findUnique')
        .mockResolvedValue(mockStoredToken as any);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      await expect(service.refresh(rawToken)).rejects.toThrow(
        new UnauthorizedException('account is banned'),
      );
    });
    it('Scenario 7 - should create a refresh token on success', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'marvin@42.fr',
        username: 'marvin',
        globalRole: 'USER',
        isActive: true,
        isBanned: false,
      };

      const mockStoredToken = {
        id: 'old-token-id',
        userId: 'user-uuid',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10000),
        user: mockUser,
      };

      jest
        .mocked(prisma.client.refreshToken.findUnique)
        .mockResolvedValue(mockStoredToken as any);
      jest.mocked(prisma.client.$transaction).mockResolvedValue([]);

      const result = await service.refresh(rawToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined(); // The utility generates a new one
      expect(result.user.username).toBe('marvin');
    });
  });

  describe('logout', () => {
    it('Scenario 1 - should return early and do nothing if no token is provided', async () => {
      // Act
      await service.logout(null);

      // Assert: Verify that the DB was never called
      expect(prisma.client.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('Scenario 2 - should revoke the token in the database if a valid token is provided', async () => {
      const rawToken = 'my-valid-token';

      // 1. Mock the updateMany to return a fake result (count of updated rows)
      jest
        .spyOn(prisma.client.refreshToken, 'updateMany')
        .mockResolvedValue({ count: 1 });

      // 2. Act
      await service.logout(rawToken);

      // 3. Assert: Verify the DB call
      expect(prisma.client.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash: expect.any(String),
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('loginWith42', () => {
    it('Scenario 1 - should throw Unauthorized if 42 token exchange fails', async () => {
      jest.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);
      await expect(service.loginWith42('fake-code')).rejects.toThrow(
        'invalid 42 code',
      );
    });

    it('Scenario 2 - should find existing user and return session', async () => {
      const mockFetch = jest.mocked(global.fetch);
      // Mock Token Response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'at' }),
        } as Response)
        // Mock User Info Response
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 42, email: 'marvin@42.fr', login: 'marvin' }),
        } as Response);

      jest.mocked(prisma.client.user.findFirst).mockResolvedValue({
        id: 'user-42',
        isActive: true,
        isBanned: false,
      } as any);

      const result = await service.loginWith42('valid-code');
      expect(result.user.id).toBe('user-42');
    });
  });

  describe('signAccessToken', () => {
    const payload = {
      sub: 'user-uuid',
      email: 'marvin@42.fr',
      username: 'marvin',
      role: 'USER' as const,
    };

    it('Scenario 1 - should return a signed JWT token from the JwtService', async () => {
      const mockToken = 'eyJhbGci...'; // A fake JWT string

      // 1. Arrange: Tell the mock JwtService what to return
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(mockToken);

      // 2. Act
      const result = await service.signAccessToken(payload);

      // 3. Assert
      expect(result).toBe(mockToken);

      // CRITICAL: Check that it was called with the correct payload
      expect(jwtService.signAsync).toHaveBeenCalledWith(payload);
    });

    it('Scenario 2 - should throw an error if JwtService fails', async () => {
      // 1. Arrange: Simulate a failure (e.g., missing JWT_SECRET)
      jest
        .spyOn(jwtService, 'signAsync')
        .mockRejectedValue(new Error('JWT Config Error'));

      // 2. Act & Assert
      await expect(service.signAccessToken(payload)).rejects.toThrow(
        'JWT Config Error',
      );
    });
  });

  afterEach(() => {
    jest.restoreAllMocks(); // This cleans up spyOn mocks
  });
});
