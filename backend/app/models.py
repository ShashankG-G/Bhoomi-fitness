"""
SQLAlchemy ORM models. See docs/SPEC.md for the data model this implements.
"""
import datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    identifier: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    has_active_membership: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    membership_plan: Mapped[str | None] = mapped_column(String(80), nullable=True)
    membership_valid_until: Mapped[datetime.date | None] = mapped_column(nullable=True)
    membership_payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # True for members on a personal-training plan — flagged by staff (from
    # the staff app's Personal Trainer tab or when activating a membership)
    # independently of what the plan is named, since staff can rename/retire
    # plan labels freely. Nullable-free additive column, see schema_patch.py.
    is_personal_training: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Server-side only TOTP secret for the rotating entry QR. Never sent to
    # any client in any response.
    qr_secret: Mapped[str] = mapped_column(String(64), nullable=False)

    # Replay protection: the last TOTP window number successfully used for
    # gym entry. A repeat of the same window is rejected.
    last_entry_window: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workout_sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="member")
    cafeteria_orders: Mapped[list["CafeteriaOrder"]] = relationship(back_populates="member")


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    identifier: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# Staff roles, from least to most privileged. RECEPTION and TRAINER are
# day-to-day operating staff; HEAD_TRAINER and OWNER additionally get the
# "Super Admin" view (all staff, every financial transaction) — see
# SUPER_ADMIN_ROLES below and app/deps.require_role().
ROLE_RECEPTION = "reception"
ROLE_TRAINER = "trainer"
ROLE_HEAD_TRAINER = "head_trainer"
ROLE_OWNER = "owner"
STAFF_ROLES = (ROLE_RECEPTION, ROLE_TRAINER, ROLE_HEAD_TRAINER, ROLE_OWNER)
SUPER_ADMIN_ROLES = (ROLE_HEAD_TRAINER, ROLE_OWNER)
# Who can use the Personal Trainer tab (view PT members, set/edit their
# workout plans): trainers themselves, plus head_trainer/owner for oversight.
# Reception is excluded — they manage memberships, not training programs.
TRAINER_ROLES = (ROLE_TRAINER, ROLE_HEAD_TRAINER, ROLE_OWNER)


class StaffUser(Base):
    __tablename__ = "staff_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Phone (or email) — staff sign in with this + a one-time code, the same
    # flow as members. Accounts are created only from the hidden /admin
    # panel (master key), never by self-signup.
    identifier: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default=ROLE_RECEPTION, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Legacy columns from the old username/password login, replaced by
    # identifier + OTP above. Kept (nullable, unused) purely so a database
    # that already has this table from before this change doesn't need a
    # manual migration — see app/schema_patch.py.
    username: Mapped[str | None] = mapped_column(String(80), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)


class MembershipTransaction(Base):
    """One row per membership sale/renewal/activation — the financial ledger
    for memberships, parallel to CafeteriaOrder for cafeteria revenue. Written
    whenever staff or the admin panel activates or changes a member's plan;
    never edited afterward. This is what the Super Admin financial view and
    the owner's financial report are computed from."""

    __tablename__ = "membership_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    plan: Mapped[str] = mapped_column(String(80), nullable=False)
    amount_inr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    # Which staff member recorded this (null when done from the master
    # admin panel rather than the staff app).
    recorded_by_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    member: Mapped["Member"] = relationship()
    recorded_by: Mapped["StaffUser | None"] = relationship()


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(40), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    animation_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # A real YouTube demo/tutorial video for this exercise, so members who
    # aren't sure about form can watch one instead of just reading text.
    # Nullable + schema-patched (see app/schema_patch.py) so it's additive
    # on top of an already-deployed exercise library.
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_sets: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    default_reps: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="exercise")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    started_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_calories: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)

    member: Mapped["Member"] = relationship(back_populates="workout_sessions")
    sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("workout_sessions.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("workout_exercises.id"), nullable=False)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    calories_est: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["WorkoutSession"] = relationship(back_populates="sets")
    exercise: Mapped["WorkoutExercise"] = relationship(back_populates="sets")


class CafeteriaMenuItem(Base):
    __tablename__ = "cafeteria_menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price_inr: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CafeteriaOrder(Base):
    __tablename__ = "cafeteria_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="placed", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_inr: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    member: Mapped["Member"] = relationship(back_populates="cafeteria_orders")
    items: Mapped[list["CafeteriaOrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class CafeteriaOrderItem(Base):
    __tablename__ = "cafeteria_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("cafeteria_orders.id"), nullable=False)
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("cafeteria_menu_items.id"), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price_inr_each: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)

    order: Mapped["CafeteriaOrder"] = relationship(back_populates="items")
    menu_item: Mapped["CafeteriaMenuItem"] = relationship()


class PTPlanDay(Base):
    """One calendar day of a personal-training member's assigned workout —
    set by a trainer from the staff app's Personal Trainer tab, visible to
    the member in their own app. One row per (member, date); re-saving a day
    overwrites it rather than creating a duplicate."""

    __tablename__ = "pt_plan_days"
    __table_args__ = (UniqueConstraint("member_id", "date", name="uq_pt_plan_days_member_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    # Which trainer last set/edited this day. Nullable so the row survives a
    # trainer account being deactivated later.
    trainer_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    is_rest_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    member: Mapped["Member"] = relationship()
    trainer: Mapped["StaffUser | None"] = relationship()
    exercises: Mapped[list["PTPlanExercise"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="PTPlanExercise.order_index"
    )


class PTPlanExercise(Base):
    """One exercise within a PTPlanDay — free-text name (not tied to the
    member workout-library) plus optional sets/reps/notes, so a trainer can
    program anything without being limited to the app's exercise catalog."""

    __tablename__ = "pt_plan_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("pt_plan_days.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exercise_name: Mapped[str] = mapped_column(String(160), nullable=False)
    sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reps: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)

    day: Mapped["PTPlanDay"] = relationship(back_populates="exercises")


class EntryLog(Base):
    __tablename__ = "entry_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id"), nullable=True)
    identifier_used: Mapped[str | None] = mapped_column(String(255), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    member: Mapped["Member | None"] = relationship()
