import os
import json
from flask import Flask, request, jsonify, render_template
from datetime import datetime, date
import calendar

app = Flask(__name__)

DATA_FILE = "data/day_states.json"

# Adatok betöltése fájlból, ha létezik, egyébként üres dictionary
if os.path.exists(DATA_FILE):
    with open(DATA_FILE, "r") as f:
        try:
            day_states = json.load(f)
        except json.JSONDecodeError:
            day_states = {}
else:
    day_states = {}

def save_data():
    """Az aktuális day_states dictionary mentése a DATA_FILE-ba."""
    with open(DATA_FILE, "w") as f:
        json.dump(day_states, f)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/days", methods=["GET"])
def get_days():
    """
    Lekérdezi az adott év és hónap napjainak állapotát.
    Ha nincsenek paraméterek, az aktuális év/hónap adatai jelennek meg.
    """
    year = request.args.get("year")
    month = request.args.get("month")
    if not year or not month:
        now = datetime.now()
        year = now.year
        month = now.month
    else:
        year = int(year)
        month = int(month)
    num_days = calendar.monthrange(year, month)[1]
    days = {}
    for day in range(1, num_days+1):
        day_str = date(year, month, day).isoformat()
        state = day_states.get(day_str, "empty")
        days[str(day)] = state
    return jsonify({"year": year, "month": month, "days": days})

@app.route("/api/day", methods=["POST"])
def update_day():
    """
    Frissíti egy adott nap állapotát.
    Várt JSON példa: { "date": "2025-02-07", "state": "office" }
    """
    data = request.get_json()
    if not data or "date" not in data or "state" not in data:
        return jsonify({"error": "Invalid data"}), 400
    day = data["date"]
    state = data["state"]
    if state not in ["empty", "office", "home"]:
        return jsonify({"error": "Invalid state"}), 400
    day_states[day] = state
    save_data()  # Mentés fájlba
    return jsonify({"success": True, "date": day, "state": state})

def calculate_stats(year, month=None):
    """
    Számolja ki az irodai és otthoni munkanapok százalékos arányát.
    Ha month értéke adott, az adott hónapra számol; különben az egész évre.
    A százalék a munkanapok (irodai + otthoni) arányában értendő.
    """
    office_count = 0
    home_count = 0
    total_work = 0
    for day_str, state in day_states.items():
        try:
            d = datetime.strptime(day_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        if d.year != year:
            continue
        if month is not None and d.month != month:
            continue
        if state == "office":
            office_count += 1
            total_work += 1
        elif state == "home":
            home_count += 1
            total_work += 1
    if total_work > 0:
        office_percent = round((office_count / total_work) * 100, 2)
        home_percent = round((home_count / total_work) * 100, 2)
    else:
        office_percent = 0
        home_percent = 0
    return {"office": office_percent, "home": home_percent, "total_work_days": total_work}

@app.route("/api/stats", methods=["GET"])
def stats():
    """
    API végpont statisztikához.
    Paraméterek: year (kötelező) és opcionálisan month.
    """
    year = request.args.get("year")
    if not year:
        now = datetime.now()
        year = now.year
    else:
        year = int(year)
    month = request.args.get("month")
    if month:
        month = int(month)
        result = calculate_stats(year, month)
        result["year"] = year
        result["month"] = month
    else:
        result = calculate_stats(year)
        result["year"] = year
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9090, debug=True)
