import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.deps import get_current_member
from app.pt_helpers import build_day_range, default_plan_range

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.get("/library", response_model=list[schemas.WorkoutExerciseOut])
def get_library(db: Session = Depends(get_db)):
    exercises = db.query(models.WorkoutExercise).order_by(models.WorkoutExercise.muscle_group, models.WorkoutExercise.name).all()
    return [
        schemas.WorkoutExerciseOut(
            id=e.id,
            name=e.name,
            muscle_group=e.muscle_group,
            instructions=e.instructions,
            animation_url=e.animation_url,
            video_url=e.video_url,
            default_sets=e.default_sets,
            default_reps=e.default_reps,
        )
        for e in exercises
    ]


@router.get("/personal-training-plan", response_model=list[schemas.PTDayOut])
def get_personal_training_plan(
    start: datetime.date | None = Query(None),
    end: datetime.date | None = Query(None),
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    """The signed-in member's own day-by-day plan, as set by their trainer.
    Empty for a member who isn't on a personal-training plan, rather than an
    error — the client-app tab is simply hidden for them based on
    `member.is_personal_training`, but this stays safe either way."""
    if not member.is_personal_training:
        return []
    range_start, default_end = default_plan_range(start)
    range_end = end or default_end
    return build_day_range(db, member.id, range_start, range_end)


@router.post("/sessions", response_model=schemas.WorkoutSessionStartOut)
def start_session(member: models.Member = Depends(get_current_member), db: Session = Depends(get_db)):
    session = models.WorkoutSession(member_id=member.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return schemas.WorkoutSessionStartOut(session_id=session.id)


def _get_owned_session(db: Session, session_id: int, member: models.Member) -> models.WorkoutSession:
    session = db.get(models.WorkoutSession, session_id)
    if session is None or session.member_id != member.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return session


@router.post("/sessions/{session_id}/sets", response_model=schemas.WorkoutSetOut)
def log_set(
    session_id: int,
    body: schemas.WorkoutSetIn,
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, member)
    exercise = db.get(models.WorkoutExercise, body.exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    workout_set = models.WorkoutSet(
        session_id=session.id,
        exercise_id=exercise.id,
        set_number=body.set_number,
        reps=body.reps,
        weight_kg=body.weight_kg,
        calories_est=body.calories_est,
    )
    db.add(workout_set)
    db.commit()
    db.refresh(workout_set)

    return schemas.WorkoutSetOut(
        id=workout_set.id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        set_number=workout_set.set_number,
        reps=workout_set.reps,
        weight_kg=workout_set.weight_kg,
        calories_est=workout_set.calories_est,
    )


@router.post("/sessions/{session_id}/finish", response_model=schemas.WorkoutSessionHistoryOut)
def finish_session(
    session_id: int,
    body: schemas.WorkoutSessionFinishIn,
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, member)
    session.duration_seconds = body.duration_seconds
    session.total_calories = body.total_calories
    session.finished_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(session)

    sets = (
        db.query(models.WorkoutSet)
        .options(joinedload(models.WorkoutSet.exercise))
        .filter(models.WorkoutSet.session_id == session.id)
        .order_by(models.WorkoutSet.set_number)
        .all()
    )

    return schemas.WorkoutSessionHistoryOut(
        session_id=session.id,
        date=session.started_at.date(),
        started_at=session.started_at,
        finished_at=session.finished_at,
        duration_seconds=session.duration_seconds,
        total_calories=session.total_calories,
        sets=[
            schemas.WorkoutSetOut(
                id=s.id,
                exercise_id=s.exercise_id,
                exercise_name=s.exercise.name,
                set_number=s.set_number,
                reps=s.reps,
                weight_kg=s.weight_kg,
                calories_est=s.calories_est,
            )
            for s in sets
        ],
    )


@router.get("/history", response_model=list[schemas.WorkoutSessionHistoryOut])
def get_history(
    months: int = Query(2, ge=1, le=24),
    member: models.Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=months * 31)

    sessions = (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.member_id == member.id, models.WorkoutSession.started_at >= since)
        .order_by(models.WorkoutSession.started_at.desc())
        .all()
    )

    result = []
    for session in sessions:
        sets = (
            db.query(models.WorkoutSet)
            .options(joinedload(models.WorkoutSet.exercise))
            .filter(models.WorkoutSet.session_id == session.id)
            .order_by(models.WorkoutSet.set_number)
            .all()
        )
        result.append(
            schemas.WorkoutSessionHistoryOut(
                session_id=session.id,
                date=session.started_at.date(),
                started_at=session.started_at,
                finished_at=session.finished_at,
                duration_seconds=session.duration_seconds,
                total_calories=session.total_calories,
                sets=[
                    schemas.WorkoutSetOut(
                        id=s.id,
                        exercise_id=s.exercise_id,
                        exercise_name=s.exercise.name,
                        set_number=s.set_number,
                        reps=s.reps,
                        weight_kg=s.weight_kg,
                        calories_est=s.calories_est,
                    )
                    for s in sets
                ],
            )
        )
    return result
