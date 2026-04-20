import type { Request, Response, CookieOptions } from 'express';
import { DEFAULT_REFRESH_DAYS, REFRESH_COOKIE_NAME } from '../constants/auth.constants';

export function getRefreshTokenDays(raw?: string): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFRESH_DAYS;
}

export function getRefreshCookieMaxAgeMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

export function getRefreshCookieOptions(days: number): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: getRefreshCookieMaxAgeMs(days),
  };
}

export function setRefreshCookie(
  response: Response,
  refreshToken: string,
  days: number,
): void {
  response.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getRefreshCookieOptions(days),
  );
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
}

export function getRefreshTokenFromRequest(request: Request): string | null {
  return request.cookies?.[REFRESH_COOKIE_NAME] ?? null;
}