"""
Centralized environment/config loading for the Bhoomi Fitness backend.

Every environment variable the app reads is defined here, with a sane
local-dev default where one makes sense. See .env.example for a documented
list of everything an operator needs to set in production (Render).
"""
import os

from dotenv import load_dotenv

# Load a local .env file if present (no-op in prod where Render injects
# real env vars directly).
load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings:
    # --- Database -----------------------------------------------------
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bhoomi.db")

    # --- Auth / secrets -------------------------------------------------
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-insecure-jwt-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES_MEMBER: int = int(os.getenv("JWT_EXPIRE_MINUTES_MEMBER", "43200"))  # 30 days
    JWT_EXPIRE_MINUTES_STAFF: int = int(os.getenv("JWT_EXPIRE_MINUTES_STAFF", "720"))  # 12 hours

    # The hidden master-admin key. Never logged, never returned in any
    # response, never exposed to a member/staff-facing endpoint.
    MASTER_KEY: str = os.getenv("MASTER_KEY", "dev-insecure-master-key-change-me")

    # A separate secret for signing the admin session cookie. Falls back to
    # deriving from JWT_SECRET if not explicitly set, but a real deployment
    # should set its own.
    ADMIN_SESSION_SECRET: str = os.getenv("ADMIN_SESSION_SECRET", None) or (
        "admin-session-" + os.getenv("JWT_SECRET", "dev-insecure-jwt-secret-change-me")
    )

    # --- App mode ---------------------------------------------------------
    BACKEND_ENV: str = os.getenv("BACKEND_ENV", "development")

    @property
    def is_development(self) -> bool:
        return self.BACKEND_ENV.lower() != "production"

    # --- CORS ---------------------------------------------------------
    CORS_ORIGINS: list[str] = _split_csv(
        os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174")
    )

    # --- OTP ------------------------------------------------------------
    OTP_LENGTH: int = 5
    OTP_EXPIRE_MINUTES: int = 10

    # --- Rotating QR / TOTP entry -----------------------------------------
    TOTP_DIGITS: int = 5
    TOTP_INTERVAL_SECONDS: int = 30

    # --- Optional SMTP for real OTP delivery -------------------------------
    SMTP_HOST: str | None = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str | None = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: str | None = os.getenv("SMTP_PASSWORD")
    SMTP_FROM: str | None = os.getenv("SMTP_FROM")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USERNAME and self.SMTP_PASSWORD and self.SMTP_FROM)


settings = Settings()
