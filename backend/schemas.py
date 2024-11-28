from pydantic import BaseModel
from datetime import date


class UserCreate(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class CalendarUpdate(BaseModel):
    date: date
    type: str