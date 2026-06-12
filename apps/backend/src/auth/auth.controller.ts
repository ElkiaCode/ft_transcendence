import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
  Query,
  Get,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  clearRefreshCookie,
  getRefreshTokenFromRequest,
  setRefreshCookie,
} from './utils/refresh-cookie.util';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

const FORTYTWO_STATE_COOKIE = '__Host-fortytwoState';
const FORTYTWO_STATE_TTL_MS = 10 * 60 * 1000;

function oauthStatesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);

    setRefreshCookie(
      response,
      result.refreshToken,
      this.authService.getRefreshTokenDays(),
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Logs in a user' }) // Human readable title
  @ApiBody({ type: LoginDto }) // Tells Swagger to use the LoginDto Schema for the request
  @ApiResponse({ status: 201, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);

    setRefreshCookie(
      response,
      result.refreshToken,
      this.authService.getRefreshTokenDays(),
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawRefreshToken = getRefreshTokenFromRequest(request);
    const result = await this.authService.refresh(rawRefreshToken);

    setRefreshCookie(
      response,
      result.refreshToken,
      this.authService.getRefreshTokenDays(),
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawRefreshToken = getRefreshTokenFromRequest(request);

    await this.authService.logout(rawRefreshToken);
    clearRefreshCookie(response);

    response.clearCookie('access_token');

    return { success: true };
  }

  @Get('42')
  startLoginWith42(@Res() response: Response) {
    const state = randomBytes(32).toString('base64url');

    response.cookie(FORTYTWO_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: FORTYTWO_STATE_TTL_MS,
    });

    return response.redirect(
      this.authService.getFortyTwoAuthorizationUrl(state),
    );
  }

  @Get('42/callback')
  async loginWith42(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const expectedState = request.cookies?.[FORTYTWO_STATE_COOKIE] as
      | string
      | undefined;

    response.clearCookie(FORTYTWO_STATE_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });

    if (oauthError) {
      throw new BadRequestException(`42 authorization failed: ${oauthError}`);
    }

    if (!code) throw new BadRequestException('missing code');
    if (
      !expectedState ||
      !state ||
      !oauthStatesMatch(expectedState, state)
    ) {
      throw new BadRequestException('invalid or expired 42 OAuth state');
    }

    const result = await this.authService.loginWith42(code);

    setRefreshCookie(
      response,
      result.refreshToken,
      this.authService.getRefreshTokenDays(),
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'https://localhost:8443',
    );
    return response.redirect(frontendUrl);
  }
}
