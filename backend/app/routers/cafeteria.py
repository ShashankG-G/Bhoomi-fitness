from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.deps import get_current_member

router = APIRouter(prefix="/api/cafeteria", tags=["cafeteria"])


@router.get("/menu", response_model=list[schemas.CafeteriaMenuItemOut])
def get_menu(db: Session = Depends(get_db)):
    items = db.query(models.CafeteriaMenuItem).order_by(models.CafeteriaMenuItem.category, models.CafeteriaMenuItem.name).all()
    return [
        schemas.CafeteriaMenuItemOut(
            id=i.id,
            name=i.name,
            description=i.description,
            price_inr=float(i.price_inr),
            category=i.category,
            image_url=i.image_url,
            available=i.available,
        )
        for i in items
    ]


def _order_to_out(order: models.CafeteriaOrder) -> schemas.OrderOut:
    return schemas.OrderOut(
        id=order.id,
        status=order.status,
        total_inr=float(order.total_inr),
        notes=order.notes,
        created_at=order.created_at,
        items=[
            schemas.OrderItemOut(
                menu_item_id=item.menu_item_id,
                name=item.menu_item.name,
                qty=item.qty,
                price_inr_each=float(item.price_inr_each),
            )
            for item in order.items
        ],
    )


@router.post("/orders", response_model=schemas.OrderCreateOut)
def create_order(
    body: schemas.OrderCreateIn,
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    if not body.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Order must have at least one item")

    order = models.CafeteriaOrder(member_id=member.id, status="placed", notes=body.notes, total_inr=0)
    db.add(order)
    db.flush()  # get order.id without committing yet

    total = 0.0
    for item_in in body.items:
        menu_item = db.get(models.CafeteriaMenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.available:
            db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Menu item {item_in.menu_item_id} is not available")

        price = float(menu_item.price_inr)
        total += price * item_in.qty

        order_item = models.CafeteriaOrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            qty=item_in.qty,
            price_inr_each=price,
        )
        db.add(order_item)

    order.total_inr = total
    db.commit()
    db.refresh(order)

    return schemas.OrderCreateOut(order_id=order.id, status=order.status, total_inr=float(order.total_inr))


@router.get("/orders/mine", response_model=list[schemas.OrderOut])
def list_my_orders(member: models.Member = Depends(get_current_member), db: Session = Depends(get_db)):
    orders = (
        db.query(models.CafeteriaOrder)
        .options(joinedload(models.CafeteriaOrder.items).joinedload(models.CafeteriaOrderItem.menu_item))
        .filter(models.CafeteriaOrder.member_id == member.id)
        .order_by(models.CafeteriaOrder.created_at.desc())
        .all()
    )
    return [_order_to_out(o) for o in orders]


@router.get("/orders/{order_id}/status", response_model=schemas.OrderStatusOut)
def get_order_status(
    order_id: int,
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    order = db.get(models.CafeteriaOrder, order_id)
    if order is None or order.member_id != member.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return schemas.OrderStatusOut(status=order.status)
