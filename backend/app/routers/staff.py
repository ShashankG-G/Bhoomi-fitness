import csv
import datetime
import io
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas, security
from app.config import settings
from app.database import get_db
from app.deps import get_current_staff, require_role
from app.notifications import send_code

router = APIRouter(prefix="/api/staff", tags=["staff"])
logger = logging.getLogger("bhoomi.staff")

MAX_OTP_ATTEMPTS = 5


def _normalize_identifier(identifier: str) -> str:
    return identifier.strip().lower()


def _staff_out(staff: models.StaffUser) -> schemas.StaffOut:
    return schemas.StaffOut(id=staff.id, name=staff.full_name, identifier=staff.identifier, role=staff.role)


# ---------------------------------------------------------------------------
# Staff auth — phone/email + one-time code, same flow as members. Accounts
# are created only from the hidden /admin panel (master key) — there is no
# self-signup endpoint here, so verify-code 404s for a number the owner
# hasn't registered yet.
# ---------------------------------------------------------------------------


@router.post("/request-code", response_model=schemas.StaffRequestCodeOut, response_model_exclude_none=True)
def request_code(body: schemas.StaffRequestCodeIn, db: Session = Depends(get_db)):
    identifier = _normalize_identifier(body.identifier)
    if not identifier:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "identifier is required")

    staff = db.query(models.StaffUser).filter(models.StaffUser.identifier == identifier).first()
    if staff is None or not staff.active:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No staff account found for this number. Ask the gym owner to add you from the admin panel.",
        )

    code = security.generate_otp()
    code_hash = security.hash_otp(code, identifier)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=settings.OTP_EXPIRE_MINUTES
    )

    otp = models.OTPCode(identifier=identifier, code_hash=code_hash, expires_at=expires_at)
    db.add(otp)
    db.commit()

    send_code(identifier, code)

    response = schemas.StaffRequestCodeOut(message="code sent")
    if settings.is_development:
        response.dev_code = code
    return response


@router.post("/verify-code", response_model=schemas.StaffVerifyCodeOut)
def verify_code(body: schemas.StaffVerifyCodeIn, db: Session = Depends(get_db)):
    identifier = _normalize_identifier(body.identifier)
    code = body.code.strip()

    staff = db.query(models.StaffUser).filter(models.StaffUser.identifier == identifier).first()
    if staff is None or not staff.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staff account found for this number")

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
    db.commit()

    token = security.create_access_token(
        subject=staff.id, scope="staff", expires_minutes=settings.JWT_EXPIRE_MINUTES_STAFF
    )

    return schemas.StaffVerifyCodeOut(access_token=token, staff=_staff_out(staff))


@router.get("/me", response_model=schemas.StaffOut)
def get_me(staff: models.StaffUser = Depends(get_current_staff)):
    return _staff_out(staff)


# ---------------------------------------------------------------------------
# Members / memberships (all staff roles)
# ---------------------------------------------------------------------------


