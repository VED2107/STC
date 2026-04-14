const WHATSAPP_API_VERSION = "v21.0";

interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

async function sendAttendanceMessage(
  parentPhone: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return {
      success: false,
      error:
        "WhatsApp API not configured (missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID)",
    };
  }

  const to = normalizePhone(parentPhone);
  if (to.length < 10) {
    return { success: false, error: `Invalid phone number: ${parentPhone}` };
  }

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
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp] Send failed:", message);
    return { success: false, error: message };
  }
}

export async function sendCheckInMessage(
  parentPhone: string,
  studentName: string,
  checkInTime: string,
): Promise<WhatsAppSendResult> {
  const inDate = new Date(checkInTime);
  const body = [
    `*${studentName}* has checked in to tuition.`,
    "",
    `Check-in: ${formatTime(inDate)}`,
    "",
    "- STC Tuition Centre",
  ].join("\n");

  return sendAttendanceMessage(parentPhone, body);
}

export async function sendCheckoutMessage(
  parentPhone: string,
  studentName: string,
  checkInTime: string,
  checkOutTime: string,
): Promise<WhatsAppSendResult> {
  const inDate = new Date(checkInTime);
  const outDate = new Date(checkOutTime);
  const diffMs = outDate.getTime() - inDate.getTime();
  const diffMins = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const body = [
    `*${studentName}* has checked out from tuition.`,
    "",
    `Check-in: ${formatTime(inDate)}`,
    `Check-out: ${formatTime(outDate)}`,
    `Duration: ${duration}`,
    "",
    "- STC Tuition Centre",
  ].join("\n");

  return sendAttendanceMessage(parentPhone, body);
}
