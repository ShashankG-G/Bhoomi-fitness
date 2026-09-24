import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas, security
from app.database import get_db
from app.deps import get_current_staff

router = APIRouter(prefix="/api/entry", tags=["entry"])
logger = logging.getLogger("bhoomi.entry")


def _log(
    db: Session,
    *,
    member: models.Member | None,
    identifier_used: str | None,
    success: bool,
    reason: str,
    window: int | None,
) -> None:
    entry = models.EntryLog(
        member_id=member.id if member else None,
        identifier_used=identifier_used,
        success=success,
        reason=reason,
        window=window,
    )
    db.add(entry)
    db.commit()
    logger.info(
        "entry attempt member_id=%s success=%s reason=%s window=%s",
        member.id if member else None,
        success,
        reason,
        window,
    )


@router.post("/verify", response_model=schemas.EntryVerifyOut)
def verify_entry(
    body: schemas.EntryVerifyIn,
    db: Session = Depends(get_db),
    _staff: models.StaffUser = Depends(get_current_staff),
):
    member: models.Member | None = None
    code: str | None = None
    identifier_used: str | None = body.identifier

    if body.payload:
        decoded = security.decode_qr_payload(body.payload)
        if decoded is None:
            _log(db, member=None, identifier_used=None, success=False, reason="invalid", window=None)
            return schemas.EntryVerifyOut(allow=False, member=None, reason="invalid")
        member = db.get(models.Member, decoded.get("m"))
        code = decoded.get("c")
    elif body.code and body.identifier:
        identifier = body.identifier.strip().lower()
        identifier_used = identifier
        member = db.query(models.Member).filter(models.Member.identifier == identifier).first()
        code = body.code.strip()
    else:
        _log(db, member=None, identifier_used=identifier_used, success=False, reason="invalid", window=None)
        return schemas.EntryVerifyOut(allow=False, member=None, reason="invalid")

    if member is None:
        _log(db, member=None, identifier_used=identifier_used, success=False, reason="not_found", window=None)
        return schemas.EntryVerifyOut(allow=False, member=None, reason="not_found")

    member_out = schemas.EntryMemberOut(name=member.name, has_active_membership=member.has_active_membership)

    matched_window = security.verify_totp_current_or_previous(member.qr_secret, code or "")

    if matched_window is None:
        _log(db, member=member, identifier_used=identifier_used, success=False, reason="invalid", window=None)
        return schemas.EntryVerifyOut(allow=False, member=member_out, reason="invalid")

    # Replay protection: this exact window was already used for a successful entry.
    if member.last_entry_window is not None and matched_window <= member.last_entry_window:
        _log(
            db,
            member=member,
            identifier_used=identifier_used,
            success=False,
            reason="expired",
            window=matched_window,
        )
        return schemas.EntryVerifyOut(allow=False, member=member_out, reason="expired")

    if not member.has_active_membership:
        _log(
            db,
            member=member,
            identifier_used=identifier_used,
            success=False,
            reason="no_membership",
            window=matched_window,
        )
        return schemas.EntryVerifyOut(allow=False, member=member_out, reason="no_membership")

    member.last_entry_window = matched_window
    db.commit()

    _log(db, member=member, identifier_used=identifier_used, success=True, reason="ok", window=matched_window)
    return schemas.EntryVerifyOut(allow=True, member=member_out, reason="ok")