@router.get("/members", response_model=list[schemas.StaffMemberOut])
def search_members(
    query: str = Query("", alias="query"),
    _staff: models.StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    q = db.query(models.Member)
    if query.strip():
        like = f"%{query.strip()}%"
        q = q.filter(or_(models.Member.identifier.ilike(like), models.Member.name.ilike(like)))
    members = q.order_by(models.Member.created_at.desc()).limit(50).all()
    return [
        schemas.StaffMemberOut(
            id=m.id,
            name=m.name,
            identifier=m.identifier,
            has_active_membership=m.has_active_membership,
            membership_plan=m.membership_plan,
            membership_valid_until=m.membership_valid_until,
        )
        for m in members
    ]


@router.post("/members/{member_id}/activate-membership", response_model=schemas.StaffMemberOut)
def activate_membership(
    member_id: int,
    body: schemas.ActivateMembershipIn,
    staff: models.StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    member = db.get(models.Member, member_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    member.has_active_membership = True
    member.membership_plan = body.plan
    member.membership_valid_until = body.valid_until
    member.membership_payment_method = body.payment_method
    db.add(member)

    db.add(
        models.MembershipTransaction(
            member_id=member.id,
            plan=body.plan,
            amount_inr=body.amount_inr,
            payment_method=body.payment_method,
            recorded_by_staff_id=staff.id,
        )
    )

    db.commit()
    db.refresh(member)

    return schemas.StaffMemberOut(
        id=member.id,
        name=member.name,
        identifier=member.identifier,
        has_active_membership=member.has_active_membership,
        membership_plan=member.membership_plan,
        membership_valid_until=member.membership_valid_until,
    )


# ---------------------------------------------------------------------------
# Cafeteria (all staff roles)
# ---------------------------------------------------------------------------


@router.get("/cafeteria/orders", response_model=list[schemas.OrderOut])
def list_cafeteria_orders(
    status_filter: str | None = Query(None, alias="status"),
    _staff: models.StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    q = db.query(models.CafeteriaOrder).options(
        joinedload(models.CafeteriaOrder.items).joinedload(models.CafeteriaOrderItem.menu_item)
    )
    if status_filter:
        q = q.filter(models.CafeteriaOrder.status == status_filter)
    orders = q.order_by(models.CafeteriaOrder.created_at.asc()).all()

    return [
        schemas.OrderOut(
            id=o.id,
            status=o.status,
            total_inr=float(o.total_inr),
            notes=o.notes,
            created_at=o.created_at,
            items=[
                schemas.OrderItemOut(
                    menu_item_id=item.menu_item_id,
                    name=item.menu_item.name,
                    qty=item.qty,
                    price_inr_each=float(item.price_inr_each),
                )
                for item in o.items
            ],
        )
        for o in orders
    ]


@router.patch("/cafeteria/orders/{order_id}", response_model=schemas.OrderStatusOut)
def update_order_status(
    order_id: int,
    body: schemas.StaffOrderStatusUpdateIn,
    _staff: models.StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    order = db.get(models.CafeteriaOrder, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    order.status = body.status
    db.commit()
    db.refresh(order)
    return schemas.OrderStatusOut(status=order.status)


# ---------------------------------------------------------------------------
# Reports — attendance (any active staff), financial + overall (super admin
# only: head_trainer / owner).
# ---------------------------------------------------------------------------


def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/attendance")
def attendance_report(
    date: datetime.date | None = Query(None),
    _staff: models.StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """Everyone who successfully entered the gym on `date` (defaults to
    today) — for reception's day-to-day attendance report."""
    date = date or datetime.datetime.now(datetime.timezone.utc).date()
    day_start = datetime.datetime.combine(date, datetime.time.min, tzinfo=datetime.timezone.utc)
    day_end = day_start + datetime.timedelta(days=1)

    entries = (
        db.query(models.EntryLog)
        .options(joinedload(models.EntryLog.member))
        .filter(
            models.EntryLog.success.is_(True),
            models.EntryLog.created_at >= day_start,
            models.EntryLog.created_at < day_end,
        )
        .order_by(models.EntryLog.created_at.asc())
        .all()
    )

    rows = [
        [
            e.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            (e.member.name if e.member and e.member.name else "—"),
            (e.member.identifier if e.member else e.identifier_used or "—"),
        ]
        for e in entries
    ]
    return _csv_response(
        rows,
        header=["Time", "Member name", "Phone/Email"],
        filename=f"attendance-{date.isoformat()}.csv",
    )


def _financial_summary(db: Session, range_start: datetime.date, range_end: datetime.date) -> schemas.FinancialSummaryOut:
    start_dt = datetime.datetime.combine(range_start, datetime.time.min, tzinfo=datetime.timezone.utc)
    end_dt = datetime.datetime.combine(range_end, datetime.time.max, tzinfo=datetime.timezone.utc)

    membership_txns = (
        db.query(models.MembershipTransaction)
        .filter(models.MembershipTransaction.created_at >= start_dt, models.MembershipTransaction.created_at <= end_dt)
        .all()
    )
    cafeteria_orders = (
        db.query(models.CafeteriaOrder)
        .filter(models.CafeteriaOrder.created_at >= start_dt, models.CafeteriaOrder.created_at <= end_dt)
        .all()
    )
    entries_in_range = (
        db.query(models.EntryLog)
        .filter(
            models.EntryLog.success.is_(True),
            models.EntryLog.created_at >= start_dt,
            models.EntryLog.created_at <= end_dt,
        )
        .count()
    )

    membership_revenue = sum(float(t.amount_inr) for t in membership_txns)
    cafeteria_revenue = sum(float(o.total_inr) for o in cafeteria_orders)
    total_members = db.query(models.Member).count()
    active_members = db.query(models.Member).filter(models.Member.has_active_membership.is_(True)).count()

    return schemas.FinancialSummaryOut(
        range_start=range_start,
        range_end=range_end,
        membership_revenue_inr=membership_revenue,
        membership_transaction_count=len(membership_txns),
        cafeteria_revenue_inr=cafeteria_revenue,
        cafeteria_order_count=len(cafeteria_orders),
        total_revenue_inr=membership_revenue + cafeteria_revenue,
        total_members=total_members,
        active_members=active_members,
        entries_in_range=entries_in_range,
    )


def _default_range() -> tuple[datetime.date, datetime.date]:
    today = datetime.datetime.now(datetime.timezone.utc).date()
    return today.replace(day=1), today


@router.get("/super-admin/staff", response_model=list[schemas.SuperAdminStaffOut])
def super_admin_list_staff(
    _staff: models.StaffUser = Depends(require_role(*models.SUPER_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    staff_rows = db.query(models.StaffUser).order_by(models.StaffUser.created_at.asc()).all()
    return [
        schemas.SuperAdminStaffOut(
            id=s.id, name=s.full_name, identifier=s.identifier, role=s.role, active=s.active, created_at=s.created_at
        )
        for s in staff_rows
    ]


@router.get("/super-admin/financial-summary", response_model=schemas.FinancialSummaryOut)
def super_admin_financial_summary(
    start: datetime.date | None = Query(None),
    end: datetime.date | None = Query(None),
    _staff: models.StaffUser = Depends(require_role(*models.SUPER_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    default_start, default_end = _default_range()
    return _financial_summary(db, start or default_start, end or default_end)


@router.get("/super-admin/transactions", response_model=list[schemas.SuperAdminTransactionOut])
def super_admin_transactions(
    start: datetime.date | None = Query(None),
    end: datetime.date | None = Query(None),
    _staff: models.StaffUser = Depends(require_role(*models.SUPER_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Every financial transaction — memberships and cafeteria orders — for
    the Super Admin view (head_trainer / owner)."""
    default_start, default_end = _default_range()
    range_start, range_end = start or default_start, end or default_end
    start_dt = datetime.datetime.combine(range_start, datetime.time.min, tzinfo=datetime.timezone.utc)
    end_dt = datetime.datetime.combine(range_end, datetime.time.max, tzinfo=datetime.timezone.utc)

    membership_txns = (
        db.query(models.MembershipTransaction)
        .options(
            joinedload(models.MembershipTransaction.member),
            joinedload(models.MembershipTransaction.recorded_by),
        )
        .filter(models.MembershipTransaction.created_at >= start_dt, models.MembershipTransaction.created_at <= end_dt)
        .all()
    )
    cafeteria_orders = (
        db.query(models.CafeteriaOrder)
        .options(joinedload(models.CafeteriaOrder.member))
        .filter(models.CafeteriaOrder.created_at >= start_dt, models.CafeteriaOrder.created_at <= end_dt)
        .all()
    )

    out = [
        schemas.SuperAdminTransactionOut(
            id=f"m-{t.id}",
            type="membership",
            member_name=t.member.name if t.member else None,
            member_identifier=t.member.identifier if t.member else None,
            description=f"Membership — {t.plan}",
            amount_inr=float(t.amount_inr),
            payment_method=t.payment_method,
            recorded_by=(t.recorded_by.full_name or t.recorded_by.identifier) if t.recorded_by else "Admin panel",
            created_at=t.created_at,
        )
        for t in membership_txns
    ] + [
        schemas.SuperAdminTransactionOut(
            id=f"c-{o.id}",
            type="cafeteria",
            member_name=o.member.name if o.member else None,
            member_identifier=o.member.identifier if o.member else None,
            description=f"Cafeteria order #{o.id} ({o.status})",
            amount_inr=float(o.total_inr),
            payment_method=None,
            recorded_by=None,
            created_at=o.created_at,
        )
        for o in cafeteria_orders
    ]
    out.sort(key=lambda t: t.created_at, reverse=True)
    return out


@router.get("/reports/financial")
def financial_report(
    start: datetime.date | None = Query(None),
    end: datetime.date | None = Query(None),
    staff: models.StaffUser = Depends(require_role(*models.SUPER_ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Full financial + overall report CSV — head_trainer / owner only."""
    default_start, default_end = _default_range()
    range_start, range_end = start or default_start, end or default_end
    start_dt = datetime.datetime.combine(range_start, datetime.time.min, tzinfo=datetime.timezone.utc)
    end_dt = datetime.datetime.combine(range_end, datetime.time.max, tzinfo=datetime.timezone.utc)

    summary = _financial_summary(db, range_start, range_end)

    membership_txns = (
        db.query(models.MembershipTransaction)
        .options(joinedload(models.MembershipTransaction.member), joinedload(models.MembershipTransaction.recorded_by))
        .filter(models.MembershipTransaction.created_at >= start_dt, models.MembershipTransaction.created_at <= end_dt)
        .order_by(models.MembershipTransaction.created_at.asc())
        .all()
    )
    cafeteria_orders = (
        db.query(models.CafeteriaOrder)
        .options(joinedload(models.CafeteriaOrder.member))
        .filter(models.CafeteriaOrder.created_at >= start_dt, models.CafeteriaOrder.created_at <= end_dt)
        .order_by(models.CafeteriaOrder.created_at.asc())
        .all()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Bhoomi Fitness — Financial & overall report"])
    writer.writerow(["Range", f"{range_start.isoformat()} to {range_end.isoformat()}"])
    writer.writerow([])
    writer.writerow(["Summary"])
    writer.writerow(["Membership revenue (INR)", f"{summary.membership_revenue_inr:.2f}"])
    writer.writerow(["Membership transactions", summary.membership_transaction_count])
    writer.writerow(["Cafeteria revenue (INR)", f"{summary.cafeteria_revenue_inr:.2f}"])
    writer.writerow(["Cafeteria orders", summary.cafeteria_order_count])
    writer.writerow(["Total revenue (INR)", f"{summary.total_revenue_inr:.2f}"])
    writer.writerow(["Total members (all time)", summary.total_members])
    writer.writerow(["Active members (right now)", summary.active_members])
    writer.writerow(["Successful gym entries in range", summary.entries_in_range])
    writer.writerow([])

    writer.writerow(["Membership transactions"])
    writer.writerow(["Date", "Member", "Phone/Email", "Plan", "Amount (INR)", "Payment method", "Recorded by"])
    for t in membership_txns:
        writer.writerow(
            [
                t.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                t.member.name if t.member else "—",
                t.member.identifier if t.member else "—",
                t.plan,
                f"{float(t.amount_inr):.2f}",
                t.payment_method,
                (t.recorded_by.full_name or t.recorded_by.identifier) if t.recorded_by else "Admin panel",
            ]
        )
    writer.writerow([])

    writer.writerow(["Cafeteria orders"])
    writer.writerow(["Date", "Member", "Phone/Email", "Order", "Status", "Total (INR)"])
    for o in cafeteria_orders:
        writer.writerow(
            [
                o.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                o.member.name if o.member else "—",
                o.member.identifier if o.member else "—",
                f"Order #{o.id}",
                o.status,
                f"{float(o.total_inr):.2f}",
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="financial-report-{range_start.isoformat()}_{range_end.isoformat()}.csv"'
        },
    )
