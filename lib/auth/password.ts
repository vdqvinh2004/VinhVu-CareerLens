import "server-only";

import argon2 from "argon2";

const PASSWORD_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyHashPromise: Promise<string> | undefined;

export function hashPassword(password: string) {
  return argon2.hash(password, PASSWORD_OPTIONS);
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function performDummyPasswordVerification(password: string) {
  dummyHashPromise ??= hashPassword("MeshMind timing equalization value");
  const dummyHash = await dummyHashPromise;
  await verifyPassword(dummyHash, password);
}

export function passwordNeedsRehash(hash: string) {
  try {
    return argon2.needsRehash(hash, PASSWORD_OPTIONS);
  } catch {
    return true;
  }
}
