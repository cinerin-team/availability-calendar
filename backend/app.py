from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from . import models, schemas
from .database import engine, SessionLocal

# Inicializálás
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Jelszó hashelés konfiguráció
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Dependency az adatbázis kapcsolathoz
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# Login végpont
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not db_user or not pwd_context.verify(form_data.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    return {"access_token": form_data.username, "token_type": "bearer"}

# Tesztoldal
@app.get("/protected")
async def protected_route(token: str = Depends(oauth2_scheme)):
    return {"message": "Welcome to the protected route!", "token": token}