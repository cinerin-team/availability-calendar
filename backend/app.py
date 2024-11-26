from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Date, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
from datetime import date

# Adatbázis beállítás
DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=True, bind=engine)
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# FastAPI alkalmazás
app = FastAPI()

# CORS middleware a frontend és backend közötti kommunikációhoz
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Fejlesztéshez minden forrást engedélyez
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Regisztrációs végpont
@app.post("/register")
def register_user(user: UserCreate, db: Session = Depends(SessionLocal)):
    # Ellenőrizd, hogy a felhasználó már létezik-e
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = pwd_context.hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    return {"message": "User registered successfully."}

# Bejelentkezési végpont
@app.post("/login")
def login_user(user: UserCreate, db: Session = Depends(SessionLocal)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"user_id": db_user.id}

# Naptárbejegyzés hozzáadása
@app.post("/entries")
def add_entry(entry: EntryCreate, user_id: int, db: Session = Depends(SessionLocal)):
    db_entry = CalendarEntry(user_id=user_id, date=entry.date, type=entry.type)
    db.add(db_entry)
    db.commit()
    return {"message": "Entry added successfully."}

# Naptárbejegyzések lekérdezése
@app.get("/entries")
def get_entries(user_id: int, db: Session = Depends(SessionLocal)):
    entries = db.query(CalendarEntry).filter_by(user_id=user_id).all()
    return entries
