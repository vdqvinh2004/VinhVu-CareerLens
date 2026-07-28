import { createHash, createHmac, randomBytes } from "node:crypto";

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function hmacSha256(value: string, secret: Buffer) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
