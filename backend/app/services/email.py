"""Transactional email via SMTP (Gmail app password)."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Raised when an outbound email could not be sent."""


def _from_address() -> str:
    name = settings.SMTP_FROM_NAME.strip() or "Exam Coach"
    return f"{name} <{settings.SMTP_USER.strip()}>"


def send_password_reset_email(
    *,
    to_email: str,
    reset_token: str,
    full_name: str | None = None,
) -> None:
    if not settings.email_enabled:
        raise EmailDeliveryError("SMTP is not configured")

    reset_url = f"{settings.frontend_base_url}/reset-password?token={reset_token}"
    greeting = f"Hi {full_name}," if full_name else "Hi,"
    expire_minutes = settings.RESET_TOKEN_EXPIRE_MINUTES

    text_body = f"""{greeting}

We received a request to reset your Exam Coach password.

Open this link to choose a new password (expires in {expire_minutes} minutes):
{reset_url}

If you did not request this, you can safely ignore this email.

— Exam Coach
"""

    html_body = f"""<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">Exam Coach</p>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;">{greeting}</p>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;">
                  We received a request to reset your password. Click the button below to choose a new one.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 20px;">
                <a href="{reset_url}"
                   style="display:inline-block;background:#c8102e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">
                  Reset password
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 20px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  This link expires in {expire_minutes} minutes. If the button does not work, copy and paste this URL into your browser:
                </p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.5;word-break:break-all;color:#475569;">
                  {reset_url}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  If you did not request a password reset, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    message = MIMEMultipart("alternative")
    message["Subject"] = "Reset your Exam Coach password"
    message["From"] = _from_address()
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    smtp_user = settings.SMTP_USER.strip()
    # Google App Passwords are often copied with spaces; strip them for login.
    smtp_password = settings.SMTP_PASSWORD.replace(" ", "").strip()

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], message.as_string())
        logger.info("Password reset email sent to %s", to_email)
    except Exception as exc:
        logger.exception("Failed to send password reset email to %s", to_email)
        raise EmailDeliveryError("Could not send reset email") from exc
