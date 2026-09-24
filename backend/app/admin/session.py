"""
Admin session cookie signing. Deliberately separate from the member/staff JWT
machinery — this is the master-key-gated, server-rendered panel, and it must
never share a secret or a code path with the public JSON API's auth.
"""
from fastapi import Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

ADMIN_COOKIE_NAME = "bhoomi_admin_session"
ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60  # 12 hours

_serializer = URLSafeTimedSerializer(settings.ADMIN_SESSION_SECRET, salt="bhoomi-admin-panel")


class AdminAuthRequired(Exception):
    """Raised by admin routes when there's no valid session cookie. Caught by
    a dedicated exception handler in main.py which redirects to /admin."""


def sign_session() -> str:
    return _serializer.dumps({"admin": True})


def verify_session_cookie(cookie_value: str | None) -> bool:
    if not cookie_value:
        return False
    try:
        data = _serializer.loads(cookie_value, max_age=ADMIN_SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return False
    return bool(isinstance(data, dict) and data.get("admin") is True)


def require_admin(request: Request) -> None:
    """Dependency: raises AdminAuthRequired (-> redirect to /admin) if the
    request doesn't carry a valid admin session cookie."""
    cookie_value = request.cookies.get(ADMIN_COOKIE_NAME)
    if not verify_session_cookie(cookie_value):
        raise AdminAuthRequired()
