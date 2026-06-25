import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  Query,
  Get,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  clearRefreshCookie,
  getRefreshTokenFromRequest,
  setRefreshCookie,
} from './utils/refresh-cookie.util';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: ExpressResponse,
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
  @ApiOperation({ summary: 'Logs in a user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: ExpressResponse,
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
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: ExpressResponse,
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
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    const rawRefreshToken = getRefreshTokenFromRequest(request);

    await this.authService.logout(rawRefreshToken);
    clearRefreshCookie(response);

    response.clearCookie('access_token');

    return { success: true };
  }

  @Get('42/callback')
  async loginWith42(
    @Query('code') code: string,
    @Res() response: ExpressResponse,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'https://localhost:8443/';

    if (!code) {
      return response.redirect(`${frontendUrl}/?error=oauth_missing_code`);
    }

    try {
      const result = await this.authService.loginWith42(code);

      setRefreshCookie(
        response,
        result.refreshToken,
        this.authService.getRefreshTokenDays(),
      );

      return response.redirect(`${frontendUrl}/`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'oauth_failed';

      return response.redirect(
        `${frontendUrl}/?error=oauth_failed&error_message=${encodeURIComponent(message)}`,
      );
    }
  }
}