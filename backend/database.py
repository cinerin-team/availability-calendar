from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Az adatbázis URL-je (SQLite például, de PostgreSQL/MariaDB esetén módosítsd)
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

# Motor létrehozása
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# SessionLocal az adatbázis műveletekhez
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Az SQLAlchemy ORM alap osztályok
Base = declarative_base()