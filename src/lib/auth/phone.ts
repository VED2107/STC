const INDIA_COUNTRY_CODE = "91";

export function normalizePhoneLookup(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith(INDIA_COUNTRY_CODE) && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `${INDIA_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

export function normalizeAuthPhone(phone: string): string {
  const normalized = normalizePhoneLookup(phone);
  return normalized ? `+${normalized}` : "";
}
