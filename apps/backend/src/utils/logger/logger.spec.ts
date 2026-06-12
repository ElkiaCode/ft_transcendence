import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logger';

describe('LoggingInterceptor', () => {
  it('does not log HTTP bodies or response payloads', async () => {
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const interceptor = new LoggingInterceptor();
    const context = {
      getType: () => 'http',
      getHandler: () => ({ name: 'login' }),
      getClass: () => ({ name: 'AuthController' }),
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/auth/login?code=oauth-secret',
          path: '/api/auth/login',
          body: {
            email: 'alice@example.com',
            password: 'secret-password',
          },
        }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () =>
        of({
          accessToken: 'secret-token',
          passwordHash: 'secret-hash',
        }),
    } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next));

    const logs = debug.mock.calls.flat().join(' ');
    expect(logs).toContain('/api/auth/login');
    expect(logs).not.toContain('oauth-secret');
    expect(logs).not.toContain('secret-password');
    expect(logs).not.toContain('secret-token');
    expect(logs).not.toContain('secret-hash');
  });

  it('does not log WebSocket message payloads', async () => {
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const interceptor = new LoggingInterceptor();
    const context = {
      getType: () => 'ws',
      getHandler: () => ({ name: 'sendMessage' }),
      getClass: () => ({ name: 'ChatGateway' }),
      switchToWs: () => ({
        getClient: () => ({ id: 'socket-1' }),
        getData: () => ({ content: 'private message' }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ content: 'private response' }),
      } as CallHandler),
    );

    const logs = debug.mock.calls.flat().join(' ');
    expect(logs).toContain('socket-1');
    expect(logs).not.toContain('private message');
    expect(logs).not.toContain('private response');
  });
});
