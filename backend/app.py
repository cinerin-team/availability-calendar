from datetime import datetime, timedelta

import jwt
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.database import engine, SessionLocal, Base
from backend.models import User, CalendarEntry
from .schemas import UserCreate, Token, CalendarUpdate

SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"

Base.metadata.create_all(bind=engine)

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create default user
def init_db():
    db = SessionLocal()
    if not db.query(User).filter(User.email == "a@a.a").first():
        user = User(email="a@a.a", hashed_password=pwd_context.hash("a"))
        db.add(user)
        db.commit()


init_db()


# Register user
@app.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = pwd_context.hash(user.password)
    new_user = User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}


# Login and generate token
@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token_data = {"sub": user.email, "exp": datetime.utcnow() + timedelta(hours=1)}
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


# Get user calendar
@app.get("/calendar")
def get_calendar(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_email = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["sub"]
    user = db.query(User).filter(User.email == user_email).first()
    return db.query(CalendarEntry).filter(CalendarEntry.user_id == user.id).all()


# Update calendar entry
@app.post("/calendar")
def update_calendar(entry: CalendarUpdate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_email = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["sub"]
    user = db.query(User).filter(User.email == user_email).first()
    db_entry = db.query(CalendarEntry).filter(CalendarEntry.user_id == user.id,
                                              CalendarEntry.date == entry.date).first()
    if db_entry:
        db_entry.type = entry.type
    else:
        db_entry = CalendarEntry(user_id=user.id, date=entry.date, type=entry.type)
        db.add(db_entry)
    db.commit()
    return {"message": "Calendar updated successfully"}
