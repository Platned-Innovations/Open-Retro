import { randomBytes, createHash } from "crypto";

/**
 * Magic-link / invitation tokens: we only ever store a SHA-256 hash of the
 * token in the DB, so a DB leak alone can't be used to log in as anyone.
 * The raw token only ever exists in the URL we email out and in-memory here.
 */

export const LOGIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
