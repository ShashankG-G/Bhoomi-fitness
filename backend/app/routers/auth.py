import datetime
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas, security
from app.config import settings
from app.database import get_db
from app.deps import get_current_member
from app.notifications import send_code

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("bhoomi.auth")

MAX_OTP_ATTEMPTS = 5


def _normalize_identifier(identifier: str) -> str:
    return identifier.strip().lower()


@router.post("/request-code", response_model=schemas.RequestCodeOut, response_model_exclude_none=True)
def request_code(body: schemas.RequestCodeIn, db: Session = Depends(get_db)):
    identifier = _normalize_identifier(body.identifier)
    if not identifier:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "identifier is required")

    code = security.generate_otp()
    code_hash = security.hash_otp(code, identifier)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=settings.OTP_EXPIRE_MINUTES
    )

    otp = models.OTPCode(identifier=identifier, code_hash=code_hash, expires_at=expires_at)
    db.add(otp)
    db.commit()

    send_code(identifier, code)

    response = schemas.RequestCodeOut(message="code sent")
    if settings.is_development:
        response.dev_code = code
    return response


@router.post("/verify-code", response_model=schemas.VerifyCodeOut)
def verify_code(body: schemas.VerifyCodeIn, db: Session = Depends(get_db)):
    identifier = _normalize_identifier(body.identifier)
    code = body.code.strip()

    otp = (
        db.query(models.OTPCode)
        .filter(models.OTPCode.identifier == identifier, models.OTPCode.consumed.is_(False))
        .order_by(models.OTPCode.created_at.desc())
        .first()
    )

    if otp is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active code for this identifier. Request a new one.")

    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = otp.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)

    if now > expires_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code expired. Request a new one.")

    if otp.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Request a new code.")

    if not security.verify_otp_hash(code, identifier, otp.code_hash):
        otp.attempts += 1
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect code")

    otp.consumed = True

    member = db.query(models.Member).filter(models.Member.identifier == identifier).first()
    if member is None:
        member = models.Member(identifier=identifier, qr_secret=security.new_qr_secret())
        db.add(member)

    db.commit()
    db.refresh(member)

    token = security.create_access_token(
        subject=member.id, scope="member", expires_minutes=settings.JWT_EXPIRE_MINUTES_MEMBER
    )

    return schemas.VerifyCodeOut(
        access_token=token,
        member=schemas.MemberOut(
            id=member.id,
            name=member.name,
            identifier=member.identifier,
            has_active_membership=member.has_active_membership,
        ),
    )


@router.get("/me", response_model=schemas.MemberOut)
def get_me(member: models.Member = Depends(get_current_member)):
    return schemas.MemberOut(
        id=member.id,
        name=member.name,
        identifier=member.identifier,
        has_active_membership=member.has_active_membership,
    )


@router.patch("/me", response_model=schemas.MemberOut)
def update_me(
    body: schemas.MemberUpdateIn,
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    member.name = body.name.strip()
    db.commit()
    db.refresh(member)
    return schemas.MemberOut(
        id=member.id,
        name=member.name,
        identifier=member.identifier,
        has_active_membership=member.has_active_membership,
    )


@router.get("/qr-payload", response_model=schemas.QRPayloadOut)
def qr_payload(member: models.Member = Depends(get_current_member)):
    now = int(time.time())
    window = security.current_window(now)
    code = security.totp_code_for_window(member.qr_secret, window)
    payload = security.make_qr_payload(member.id, code, now)
    return schemas.QRPayloadOut(payload=payload, code=code, expires_in=settings.TOTP_INTERVAL_SECONDS)
