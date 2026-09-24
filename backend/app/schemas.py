"""
Pydantic request/response schemas. Field names and shapes here must match
docs/SPEC.md exactly — the two frontend PWAs are built against this contract.
"""
import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Member auth
# ---------------------------------------------------------------------------


class RequestCodeIn(BaseModel):
    identifier: str


class RequestCodeOut(BaseModel):
    message: str
    dev_code: Optional[str] = None


class VerifyCodeIn(BaseModel):
    identifier: str
    code: str


class MemberOut(BaseModel):
    id: int
    name: Optional[str] = None
    identifier: str
    has_active_membership: bool


class VerifyCodeOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member: MemberOut


class MemberUpdateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class QRPayloadOut(BaseModel):
    payload: str
    code: str
    expires_in: int


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------


class EntryVerifyIn(BaseModel):
    payload: Optional[str] = None
    code: Optional[str] = None
    identifier: Optional[str] = None


class EntryMemberOut(BaseModel):
    name: Optional[str] = None
    has_active_membership: bool


class EntryVerifyOut(BaseModel):
    allow: bool
    member: Optional[EntryMemberOut] = None
    reason: Literal["ok", "expired", "no_membership", "invalid", "not_found"]


# ---------------------------------------------------------------------------
# Workouts
# ---------------------------------------------------------------------------


class WorkoutExerciseOut(BaseModel):
    id: int
    name: str
    muscle_group: str
    instructions: str
    animation_url: str
    default_sets: int
    default_reps: int


class WorkoutSessionStartOut(BaseModel):
    session_id: int


class WorkoutSetIn(BaseModel):
    exercise_id: int
    set_number: int
    reps: int
    weight_kg: Optional[float] = None
    calories_est: Optional[float] = None


class WorkoutSetOut(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str
    set_number: int
    reps: int
    weight_kg: Optional[float] = None
    calories_est: Optional[float] = None


class WorkoutSessionFinishIn(BaseModel):
    duration_seconds: int
    total_calories: Optional[float] = None


class WorkoutSessionHistoryOut(BaseModel):
    session_id: int
    date: datetime.date
    started_at: datetime.datetime
    finished_at: Optional[datetime.datetime] = None
    duration_seconds: Optional[int] = None
    total_calories: Optional[float] = None
    sets: list[WorkoutSetOut]


# ---------------------------------------------------------------------------
# Cafeteria
# ---------------------------------------------------------------------------


class CafeteriaMenuItemOut(BaseModel):
    id: int
    name: str
    description: str
    price_inr: float
    category: str
    image_url: str
    available: bool


class OrderItemIn(BaseModel):
    menu_item_id: int
    qty: int = Field(gt=0)


class OrderCreateIn(BaseModel):
    items: list[OrderItemIn]
    notes: Optional[str] = None


class OrderCreateOut(BaseModel):
    order_id: int
    status: str
    total_inr: float


class OrderItemOut(BaseModel):
    menu_item_id: int
    name: str
    qty: int
    price_inr_each: float


class OrderOut(BaseModel):
    id: int
    status: str
    total_inr: float
    notes: Optional[str] = None
    created_at: datetime.datetime
    items: list[OrderItemOut]


class OrderStatusOut(BaseModel):
    status: Literal["placed", "preparing", "ready", "completed"]


# ---------------------------------------------------------------------------
# Staff
# ---------------------------------------------------------------------------


class StaffLoginIn(BaseModel):
    username: str
    password: str


class StaffLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class StaffMemberOut(BaseModel):
    id: int
    name: Optional[str] = None
    identifier: str
    has_active_membership: bool
    membership_plan: Optional[str] = None
    membership_valid_until: Optional[datetime.date] = None


class ActivateMembershipIn(BaseModel):
    plan: str
    valid_until: datetime.date
    payment_method: Literal["cash", "online"]


class StaffOrderStatusUpdateIn(BaseModel):
    status: Literal["preparing", "ready", "completed"]
