import logging
from datetime import date

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Date, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

# Inicializáció
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Adatbázis modellek
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)


class CalendarEntry(Base):
    __tablename__ = "calendar_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, index=True)
    type = Column(String)
    user = relationship("User", back_populates="entries")


User.entries = relationship("CalendarEntry", back_populates="user")

Base.metadata.create_all(bind=engine)


# Pydantic modellek
class UserCreate(BaseModel):
    email: str
    password: str


class EntryCreate(BaseModel):
    date: date
    type: str


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/login")
async def login_user(user: UserCreate, request: Request, db: Session = Depends(SessionLocal)):
    raw_data = await request.json()  # A nyers JSON adat naplózása
    logger.debug(f"Raw data received for login: {raw_data}")
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        logger.debug("Invalid credentials provided.")
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"user_id": db_user.id}


# Naptárbejegyzés hozzáadása
@app.post("/entries")
def add_entry(entry: EntryCreate, user_id: int, db: Session = Depends(SessionLocal)):
    db_entry = CalendarEntry(user_id=user_id, date=entry.date, type=entry.type)
    db.add(db_entry)
# Regisztráció végpont
@app.post("/register", response_model=schemas.UserResponse)
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# Naptárbejegyzések lekérdezése
@app.get("/entries")
def get_entries(user_id: int, db: Session = Depends(SessionLocal)):
    entries = db.query(CalendarEntry).filter_by(user_id=user_id).all()
    return entries
# Login végpont
@app.post("/login")
async def login_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    return {"message": "Login successful"}
