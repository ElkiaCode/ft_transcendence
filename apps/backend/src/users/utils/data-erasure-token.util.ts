import { createHash, randomBytes } from 'node:crypto';

export function generateDataErasureToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashDataErasureToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
