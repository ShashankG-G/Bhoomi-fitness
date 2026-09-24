"""
FastAPI dependencies for member/staff bearer-token auth.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def _get_token_payload(creds: HTTPAuthorizationCredentials | None) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    payload = decode_access_token(creds.credentials)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return payload


def get_current_member(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Member:
    payload = _get_token_payload(creds)
    if payload.get("scope") != "member":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Member token required")
    member = db.get(models.Member, int(payload["sub"]))
    if member is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Member not found")
    return member


def get_current_staff(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.StaffUser:
    payload = _get_token_payload(creds)
    if payload.get("scope") != "staff":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff token required")
    staff = db.get(models.StaffUser, int(payload["sub"]))
    if staff is None or not staff.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Staff account not found or inactive")
    return staff
