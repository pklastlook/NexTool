/**
 * Responsive HTML email templates (Prompt2 §77).
 *
 * Pure functions — input is the URL/body, output is a self-contained
 * responsive HTML string suitable for both SMTP and Resend. Inline styles only
 * (email client compatibility). No external CSS, no remote images.
 */

const SHELL = (title: string, bodyHtml: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-Content-Type-Options" content="nosniff" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:28px 32px;background:#18181b;color:#fafafa;">
              <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">NexTool</div>
              <div style="font-size:12px;color:#a1a1aa;margin-top:2px;">Premium online tools platform</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:#18181b;font-weight:600;">${escapeHtml(title)}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
                You received this email because you have an account on NexTool.
                If you did not request this action, you can safely ignore this email.
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#a1a1aa;">
                &copy; ${new Date().getFullYear()} NexTool. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build a verification email body. The URL is the absolute verification
 * link that the front-end (or auth route) generates.
 */
export function verificationEmail(url: string): string {
  const safe = escapeHtml(url);
  return SHELL(
    "Verify your email address",
    `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
       Welcome to NexTool. Please confirm your email address to activate your account.
     </p>
     <p style="margin:24px 0;text-align:center;">
       <a href="${safe}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">
         Verify email
       </a>
     </p>
     <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
       Or paste this link into your browser:<br />
       <span style="word-break:break-all;color:#4f46e5;">${safe}</span>
     </p>
     <p style="margin:16px 0 0 0;font-size:12px;color:#a1a1aa;">
       This link expires in 24 hours. If you did not sign up, you can ignore this email.
     </p>`
  );
}

/** Build a password-reset email body. */
export function passwordResetEmail(url: string): string {
  const safe = escapeHtml(url);
  return SHELL(
    "Reset your password",
    `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
       We received a request to reset your NexTool password.
     </p>
     <p style="margin:24px 0;text-align:center;">
       <a href="${safe}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">
         Reset password
       </a>
     </p>
     <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
       Or paste this link into your browser:<br />
       <span style="word-break:break-all;color:#4f46e5;">${safe}</span>
     </p>
     <p style="margin:16px 0 0 0;font-size:12px;color:#a1a1aa;">
       This link expires in 1 hour. If you did not request a password reset, your account is safe — no changes have been made.
     </p>`
  );
}

/** Build a generic security notification email body. */
export function securityNotificationEmail(subject: string, body: string): string {
  const paragraphs = escapeHtml(body).split(/\n{2,}/).map(
    (p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#3f3f46;white-space:pre-wrap;">${p}</p>`
  ).join("");
  return SHELL(
    subject,
    `<div style="padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:0 0 20px 0;">
       <p style="margin:0;font-size:13px;font-weight:600;color:#b91c1c;">Security notice</p>
     </div>
     ${paragraphs}`
  );
}

/** Build a billing receipt / invoice / subscription notice email body. */
export function billingEmail(subject: string, body: string): string {
  const paragraphs = escapeHtml(body).split(/\n{2,}/).map(
    (p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#3f3f46;white-space:pre-wrap;">${p}</p>`
  ).join("");
  return SHELL(
    subject,
    `<div style="padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:0 0 20px 0;">
       <p style="margin:0;font-size:13px;font-weight:600;color:#15803d;">Billing update</p>
     </div>
     ${paragraphs}`
  );
}

/** Build an API notification email body (key rotation, quota, webhook failure). */
export function apiNotificationEmail(subject: string, body: string): string {
  const paragraphs = escapeHtml(body).split(/\n{2,}/).map(
    (p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#3f3f46;white-space:pre-wrap;">${p}</p>`
  ).join("");
  return SHELL(
    subject,
    `<div style="padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:0 0 20px 0;">
       <p style="margin:0;font-size:13px;font-weight:600;color:#1d4ed8;">Developer notification</p>
     </div>
     ${paragraphs}`
  );
}
