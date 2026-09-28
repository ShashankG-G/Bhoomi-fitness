"""
Shared helpers for the personal-training feature, used by both the
trainer-facing endpoints (app/routers/staff.py) and the member-facing
endpoint (app/routers/workouts.py) so the "day range with gaps filled in"
logic lives in exactly one place.
"""
import datetime

from sqlalchemy.orm import Session, joinedload

from app import models, schemas

DEFAULT_PLAN_DAYS = 30


def default_plan_range(start: datetime.date | None = None) -> tuple[datetime.date, datetime.date]:
    """The default (today .. today+29) 30-day planning window, or
    (start .. start+29) if a start date is given."""
    range_start = start or datetime.datetime.now(datetime.timezone.utc).date()
    range_end = range_start + datetime.timedelta(days=DEFAULT_PLAN_DAYS - 1)
    return range_start, range_end


def build_day_range(
    db: Session, member_id: int, range_start: datetime.date, range_end: datetime.date
) -> list[schemas.PTDayOut]:
    """Every date from range_start to range_end inclusive, populated from
    whatever PTPlanDay rows exist for this member and left blank (no plan
    set yet) for the rest — so the caller always gets one entry per day,
    never a sparse list the frontend has to reconcile against a calendar."""
    days = (
        db.query(models.PTPlanDay)
        .options(joinedload(models.PTPlanDay.exercises), joinedload(models.PTPlanDay.trainer))
        .filter(
            models.PTPlanDay.member_id == member_id,
            models.PTPlanDay.date >= range_start,
            models.PTPlanDay.date <= range_end,
        )
        .all()
    )
    by_date = {d.date: d for d in days}

    out: list[schemas.PTDayOut] = []
    cur = range_start
    while cur <= range_end:
        d = by_date.get(cur)
        if d is not None:
            out.append(
                schemas.PTDayOut(
                    date=cur,
                    is_rest_day=d.is_rest_day,
                    title=d.title,
                    notes=d.notes,
                    exercises=[
                        schemas.PTExerciseOut(
                            id=e.id, exercise_name=e.exercise_name, sets=e.sets, reps=e.reps, notes=e.notes
                        )
                        for e in d.exercises
                    ],
                    trainer_name=(d.trainer.full_name or d.trainer.identifier) if d.trainer else None,
                    updated_at=d.updated_at,
                )
            )
        else:
            out.append(schemas.PTDayOut(date=cur, is_rest_day=False, exercises=[]))
        cur += datetime.timedelta(days=1)
    return out
