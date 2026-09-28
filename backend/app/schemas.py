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
    is_personal_training: bool = False


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
    video_url: Optional[str] = None
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


class StaffRequestCodeIn(BaseModel):
    identifier: str


class StaffRequestCodeOut(BaseModel):
    message: str
    dev_code: Optional[str] = None


class StaffVerifyCodeIn(BaseModel):
    identifier: str
    code: str


StaffRole = Literal["reception", "trainer", "head_trainer", "owner"]


class StaffOut(BaseModel):
    id: int
    name: Optional[str] = None
    identifier: str
    role: StaffRole


class StaffVerifyCodeOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff: StaffOut


class StaffMemberOut(BaseModel):
    id: int
    name: Optional[str] = None
    identifier: str
    has_active_membership: bool
    membership_plan: Optional[str] = None
    membership_valid_until: Optional[datetime.date] = None
    is_personal_training: bool = False


class ActivateMembershipIn(BaseModel):
    plan: str
    valid_until: datetime.date
    payment_method: Literal["cash", "online"]
    amount_inr: float = Field(ge=0)
    is_personal_training: bool = False


class StaffOrderStatusUpdateIn(BaseModel):
    status: Literal["preparing", "ready", "completed"]


# ---------------------------------------------------------------------------
# Personal training (trainer / head_trainer / owner set it, members view it)
# ---------------------------------------------------------------------------


class PersonalTrainingFlagIn(BaseModel):
    is_personal_training: bool


class PTMemberOut(BaseModel):
    id: int
    name: Optional[str] = None
    identifier: str
    has_active_membership: bool
    membership_plan: Optional[str] = None
    membership_valid_until: Optional[datetime.date] = None
    days_planned_next_30: int = 0


class PTExerciseIn(BaseModel):
    exercise_name: str = Field(min_length=1, max_length=160)
    sets: Optional[int] = Field(default=None, ge=1, le=20)
    reps: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=300)


class PTExerciseOut(BaseModel):
    id: Optional[int] = None
    exercise_name: str
    sets: Optional[int] = None
    reps: Optional[str] = None
    notes: Optional[str] = None


class PTDayIn(BaseModel):
    is_rest_day: bool = False
    title: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=500)
    exercises: list[PTExerciseIn] = Field(default_factory=list)


class PTDayOut(BaseModel):
    date: datetime.date
    is_rest_day: bool = False
    title: Optional[str] = None
    notes: Optional[str] = None
    exercises: list[PTExerciseOut] = Field(default_factory=list)
    trainer_name: Optional[str] = None
    updated_at: Optional[datetime.datetime] = None


# ---------------------------------------------------------------------------
# Super admin (head_trainer / owner only)
# ---------------------------------------------------------------------------


class SuperAdminStaffOut(BaseModel):
    id: int
    name: Optional[str] = None
    identifier: Optional[str] = None
    role: StaffRole
    active: bool
    created_at: datetime.datetime


class FinancialSummaryOut(BaseModel):
    range_start: datetime.date
    range_end: datetime.date
    membership_revenue_inr: float
    membership_transaction_count: int
    cafeteria_revenue_inr: float
    cafeteria_order_count: int
    total_revenue_inr: float
    total_members: int
    active_members: int
    entries_in_range: int


class SuperAdminTransactionOut(BaseModel):
    id: str
    type: Literal["membership", "cafeteria"]
    member_name: Optional[str] = None
    member_identifier: Optional[str] = None
    description: str
    amount_inr: float
    payment_method: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: datetime.datetime
