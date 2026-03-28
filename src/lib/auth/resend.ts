const RESEND_TESTING_RESTRICTION =
  "You can only send testing emails to your own email address";

export function isResendTestingRestriction(message: string | null | undefined) {
  return Boolean(message?.includes(RESEND_TESTING_RESTRICTION));
}

export function canBypassResendInDevelopment() {
  return process.env.NODE_ENV !== "production";
}
