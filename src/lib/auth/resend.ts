const RESEND_TESTING_RESTRICTION =
  "You can only send testing emails to your own email address";

export function isResendTestingRestriction(message: string | null | undefined) {
  return Boolean(message?.includes(RESEND_TESTING_RESTRICTION));
}

export function canBypassResendInDevelopment() {
  return process.env.NODE_ENV !== "production";
}

export function getResendFromEmail() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  return from;
}
