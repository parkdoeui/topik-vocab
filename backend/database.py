from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings

# Normalize postgres:// → postgresql:// (Railway/Neon may emit the old scheme)
_url = settings.database_url
if _url.startswith("postgres://"):
    _url = "postgresql://" + _url[len("postgres://"):]

engine_kwargs: dict = {}
if _url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
