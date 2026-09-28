"""
Server-rendered master admin panel. Gated entirely by MASTER_KEY (compared
constant-time) + a signed HttpOnly session cookie. Not part of the JSON API,
not linked from anywhere in the public site or either PWA, and no response
from any other endpoint in this codebase references '/admin' or the master
key.
"""
import datetime
import os
import secrets

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import models, security
from app.admin.session import ADMIN_COOKIE_NAME, require_admin, sign_session
from app.config import settings
from app.database import get_db

router = APIRouter(prefix="/admin", tags=["admin"], include_in_schema=False)

_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=_TEMPLATES_DIR)


@router.get("")
def admin_root(request: Request):
    cookie_value = request.cookies.get(ADMIN_COOKIE_NAME)
    from app.admin.session import verify_session_cookie

    if verify_session_cookie(cookie_value):
        return RedirectResponse(url="/admin/dashboard", status_code=303)
    return templates.TemplateResponse(request, "login.html", {})


@router.post("")
def admin_login(request: Request, master_key: str = Form(...)):
    if secrets.compare_digest(master_key, settings.MASTER_KEY):
        response = RedirectResponse(url="/admin/dashboard", status_code=303)
        response.set_cookie(
            key=ADMIN_COOKIE_NAME,
            value=sign_session(),
            httponly=True,
            secure=not settings.is_development,
            samesite="lax",
            max_age=12 * 60 * 60,
        )
        return response
    return templates.TemplateResponse(
        request, "login.html", {"error": "Incorrect master key."}, status_code=401
    )


@router.get("/logout")
def admin_logout():
    response = RedirectResponse(url="/admin", status_code=303)
    response.delete_cookie(ADMIN_COOKIE_NAME)
    return response


@router.get("/dashboard", dependencies=[Depends(require_admin)])
def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    total_members = db.query(func.count(models.Member.id)).scalar() or 0
    active_members = (
        db.query(func.count(models.Member.id)).filter(models.Member.has_active_membership.is_(True)).scalar() or 0
    )

    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    entries_today = (
        db.query(func.count(models.EntryLog.id)).filter(models.EntryLog.created_at >= today_start).scalar() or 0
    )
    orders_today = (
        db.query(func.count(models.CafeteriaOrder.id))
        .filter(models.CafeteriaOrder.created_at >= today_start)
        .scalar()
        or 0
    )
    revenue_today = (
        db.query(func.coalesce(func.sum(models.CafeteriaOrder.total_inr), 0))
        .filter(models.CafeteriaOrder.created_at >= today_start)
        .scalar()
        or 0
    )

    recent_entries = (
        db.query(models.EntryLog)
        .options(joinedload(models.EntryLog.member))
        .order_by(models.EntryLog.created_at.desc())
        .limit(20)
        .all()
    )

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "total_members": total_members,
            "active_members": active_members,
            "entries_today": entries_today,
            "orders_today": orders_today,
            "revenue_today": f"{float(revenue_today):.2f}",
            "recent_entries": recent_entries,
        },
    )


def _resolve_plan(plan: str, custom_plan: str) -> str | None:
    """Shared by member create/update: turns the admin form's plan select +
    optional custom-name field into a single plan string, or None for
    'no membership'."""
    plan = (plan or "").strip()
    if plan == "__custom__":
        return custom_plan.strip() or None
    return plan or None


@router.get("/members", dependencies=[Depends(require_admin)])
def admin_members(request: Request, q: str = "", status: str = "", db: Session = Depends(get_db)):
    query = db.query(models.Member)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            (models.Member.identifier.ilike(like)) | (models.Member.name.ilike(like))
        )
    if status == "active":
        query = query.filter(models.Member.has_active_membership.is_(True))
    elif status == "inactive":
        query = query.filter(models.Member.has_active_membership.is_(False))

    members = query.order_by(models.Member.created_at.desc()).all()

    return templates.TemplateResponse(
        request,
        "members.html",
        {
            "members": members,
            "q": q,
            "status": status,
            "ok": request.query_params.get("ok"),
            "error": request.query_params.get("error"),
        },
    )


