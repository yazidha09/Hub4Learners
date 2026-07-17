import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Add it to backend/.env")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # test connection before using it, reconnect if dropped
    pool_recycle=300,        # recycle connections after 5 min to avoid Neon idle timeouts
    pool_size=20,            # raised from 5 — supports concurrent dashboard/analytics fan-out
    max_overflow=30,         # absorb traffic spikes without crushing connections
    pool_timeout=30,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()