import { BadRequestException, Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { clearRefreshCookie, getRefreshTokenFromRequest, setRefreshCookie } from './utils/refresh-cookie.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

    return { success: true };
  }

  @Post('42/callback')
  async loginWith42(
    @Body('code') code: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!code) throw new BadRequestException('missing code');

    const result = await this.authService.loginWith42(code);

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
}
