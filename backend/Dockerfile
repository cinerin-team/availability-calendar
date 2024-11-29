FROM python:3.11-slim

WORKDIR /app

# Telepítsd az összes szükséges rendszerfüggőséget, például build-essential és libffi
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    curl \
    && apt-get clean

COPY requirements.txt .

# Telepítsd a Python csomagokat
RUN pip install --no-cache-dir bcrypt==4.0.1 python-multipart && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]