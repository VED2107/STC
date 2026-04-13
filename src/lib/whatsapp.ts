/**
 * WhatsApp Cloud API utility for sending checkout notifications.
 *
 * Uses the Meta Cloud API (v21.0). Requires:
 *   - WHATSAPP_API_TOKEN (system user access token)
 *   - WHATSAPP_PHONE_NUMBER_ID (business phone number ID)
 *
 * Falls back gracefully — a missing config or API error will NOT
 * block the attendance flow; it only logs the failure.
 */

const WHATSAPP_API_VERSION = "v21.0";

interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format a phone number for WhatsApp API (must include country code, no +).
 * Assumes Indian numbers if no country code is present.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Send a checkout notification to a parent via WhatsApp.
 *
 * Message: plain text with student name, check-in time, check-out time,
 * and total duration. Uses a text message (not a template) for simplicity.
 *
 * For production, you'd switch to an approved message template.
 */
export async function sendCheckoutMessage(
  parentPhone: string,
  studentName: string,
  checkInTime: string,
  checkOutTime: string,
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return {
      success: false,
      error: "WhatsApp API not configured (missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID)",
    };
  }

  const to = normalizePhone(parentPhone);
  if (to.length < 10) {
    return { success: false, error: `Invalid phone number: ${parentPhone}` };
  }

  // Calculate duration
  const inDate = new Date(checkInTime);
  const outDate = new Date(checkOutTime);
  const diffMs = outDate.getTime() - inDate.getTime();
  const diffMins = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

  const body = [
    `✅ *${studentName}* has checked out from tuition.`,
    ``,
    `📥 Check-in: ${formatTime(inDate)}`,
    `📤 Check-out: ${formatTime(outDate)}`,
    `⏱ Duration: ${duration}`,
    ``,
    `— STC Tuition Centre`,
  ].join("\n");

  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[WhatsApp] API error:", res.status, errBody);
      return { success: false, error: `API ${res.status}: ${errBody}` };
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    const messageId = data.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp] Send failed:", message);
    return { success: false, error: message };
  }
}
