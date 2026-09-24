"""
SQLAlchemy ORM models. See docs/SPEC.md for the data model this implements.
"""
import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
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


class StaffUser(Base):
    __tablename__ = "staff_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="staff", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(40), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    animation_url: Mapped[str] = mapped_column(String(500), nullable=False)
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
