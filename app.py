import os
import json
from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash
from datetime import datetime, date
import calendar
from functools import wraps

app = Flask(__name__)
app.secret_key = "this-is-a-secret-key"  # For production, use a stronger random key

# Data file paths
USERS_FILE = "data/users.json"
DAY_STATES_FILE = "data/day_states.json"

# Ensure the data folder exists
if not os.path.exists("data"):
    os.makedirs("data")

# Load users
if os.path.exists(USERS_FILE):
    with open(USERS_FILE, "r") as f:
        try:
            users = json.load(f)
        except json.JSONDecodeError:
            users = {}
else:
    users = {}

# If no admin user exists, create one
if "admin" not in users:
    users["admin"] = "admin123"
    with open(USERS_FILE, "w") as f:
        json.dump(users, f)

def save_users():
    with open(USERS_FILE, "w") as f:
        json.dump(users, f)

# Load calendar data (stored per user)
if os.path.exists(DAY_STATES_FILE):
    with open(DAY_STATES_FILE, "r") as f:
        try:
            day_states_all = json.load(f)
        except json.JSONDecodeError:
            day_states_all = {}
else:
    day_states_all = {}

def save_day_states():
    with open(DAY_STATES_FILE, "w") as f:
        json.dump(day_states_all, f)

def get_user_day_states(username):
    """If the user has no calendar data yet, initialize an empty dictionary."""
    if username not in day_states_all:
        day_states_all[username] = {}
    return day_states_all[username]

# Login required decorator
def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
@login_required
def index():
    # Main page shows the logged-in user's calendar
    return render_template("index.html", username=session["username"])

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if not username or not password:
            flash("Please provide both username and password.")
            return redirect(url_for("register"))
        if username in users:
            flash("Username already taken.")
            return redirect(url_for("register"))
        users[username] = password
        save_users()
        flash("Registration successful! You can now log in.")
        return redirect(url_for("login"))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if username in users and users[username] == password:
            session["username"] = username
            flash("Logged in successfully!")
            return redirect(url_for("index"))
        else:
            flash("Incorrect username or password.")
            return redirect(url_for("login"))
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop("username", None)
    flash("You have been logged out.")
    return redirect(url_for("login"))

@app.route("/api/days", methods=["GET"])
@login_required
def get_days():
    username = session["username"]
    day_states = get_user_day_states(username)
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
@login_required
def update_day():
    username = session["username"]
    day_states = get_user_day_states(username)
    data = request.get_json()
    if not data or "date" not in data or "state" not in data:
        return jsonify({"error": "Invalid data"}), 400
    day = data["date"]
    state = data["state"]
    if state not in ["empty", "office", "home", "day_off"]:
        return jsonify({"error": "Invalid state"}), 400
    day_states[day] = state
    save_day_states()  # Save changes to file
    return jsonify({"success": True, "date": day, "state": state})

def calculate_stats(day_states, year, month=None):
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
        # Only count office and home as work days (day_off is not counted)
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
@login_required
def stats():
    username = session["username"]
    day_states = get_user_day_states(username)
    year = request.args.get("year")
    if not year:
        now = datetime.now()
        year = now.year
    else:
        year = int(year)
    month = request.args.get("month")
    if month:
        month = int(month)
        result = calculate_stats(day_states, year, month)
        result["year"] = year
        result["month"] = month
    else:
        result = calculate_stats(day_states, year)
        result["year"] = year
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9090, debug=True)
