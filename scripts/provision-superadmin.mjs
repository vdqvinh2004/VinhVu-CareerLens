import { randomBytes } from "node:crypto";

import argon2 from "argon2";
import * as OTPAuth from "otpauth";

const identifier = process.argv[2] || "meshmind-operations";
const password = randomBytes(24).toString("base64url");
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});
const secret = new OTPAuth.Secret({ size: 20 });
const totp = new OTPAuth.TOTP({
  issuer: "MeshMind",
  label: "Builtin Superadmin",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret,
});

console.log("Store these values in your secret manager. They are not saved by this script.");
console.log(`SUPERADMIN_IDENTIFIER=${identifier}`);
console.log(`SUPERADMIN_PASSWORD=${password}`);
console.log(`SUPERADMIN_PASSWORD_HASH=${passwordHash}`);
console.log(`SUPERADMIN_TOTP_SECRET=${secret.base32}`);
console.log(`TOTP_URI=${totp.toString()}`);
