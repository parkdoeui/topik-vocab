"""Small in-process migrations for deployments that predate Alembic."""

from __future__ import annotations

from typing import Any

from sqlalchemy import BigInteger, Engine, MetaData, Table, inspect, select, text
from sqlalchemy.orm import Session

from models import Base, WritingSessionRecord
from review_seed import seed_language_review
from writing_session_data import (
    build_session_payload,
    empty_session_payload,
    saved_answers,
    saved_test,
)
from writing_tests import get_test


def _completed_status_sql(columns: set[str]) -> str:
    if "grading_json" in columns:
        return (
            "CASE WHEN grading_json IS NOT NULL THEN 'completed' "
            "WHEN completed_at IS NOT NULL THEN 'finished' ELSE 'started' END"
        )
    if "completed_at" in columns:
        return "CASE WHEN completed_at IS NOT NULL THEN 'finished' ELSE 'started' END"
    return "'started'"


def _sqlite_rebuild_writing_sessions(engine: Engine, columns: list[dict[str, Any]]) -> None:
    old_names = {column["name"] for column in columns}
    required = {"id", "test_id", "passcode", "started_at", "answers_json"}
    missing_required = required - old_names
    if missing_required:
        raise RuntimeError(
            "Cannot migrate writing_sessions; missing columns: "
            + ", ".join(sorted(missing_required))
        )

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE writing_sessions RENAME TO writing_sessions_legacy"))

        # Renaming keeps explicit index names reserved, so remove those indexes
        # before SQLAlchemy creates the replacement table and its indexes.
        indexes = list(
            connection.execute(
                text("PRAGMA index_list('writing_sessions_legacy')")
            ).mappings()
        )
        quote = connection.dialect.identifier_preparer.quote
        for index in indexes:
            if index.get("origin") == "c":
                connection.execute(text(f"DROP INDEX {quote(str(index['name']))}"))

        WritingSessionRecord.__table__.create(connection)

        destination: list[str] = []
        expressions: list[str] = []
        for column in WritingSessionRecord.__table__.columns:
            if column.name == "status":
                destination.append("status")
                if "status" in old_names:
                    expressions.append(
                        f"COALESCE(status, {_completed_status_sql(old_names)})"
                    )
                else:
                    expressions.append(_completed_status_sql(old_names))
            elif column.name in old_names:
                destination.append(column.name)
                expressions.append(column.name)

        connection.execute(
            text(
                "INSERT INTO writing_sessions ("
                + ", ".join(destination)
                + ") SELECT "
                + ", ".join(expressions)
                + " FROM writing_sessions_legacy"
            )
        )
        connection.execute(text("DROP TABLE writing_sessions_legacy"))


def _postgres_migrate_writing_sessions(
    engine: Engine, columns: list[dict[str, Any]]
) -> None:
    names = {column["name"] for column in columns}
    with engine.begin() as connection:
        if "status" not in names:
            connection.execute(text("ALTER TABLE writing_sessions ADD COLUMN status VARCHAR"))
        for column in ("q53_char_count", "q54_char_count"):
            if column not in names:
                connection.execute(
                    text(f"ALTER TABLE writing_sessions ADD COLUMN {column} INTEGER")
                )

        connection.execute(
            text(
                "UPDATE writing_sessions SET status = "
                + _completed_status_sql(names)
                + " WHERE status IS NULL"
            )
        )
        connection.execute(
            text("ALTER TABLE writing_sessions ALTER COLUMN status SET NOT NULL")
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_writing_sessions_status "
                "ON writing_sessions (status)"
            )
        )
        for column in ("completed_at", "total_time_ms", "grading_json"):
            if column in names:
                connection.execute(
                    text(
                        f"ALTER TABLE writing_sessions ALTER COLUMN {column} DROP NOT NULL"
                    )
                )
        total_time_column = next(
            (column for column in columns if column["name"] == "total_time_ms"),
            None,
        )
        if total_time_column and not isinstance(total_time_column["type"], BigInteger):
            connection.execute(
                text(
                    "ALTER TABLE writing_sessions ALTER COLUMN total_time_ms "
                    "TYPE BIGINT USING total_time_ms::BIGINT"
                )
            )


