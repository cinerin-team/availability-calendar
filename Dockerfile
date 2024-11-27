FROM python:3.11-slim

WORKDIR /app

COPY ./backend /app/backend

RUN pip install --no-cache-dir -r /app/backend/requirements.txt

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]