@router.post("/members/create", dependencies=[Depends(require_admin)])
def admin_member_create(
    name: str = Form(...),
    identifier: str = Form(...),
    plan: str = Form(""),
    custom_plan: str = Form(""),
    valid_until: str = Form(""),
    payment_method: str = Form("cash"),
    amount_inr: str = Form(""),
    is_personal_training: str = Form(""),
    db: Session = Depends(get_db),
):
    name = name.strip()
    identifier = identifier.strip()
    if not name or not identifier:
        return RedirectResponse(url="/admin/members?error=Name+and+identifier+are+required.", status_code=303)

    existing = db.query(models.Member).filter(models.Member.identifier == identifier).first()
    if existing:
        return RedirectResponse(
            url="/admin/members?error=A+member+with+that+email%2Fphone+already+exists.", status_code=303
        )

    final_plan = _resolve_plan(plan, custom_plan)
    valid_until_date = None
    amount_value = None
    if final_plan:
        if not valid_until:
            return RedirectResponse(
                url="/admin/members?error=Pick+a+valid-until+date+for+the+plan%2C+or+choose+%27No+membership+yet%27.",
                status_code=303,
            )
        try:
            valid_until_date = datetime.date.fromisoformat(valid_until)
        except ValueError:
            return RedirectResponse(url="/admin/members?error=Invalid+date.", status_code=303)
        try:
            amount_value = float(amount_inr) if amount_inr.strip() else 0.0
        except ValueError:
            return RedirectResponse(url="/admin/members?error=Invalid+amount.", status_code=303)

    member = models.Member(
        name=name,
        identifier=identifier,
        qr_secret=security.new_qr_secret(),
        has_active_membership=final_plan is not None,
        membership_plan=final_plan,
        membership_valid_until=valid_until_date,
        membership_payment_method=payment_method if final_plan else None,
        is_personal_training=bool(is_personal_training),
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    if final_plan:
        db.add(
            models.MembershipTransaction(
                member_id=member.id,
                plan=final_plan,
                amount_inr=amount_value,
                payment_method=payment_method,
                recorded_by_staff_id=None,
            )
        )
        db.commit()

    return RedirectResponse(url=f"/admin/members/{member.id}?ok=Member+created.", status_code=303)


@router.get("/members/{member_id}", dependencies=[Depends(require_admin)])
def admin_member_detail(request: Request, member_id: int, db: Session = Depends(get_db)):
    member = db.get(models.Member, member_id)
    if member is None:
        return RedirectResponse(url="/admin/members?error=Member+not+found.", status_code=303)

    return templates.TemplateResponse(
        request,
        "member_detail.html",
        {
            "member": member,
            "ok": request.query_params.get("ok"),
            "error": request.query_params.get("error"),
        },
    )


@router.post("/members/{member_id}/update-plan", dependencies=[Depends(require_admin)])
def admin_member_update_plan(
    member_id: int,
    plan: str = Form(""),
    custom_plan: str = Form(""),
    valid_until: str = Form(...),
    payment_method: str = Form("cash"),
    amount_inr: str = Form(""),
    is_personal_training: str = Form(""),
    db: Session = Depends(get_db),
):
    member = db.get(models.Member, member_id)
    if member is None:
        return RedirectResponse(url="/admin/members?error=Member+not+found.", status_code=303)

    final_plan = _resolve_plan(plan, custom_plan)
    if not final_plan:
        return RedirectResponse(
            url=f"/admin/members/{member_id}?error=Choose+or+enter+a+plan.", status_code=303
        )
    try:
        valid_until_date = datetime.date.fromisoformat(valid_until)
    except ValueError:
        return RedirectResponse(url=f"/admin/members/{member_id}?error=Invalid+date.", status_code=303)
    try:
        amount_value = float(amount_inr) if amount_inr.strip() else 0.0
    except ValueError:
        return RedirectResponse(url=f"/admin/members/{member_id}?error=Invalid+amount.", status_code=303)

    member.has_active_membership = True
    member.membership_plan = final_plan
    member.membership_valid_until = valid_until_date
    member.membership_payment_method = payment_method
    member.is_personal_training = bool(is_personal_training)
    db.commit()

    db.add(
        models.MembershipTransaction(
            member_id=member.id,
            plan=final_plan,
            amount_inr=amount_value,
            payment_method=payment_method,
            recorded_by_staff_id=None,
        )
    )
    db.commit()

    return RedirectResponse(url=f"/admin/members/{member_id}?ok=Plan+updated.", status_code=303)


@router.post("/members/{member_id}/deactivate", dependencies=[Depends(require_admin)])
def admin_member_deactivate(member_id: int, db: Session = Depends(get_db)):
    member = db.get(models.Member, member_id)
    if member is None:
        return RedirectResponse(url="/admin/members?error=Member+not+found.", status_code=303)

    member.has_active_membership = False
    member.membership_plan = None
    member.membership_valid_until = None
    member.membership_payment_method = None
    db.commit()

    return RedirectResponse(url=f"/admin/members/{member_id}?ok=Membership+deactivated.", status_code=303)


@router.get("/entries", dependencies=[Depends(require_admin)])
def admin_entries(request: Request, q: str = "", result: str = "", db: Session = Depends(get_db)):
    query = db.query(models.EntryLog).options(joinedload(models.EntryLog.member))

    if result == "allowed":
        query = query.filter(models.EntryLog.success.is_(True))
    elif result == "denied":
        query = query.filter(models.EntryLog.success.is_(False))

    entries = query.order_by(models.EntryLog.created_at.desc()).limit(500).all()

    if q.strip():
        needle = q.strip().lower()
        entries = [
            e
            for e in entries
            if (e.member and needle in (e.member.name or "").lower())
            or (e.member and needle in (e.member.identifier or "").lower())
            or (e.identifier_used and needle in e.identifier_used.lower())
        ]

    return templates.TemplateResponse(request, "entries.html", {"entries": entries, "q": q, "result": result})


@router.get("/workouts", dependencies=[Depends(require_admin)])
def admin_workouts(request: Request, db: Session = Depends(get_db)):
    exercises = db.query(models.WorkoutExercise).order_by(models.WorkoutExercise.muscle_group).all()
    sessions = (
        db.query(models.WorkoutSession)
        .options(joinedload(models.WorkoutSession.member), joinedload(models.WorkoutSession.sets))
        .order_by(models.WorkoutSession.started_at.desc())
        .limit(50)
        .all()
    )
    return templates.TemplateResponse(
        request, "workouts.html", {"exercises": exercises, "sessions": sessions}
    )


@router.get("/cafeteria", dependencies=[Depends(require_admin)])
def admin_cafeteria(request: Request, status: str = "", db: Session = Depends(get_db)):
    menu_items = db.query(models.CafeteriaMenuItem).all()

    query = db.query(models.CafeteriaOrder).options(
        joinedload(models.CafeteriaOrder.member),
        joinedload(models.CafeteriaOrder.items).joinedload(models.CafeteriaOrderItem.menu_item),
    )
    if status:
        query = query.filter(models.CafeteriaOrder.status == status)
    orders = query.order_by(models.CafeteriaOrder.created_at.desc()).limit(200).all()

    total_revenue = db.query(func.coalesce(func.sum(models.CafeteriaOrder.total_inr), 0)).scalar() or 0

    return templates.TemplateResponse(
        request,
        "cafeteria.html",
        {
            "menu_items": menu_items,
            "orders": orders,
            "status": status,
            "total_revenue": f"{float(total_revenue):.2f}",
        },
    )


@router.get("/staff", dependencies=[Depends(require_admin)])
def admin_staff(request: Request, db: Session = Depends(get_db)):
    staff_users = db.query(models.StaffUser).order_by(models.StaffUser.created_at.asc()).all()
    return templates.TemplateResponse(
        request,
        "staff.html",
        {
            "staff_users": staff_users,
            "active": "staff",
            "ok": request.query_params.get("ok"),
            "error": request.query_params.get("error"),
        },
    )


ROLE_LABELS = {
    models.ROLE_RECEPTION: "Reception",
    models.ROLE_TRAINER: "Trainer",
    models.ROLE_HEAD_TRAINER: "Head Trainer (Super Admin)",
    models.ROLE_OWNER: "Owner (Super Admin)",
}


@router.post("/staff/create", dependencies=[Depends(require_admin)])
def admin_staff_create(
    identifier: str = Form(...),
    role: str = Form(...),
    full_name: str = Form(""),
    db: Session = Depends(get_db),
):
    identifier = identifier.strip().lower()
    if not identifier:
        return RedirectResponse(url="/admin/staff?error=Phone+or+email+is+required.", status_code=303)
    if role not in models.STAFF_ROLES:
        return RedirectResponse(url="/admin/staff?error=Invalid+role.", status_code=303)

    existing = db.query(models.StaffUser).filter(models.StaffUser.identifier == identifier).first()
    if existing:
        return RedirectResponse(url="/admin/staff?error=That+phone+or+email+is+already+registered.", status_code=303)

    db.add(
        models.StaffUser(
            identifier=identifier,
            full_name=full_name.strip() or None,
            role=role,
            active=True,
        )
    )
    db.commit()
    return RedirectResponse(
        url=f"/admin/staff?ok=Created+{ROLE_LABELS.get(role, role)}+account+for+%27{identifier}%27.+They+sign+in+from+the+staff+app+with+this+number.",
        status_code=303,
    )


@router.post("/staff/{staff_id}/set-role", dependencies=[Depends(require_admin)])
def admin_staff_set_role(staff_id: int, role: str = Form(...), db: Session = Depends(get_db)):
    if role not in models.STAFF_ROLES:
        return RedirectResponse(url="/admin/staff?error=Invalid+role.", status_code=303)

    staff_user = db.query(models.StaffUser).filter(models.StaffUser.id == staff_id).first()
    if not staff_user:
        return RedirectResponse(url="/admin/staff?error=Staff+account+not+found.", status_code=303)

    staff_user.role = role
    db.commit()
    return RedirectResponse(
        url=f"/admin/staff?ok=Role+updated+to+{ROLE_LABELS.get(role, role)}+for+%27{staff_user.identifier}%27.",
        status_code=303,
    )


@router.post("/staff/{staff_id}/toggle-active", dependencies=[Depends(require_admin)])
def admin_staff_toggle_active(staff_id: int, db: Session = Depends(get_db)):
    staff_user = db.query(models.StaffUser).filter(models.StaffUser.id == staff_id).first()
    if not staff_user:
        return RedirectResponse(url="/admin/staff?error=Staff+account+not+found.", status_code=303)

    staff_user.active = not staff_user.active
    db.commit()
    state = "reactivated" if staff_user.active else "deactivated"
    return RedirectResponse(
        url=f"/admin/staff?ok=Account+%27{staff_user.identifier}%27+{state}.", status_code=303
    )
