from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Date, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from enum import Enum as PyEnum

DATABASE_URL = "postgresql://user:password@db:5432/calendar_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=True, bind=engine)
Base = declarative_base()

app = FastAPI()

class DayType(PyEnum):
    HOME_OFFICE = "home_office"
    OFFICE = "office"
    HOLIDAY = "holiday"

class CalendarEntry(Base):
    __tablename__ = "calendar_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True)
    date = Column(Date, index=True)
    type = Column(Enum(DayType), index=True)

Base.metadata.create_all(bind=engine)

class EntryCreate(BaseModel):
    date: str
    type: DayType

@app.post("/calendar")
def create_entry(entry: EntryCreate, db: Session = Depends(SessionLocal)):
    db_entry = CalendarEntry(user_email="test@example.com", date=entry.date, type=entry.type)
    db.add(db_entry)
    db.commit()
    return {"message": "Entry created successfully!"}

@app.get("/calendar")
def get_entries(db: Session = Depends(SessionLocal)):
    entries = db.query(CalendarEntry).filter_by(user_email="test@example.com").all()
    return entries

