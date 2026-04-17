interface StcEmailTemplateOptions {
  eyebrow: string;
  title: string;
  intro?: string;
  description: string;
  destinationEmail?: string;
  codeLabel?: string;
  codeValue?: string;
  actionLabel?: string;
  actionUrl?: string;
  stats?: Array<{ label: string; value: string }>;
  tips?: string[];
  supportTitle?: string;
  supportText: string;
  supportUrl?: string;
  footer: string;
}

function renderStats(stats: Array<{ label: string; value: string }>) {
  if (stats.length === 0) {
    return "";
  }

  const cells = stats
    .map(
      (item) => `
        <td style="width:${100 / stats.length}%;padding:0 6px 0 0;vertical-align:top;">
          <div style="border:1px solid #e6e7eb;border-radius:18px;background:#ffffff;padding:16px 18px;">
            <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">
              ${item.label}
            </div>
            <div style="margin-top:8px;font-size:18px;font-weight:700;line-height:1.3;color:#111827;">
              ${item.value}
            </div>
          </div>
        </td>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
      <tr>
        ${cells}
      </tr>
    </table>
  `;
}

function renderCodeBlock(label: string, value: string) {
  return `
    <div style="margin-top:22px;border:1px solid #e7e8ec;border-radius:24px;background:linear-gradient(180deg,#fffdfa 0%,#f8fafc 100%);padding:24px;text-align:center;">
      <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#8a6a12;">
        ${label}
      </div>
      <div style="margin-top:14px;border-radius:18px;background:#111111;padding:18px 12px;">
        <div style="font-size:40px;font-weight:800;letter-spacing:0.34em;color:#fed65b;">
          ${value}
        </div>
      </div>
    </div>
  `;
}

function renderDestinationInbox(email: string, description: string) {
  return `
    <div style="margin-top:18px;border:1px solid #e7e8ec;border-radius:22px;background:#ffffff;padding:18px 18px 16px;">
      <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#6b7280;">
        Destination Inbox
      </div>
      <div style="margin-top:12px;font-size:18px;font-weight:600;line-height:1.45;color:#111827;word-break:break-all;">
        ${email}
      </div>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">
        ${description}
      </p>
    </div>
  `;
}

function renderTips(tips: string[]) {
  if (tips.length === 0) {
    return "";
  }

  const cells = tips
    .slice(0, 2)
    .map(
      (tip) => `
        <td style="width:50%;padding:0 6px 0 0;vertical-align:top;">
          <div style="height:100%;border:1px dashed #e5d9b2;border-radius:20px;background:#fffdf8;padding:16px 16px 14px;">
            <div style="font-size:16px;line-height:1;color:#c9a227;">&#8226;</div>
            <p style="margin:10px 0 0;font-size:13px;line-height:1.8;color:#4b5563;">
              ${tip}
            </p>
          </div>
        </td>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
      <tr>
        ${cells}
      </tr>
    </table>
  `;
}

function renderActionButton(label: string, url: string) {
  return `
    <div style="margin-top:28px;">
      <a
        href="${url}"
        style="display:inline-block;border-radius:999px;background:#111827;padding:14px 26px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;"
      >
        ${label}
      </a>
    </div>
  `;
}

export function buildStcEmailTemplate({
  eyebrow,
  title,
  intro,
  description,
  destinationEmail,
  codeLabel,
  codeValue,
  actionLabel,
  actionUrl,
  stats = [],
  tips = [],
  supportTitle = "Need help?",
  supportText,
  supportUrl,
  footer,
}: StcEmailTemplateOptions) {
  return `
    <div style="margin:0;background:#f4f5f7;padding:32px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;">
              <tr>
                <td style="padding-bottom:18px;text-align:center;">
                  <div style="font-family:Georgia,Times New Roman,serif;font-size:28px;letter-spacing:-0.03em;color:#111827;">
                    STC Academy
                  </div>
                  <div style="margin-top:6px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#8a6a12;">
                    Academic Portal Mail
                  </div>
                </td>
              </tr>
              <tr>
                <td style="overflow:hidden;border:1px solid #e6e7eb;border-radius:28px;background:#ffffff;box-shadow:0 24px 50px rgba(17,24,39,0.08);">
                  <div style="background:linear-gradient(180deg,#fffefb 0%,#f7f9fc 100%);padding:20px;border-bottom:1px solid #eceef2;">
                    <div style="border:1px solid #eceef2;border-radius:24px;background:#fffdfa;">
                      <div style="padding:18px 20px;border-bottom:1px solid #eceef2;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td style="vertical-align:top;">
                              <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#8a6a12;">
                                ${eyebrow}
                              </div>
                              <h1 style="margin:12px 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:34px;font-weight:500;line-height:1.22;letter-spacing:-0.03em;color:#111827;">
                                ${title}
                              </h1>
                            </td>
                            <td align="right" style="vertical-align:top;">
                              <div style="display:inline-block;border:1px solid #9fe7c9;border-radius:999px;background:#effdf6;padding:10px 14px;font-size:11px;line-height:1.35;color:#1f9d69;">
                                Secure<br />delivery
                              </div>
                            </td>
                          </tr>
                        </table>
                      </div>

                      <div style="padding:18px 20px 20px;">
                        ${
                          intro
                            ? `<p style="margin:0 0 10px;font-size:16px;line-height:1.75;color:#374151;">${intro}</p>`
                            : ""
                        }
                        ${
                          destinationEmail
                            ? renderDestinationInbox(destinationEmail, description)
                            : `<p style="margin:0;font-size:16px;line-height:1.82;color:#4b5563;">${description}</p>`
                        }

                        ${codeLabel && codeValue ? renderCodeBlock(codeLabel, codeValue) : ""}
                        ${renderTips(tips)}
                        ${renderStats(stats)}
                        ${actionLabel && actionUrl ? renderActionButton(actionLabel, actionUrl) : ""}
                      </div>
                    </div>
                  </div>

                  <div style="padding:24px 28px 28px;">
                    ${
                      destinationEmail
                        ? `<p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">Use the most recent code from your inbox. If you requested another email, older codes stop working after resend.</p>`
                        : ""
                    }
                    <div style="margin-top:${destinationEmail ? "18px" : "0"};border-top:1px solid #eceef2;padding-top:20px;">
                      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a12;">
                        ${supportTitle}
                      </p>
                      <p style="margin:0;font-size:14px;line-height:1.8;color:#6b7280;">
                        ${supportText}
                      </p>
                      ${
                        supportUrl
                          ? `<p style="margin:12px 0 0;word-break:break-all;font-size:14px;line-height:1.8;color:#8a6a12;">${supportUrl}</p>`
                          : ""
                      }
                    </div>
                  </div>

                  <div style="padding:18px 28px;border-top:1px solid #eceef2;background:#fafafa;font-size:13px;line-height:1.7;color:#6b7280;">
                    ${footer}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
