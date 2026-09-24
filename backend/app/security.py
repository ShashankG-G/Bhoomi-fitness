"""
Security primitives: JWT issuing/verification, OTP hashing, staff password
hashing, and the rotating-QR TOTP helpers.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import pyotp
from jose import JWTError, jwt

from app.config import settings

# ---------------------------------------------------------------------------
# JWT (member + staff bearer tokens)
# ---------------------------------------------------------------------------


def create_access_token(*, subject: int, scope: Literal["member", "staff"], expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "scope": scope,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# OTP codes (member login)
# ---------------------------------------------------------------------------


def generate_otp(length: int = settings.OTP_LENGTH) -> str:
    """Cryptographically random numeric code, e.g. '04821'. Zero-padded so
    length is always exact."""
    upper = 10**length
    return f"{secrets.randbelow(upper):0{length}d}"


def hash_otp(code: str, identifier: str) -> str:
    """HMAC the code with the JWT secret as a pepper + the identifier as
    context, so the DB never stores a usable plaintext or a bare hash that's
    guessable via a rainbow table of 5-digit codes without the pepper."""
    key = settings.JWT_SECRET.encode()
    msg = f"{identifier}:{code}".encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_otp_hash(code: str, identifier: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(code, identifier), code_hash)


# ---------------------------------------------------------------------------
# Staff password hashing
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Rotating QR / TOTP entry
# ---------------------------------------------------------------------------


def new_qr_secret() -> str:
    return pyotp.random_base32()


def _totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret, digits=settings.TOTP_DIGITS, interval=settings.TOTP_INTERVAL_SECONDS)


def current_window(for_time: float | None = None) -> int:
    t = for_time if for_time is not None else time.time()
    return int(t // settings.TOTP_INTERVAL_SECONDS)


def totp_code_for_window(secret: str, window: int) -> str:
    for_time = window * settings.TOTP_INTERVAL_SECONDS
    return _totp(secret).at(for_time)


def make_qr_payload(member_id: int, code: str, issued_at: int) -> str:
    """Opaque base64-encoded JSON blob: member id + TOTP code + issued-at."""
    raw = json.dumps({"m": member_id, "c": code, "t": issued_at}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_qr_payload(payload: str) -> dict[str, Any] | None:
    try:
        raw = base64.urlsafe_b64decode(payload.encode())
        data = json.loads(raw)
        if not isinstance(data, dict) or "m" not in data or "c" not in data:
            return None
        return data
    except Exception:
        return None


def verify_totp_current_or_previous(secret: str, code: str) -> int | None:
    """Checks `code` against the TOTP for the current window and the one
    immediately before it (tolerates clock drift / network latency between
    the member's phone generating the code and staff scanning it).

    Returns the matched window number, or None if it doesn't match either.
    """
    now_window = current_window()
    for w in (now_window, now_window - 1):
        expected = totp_code_for_window(secret, w)
        if hmac.compare_digest(expected, code):
            return w
    return None
