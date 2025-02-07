FROM python:3.9-slim

WORKDIR /app

# Függőségek telepítése
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Forráskód másolása
COPY . .

EXPOSE 9090

CMD ["python", "app.py"]
