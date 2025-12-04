import crypto from 'crypto';
import { createHash } from 'crypto';

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}