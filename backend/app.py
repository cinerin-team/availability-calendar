from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from backend import models, schemas
from backend.database import engine, SessionLocal


# Inicializálás
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Jelszó hash konfiguráció
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dependency az adatbázis kapcsolat kezelésére
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Regisztráció végpont
@app.post("/register", response_model=schemas.UserResponse)
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Ellenőrizzük, hogy a felhasználó már létezik-e
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Jelszó hashelése és mentés
    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

# Bejelentkezés végpont
@app.post("/login")
async def login_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Felhasználó keresése
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    return {"message": "Login successful"}