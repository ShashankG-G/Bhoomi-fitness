"""
OTP delivery. This is a stub: it logs the code (always, so staff can read it
off server logs during the soft launch) and additionally sends a real email
via smtplib if SMTP_* env vars are configured.

TODO(shashank): plug in a real SMS provider (e.g. MSG91, Twilio) here for the
phone-identifier case. Right now phone identifiers only ever get the code via
server logs / dev_code, matching the SPEC's "soft launch, staff hands out the
phone-based flow" note.
"""
import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger("bhoomi.otp")


def _looks_like_email(identifier: str) -> bool:
    return "@" in identifier and "." in identifier.split("@")[-1]


def send_code(identifier: str, code: str) -> None:
    # Always log — this is the fallback delivery channel for the soft launch,
    # and useful for debugging even once real SMTP/SMS is wired up.
    logger.info("OTP code for %s: %s (expires in %s min)", identifier, code, settings.OTP_EXPIRE_MINUTES)

    if not settings.smtp_configured:
        return

    if not _looks_like_email(identifier):
        # No SMS provider wired up yet — see TODO above.
        return

    try:
        msg = MIMEText(
            f"Your Bhoomi Fitness login code is {code}. It expires in "
            f"{settings.OTP_EXPIRE_MINUTES} minutes. If you didn't request this, ignore this email."
        )
        msg["Subject"] = "Your Bhoomi Fitness login code"
        msg["From"] = settings.SMTP_FROM
        msg["To"] = identifier

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [identifier], msg.as_string())
        logger.info("OTP email sent to %s via SMTP", identifier)
    except Exception:
        logger.exception("Failed to send OTP email to %s; code was still logged above", identifier)