def prepare_writing_sessions_table(engine: Engine) -> None:
    """Make an existing completed-only table accept in-progress sessions."""
    inspector = inspect(engine)
    if "writing_sessions" not in inspector.get_table_names():
        return

    columns = inspector.get_columns("writing_sessions")
    names = {column["name"] for column in columns}
    nullable = {column["name"]: column.get("nullable", True) for column in columns}
    needs_nullable_change = any(
        not nullable.get(column, True)
        for column in ("completed_at", "total_time_ms", "grading_json")
    )
    needs_columns = not {
        "status",
        "q53_char_count",
        "q54_char_count",
    }.issubset(names)
    total_time_column = next(
        (column for column in columns if column["name"] == "total_time_ms"),
        None,
    )
    needs_type_change = (
        engine.dialect.name == "postgresql"
        and total_time_column is not None
        and not isinstance(total_time_column["type"], BigInteger)
    )
    if not needs_nullable_change and not needs_columns and not needs_type_change:
        return

    if engine.dialect.name == "sqlite":
        _sqlite_rebuild_writing_sessions(engine, columns)
    elif engine.dialect.name == "postgresql":
        _postgres_migrate_writing_sessions(engine, columns)
    else:
        raise RuntimeError(
            f"Unsupported database for writing-session migration: {engine.dialect.name}"
        )


def _merge_legacy_start_rows(engine: Engine, question_asset_base_url: str) -> None:
    inspector = inspect(engine)
    if "writing_session_starts" not in inspector.get_table_names():
        return

    metadata = MetaData()
    starts = Table("writing_session_starts", metadata, autoload_with=engine)
    sessions = WritingSessionRecord.__table__
    with engine.begin() as connection:
        for start in connection.execute(select(starts)).mappings():
            exists = connection.execute(
                select(sessions.c.id).where(sessions.c.id == start["id"])
            ).first()
            if exists:
                continue

            test = get_test(str(start["test_id"])) or {
                "id": start["test_id"],
                "questions": [],
            }
            completed_at = start.get("completed_at")
            connection.execute(
                sessions.insert().values(
                    id=start["id"],
                    test_id=start["test_id"],
                    passcode=start["passcode"],
                    status="finished" if completed_at is not None else "started",
                    started_at=start["started_at"],
                    completed_at=completed_at,
                    total_time_ms=start.get("total_time_ms"),
                    answers_json=empty_session_payload(test, question_asset_base_url),
                    grading_json=None,
                )
            )
        starts.drop(connection)


def _non_whitespace_count(value: object) -> int:
    return len("".join(str(value or "").split()))


def _backfill_session_payloads(engine: Engine, question_asset_base_url: str) -> None:
    with Session(engine) as db:
        changed = False
        for record in db.query(WritingSessionRecord).all():
            payload = record.answers_json
            snapshot = saved_test(payload)
            current_test = snapshot or get_test(record.test_id)
            if current_test is None:
                current_test = {"id": record.test_id, "questions": []}

            answers = {
                str(question_id): answer
                for question_id, answer in saved_answers(payload).items()
                if isinstance(answer, dict)
            }
            upgraded = build_session_payload(
                current_test, answers, question_asset_base_url
            )
            if upgraded != payload:
                record.answers_json = upgraded
                changed = True

            expected_status = (
                "completed"
                if record.grading_json is not None
                else "finished"
                if record.completed_at is not None
                else "started"
            )
            if record.status != expected_status:
                record.status = expected_status
                changed = True

            upgraded_answers = upgraded["answers"]
            if record.q53_char_count is None and "53" in upgraded_answers:
                record.q53_char_count = _non_whitespace_count(
                    upgraded_answers["53"].get("transcription")
                )
                changed = True
            if record.q54_char_count is None and "54" in upgraded_answers:
                record.q54_char_count = _non_whitespace_count(
                    upgraded_answers["54"].get("transcription")
                )
                changed = True

        if changed:
            db.commit()


def migrate_database(engine: Engine, question_asset_base_url: str) -> None:
    """Upgrade the schema, merge start rows, and enrich legacy JSON snapshots."""
    def run() -> None:
        prepare_writing_sessions_table(engine)
        Base.metadata.create_all(bind=engine)
        _merge_legacy_start_rows(engine, question_asset_base_url)
        _backfill_session_payloads(engine, question_asset_base_url)
        with Session(engine) as db:
            seed_language_review(db)

    if engine.dialect.name != "postgresql":
        run()
        return

    # Railway can start multiple workers together. A database-scoped advisory
    # lock ensures only one of them performs startup DDL/backfills at a time.
    lock_id = 8_406_231_047
    with engine.connect() as lock_connection:
        lock_connection.execute(
            text("SELECT pg_advisory_lock(:lock_id)"), {"lock_id": lock_id}
        )
        try:
            run()
        finally:
            lock_connection.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id}
            )
