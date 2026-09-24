from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas, security
from app.config import settings
from app.database import get_db
from app.deps import get_current_staff

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.post("/login", response_model=schemas.StaffLoginOut)
def staff_login(body: schemas.StaffLoginIn, db: Session = Depends(get_db)):
    staff = db.query(models.StaffUser).filter(models.StaffUser.username == body.username.strip()).first()
    if staff is None or not staff.active or not security.verify_password(body.password, staff.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    token = security.create_access_token(
        subject=staff.id, scope="staff", expires_minutes=settings.JWT_EXPIRE_MINUTES_STAFF
    )
    return schemas.StaffLoginOut(access_token=token)


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
    _staff: models.StaffUser = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    member = db.get(models.Member, member_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    member.has_active_membership = True
    member.membership_plan = body.plan
    member.membership_valid_until = body.valid_until
    member.membership_payment_method = body.payment_method
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
