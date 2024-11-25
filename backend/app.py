from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Entry(BaseModel):
    date: str
    type: str

@app.post("/calendar")
def add_entry(entry: Entry):
    return {"message": f"Entry for {entry.date} as {entry.type} added."}

@app.get("/calendar")
def get_entries():
    return [{"date": "2024-01-01", "type": "home_office"}]
