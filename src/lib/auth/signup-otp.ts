import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

const SIGNUP_OTP_COOKIE = "stc_signup_otp";
const OTP_EXPIRY_MINUTES = 10;

export interface PendingSignupPayload {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  otp: string;
  expiresAt: number;
}

function getSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error("Missing server secret for signup OTP encryption");
  }

  return createHash("sha256").update(secret).digest();
}

export function createOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function encryptPendingSignup(payload: PendingSignupPayload) {
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

export function decryptPendingSignup(token: string): PendingSignupPayload | null {
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

    return JSON.parse(plaintext) as PendingSignupPayload;
  } catch {
    return null;
  }
}

export function isOtpExpired(expiresAt: number) {
  return Date.now() > expiresAt;
}

export function buildPendingSignup(input: {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}) {
  return {
    ...input,
    email: input.email.trim().toLowerCase(),
    otp: createOtpCode(),
    expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  };
}

export function otpMatches(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function getSignupOtpCookieOptions(maxAgeSeconds = OTP_EXPIRY_MINUTES * 60) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export { OTP_EXPIRY_MINUTES, SIGNUP_OTP_COOKIE };
