"""
SQLAlchemy engine/session setup. Works against SQLite (local dev default) or
Postgres (prod, via DATABASE_URL that Render injects).

We use `Base.metadata.create_all()` on startup rather than Alembic migrations
— simpler to deploy for a single-operator project like this. If the schema
needs to evolve later, Shashank can either wipe+reseed (dev DB, low stakes)
or introduce Alembic at that point. This is documented in the README.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # Needed for SQLite when used with FastAPI's threaded request handling.
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
