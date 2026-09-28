"""
Idempotent, no-downtime schema patcher for databases that already existed
before a model change.

This project uses Base.metadata.create_all() instead of Alembic (see
database.py for why) — that call only creates tables that don't exist yet,
it never adds a column to a table that's already there. Since Render's free
tier has no shell/SSH access, if we ever add a column to an existing model,
a database that was deployed before that change needs this patcher to
actually receive it, or the app crashes the first time it reads/writes that
column. Safe to run on every startup — every step checks what's already
there before touching anything, and never drops or renames data.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("bhoomi.schema_patch")

# (table, column, DDL type/constraint) — additive only. Add a line here
# whenever a column is added to an existing model in models.py.
_ADDITIVE_COLUMNS = [
    ("staff_users", "identifier", "VARCHAR(255)"),
    ("staff_users", "role", "VARCHAR(20) DEFAULT 'reception' NOT NULL"),
    ("workout_exercises", "video_url", "VARCHAR(500)"),
    ("members", "is_personal_training", "BOOLEAN DEFAULT FALSE NOT NULL"),
]


def ensure_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, column, ddl_type in _ADDITIVE_COLUMNS:
            if table not in existing_tables:
                # Brand-new table — Base.metadata.create_all() already
                # created it with every current column, nothing to patch.
                continue
            existing_columns = {c["name"] for c in inspector.get_columns(table)}
            if column in existing_columns:
                continue
            logger.info("schema_patch: adding %s.%s", table, column)
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))

        if "staff_users" in existing_tables:
            try:
                conn.execute(
                    text("CREATE UNIQUE INDEX IF NOT EXISTS ix_staff_users_identifier ON staff_users (identifier)")
                )
            except Exception:
                logger.exception("schema_patch: could not (re)create staff_users identifier index")

            # The old username/password login required these NOT NULL;
            # staff now sign in with identifier + OTP instead, so new rows
            # are inserted without them. Only Postgres supports relaxing a
            # NOT NULL constraint on an existing column this way — SQLite
            # dev databases are disposable, so we skip it there.
            if engine.dialect.name == "postgresql":
                for legacy_column in ("username", "password_hash"):
                    try:
                        conn.execute(text(f"ALTER TABLE staff_users ALTER COLUMN {legacy_column} DROP NOT NULL"))
                    except Exception:
                        logger.exception(
                            "schema_patch: could not relax NOT NULL on staff_users.%s", legacy_column
                        )
