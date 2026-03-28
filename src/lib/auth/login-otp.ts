import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const LOGIN_OTP_COOKIE = "stc_login_otp";
const LOGIN_OTP_EXPIRY_MINUTES = 10;

export interface PendingLoginPayload {
  email: string;
  expiresAt: number;
}

function getSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error("Missing server secret for login OTP encryption");
  }

  return createHash("sha256").update(secret).digest();
}

export function buildPendingLogin(email: string): PendingLoginPayload {
  return {
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000,
  };
}

export function encryptPendingLogin(payload: PendingLoginPayload) {
  const iv = randomBytes(12);
  const key = getSecret();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptPendingLogin(token: string): PendingLoginPayload | null {
  try {
    const [ivPart, tagPart, ciphertextPart] = token.split(".");

    if (!ivPart || !tagPart || !ciphertextPart) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSecret(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plaintext) as PendingLoginPayload;
  } catch {
    return null;
  }
}

export function isLoginOtpExpired(expiresAt: number) {
  return Date.now() > expiresAt;
}

export function getLoginOtpCookieOptions(maxAgeSeconds = LOGIN_OTP_EXPIRY_MINUTES * 60) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export { LOGIN_OTP_COOKIE, LOGIN_OTP_EXPIRY_MINUTES };
