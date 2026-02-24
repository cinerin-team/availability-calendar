import os
import json
import csv
import re
import html as html_lib
import urllib.request
from typing import Optional, Tuple, List
from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash, Response
from datetime import datetime, date, timedelta
import calendar
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "cirm0sc1ca-haj-hová-lett-avaj1!G"

DATA_DIR = "data"
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
DAY_STATES_FILE = os.path.join(DATA_DIR, "day_states.json")

os.makedirs(DATA_DIR, exist_ok=True)

# ---------------------------
# Config helpers (reload + atomic save)
# ---------------------------
def load_config() -> dict:
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception:
        cfg = {}

    # defaults
    cfg.setdefault("lock_past_months", True)
    cfg.setdefault("hu_workday_swaps", {})
    cfg.setdefault("swap_autofetch", {
        "enabled": True,
        "attempt_ttl_hours": 24,
        "max_scan": 60,
        "max_future_years_ahead": 2
    })
    return cfg

def save_config_atomic(cfg: dict) -> None:
    tmp = CONFIG_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CONFIG_FILE)

# ---------------------------
# Users & day states
# ---------------------------
def load_users() -> dict:
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_users(users: dict) -> None:
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def load_day_states_all() -> dict:
    if os.path.exists(DAY_STATES_FILE):
        try:
            with open(DAY_STATES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_day_states_all(day_states_all: dict) -> None:
    with open(DAY_STATES_FILE, "w", encoding="utf-8") as f:
        json.dump(day_states_all, f, ensure_ascii=False, indent=2)

users = load_users()

# Ensure admin exists (hashed)
if "admin@example.com" not in users:
    users["admin@example.com"] = generate_password_hash("admin123")
    save_users(users)

day_states_all = load_day_states_all()

def get_user_day_states(email: str) -> dict:
    if email not in day_states_all:
        day_states_all[email] = {}
    return day_states_all[email]

# ---------------------------
# Auth decorator
# ---------------------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "email" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

# ---------------------------
# HU public holidays (fixed + movable)
# ---------------------------
HU_MONTHS = {
    "január": 1, "február": 2, "március": 3, "április": 4, "május": 5, "június": 6,
    "július": 7, "augusztus": 8, "szeptember": 9, "október": 10, "november": 11, "december": 12
}

def easter_sunday(year: int) -> date:
    # Meeus/Jones/Butcher algorithm
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)

def hungarian_public_holidays(year: int) -> set:
    holidays = set()
    fixed = [
        (1, 1), (3, 15), (5, 1), (8, 20), (10, 23), (11, 1), (12, 25), (12, 26)
    ]
    for m, d in fixed:
        holidays.add(f"{year:04d}-{m:02d}-{d:02d}")

    es = easter_sunday(year)
    good_friday = es - timedelta(days=2)
    easter_monday = es + timedelta(days=1)
    pentecost_monday = es + timedelta(days=50)

    holidays.add(good_friday.isoformat())
    holidays.add(easter_monday.isoformat())
    holidays.add(pentecost_monday.isoformat())
    return holidays

# ---------------------------
# Auto-fetch swaps from decree (best-effort)
# ---------------------------
def _http_get(url: str, timeout_sec: int = 7) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "availability-calendar/1.0 (+https://github.com/cinerin-team/availability-calendar)"}
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        raw = resp.read()
    return raw.decode("utf-8", errors="ignore")

def _strip_html(text: str) -> str:
    text = html_lib.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def _parse_swaps_from_text(target_year: int, text: str) -> Optional[Tuple[List[str], List[str]]]:
    t = text.lower()

    if f"{target_year}. évi munkaszüneti napok körüli" not in t and f"{target_year} évi munkaszüneti napok körüli" not in t:
        return None

    month_group = "(" + "|".join(HU_MONTHS.keys()) + ")"
    pair_re = re.compile(
        rf"({target_year})\.\s*{month_group}\s*(\d{{1,2}})\.\s*,?\s*[a-záéíóöőúüű]+\s*munkanap\s*[,;–\- ]+\s*"
        rf"({target_year})\.\s*{month_group}\s*(\d{{1,2}})\.\s*,?\s*[a-záéíóöőúüű]+\s*pihenőnap",
        re.IGNORECASE
    )

    working_weekends: List[str] = []
    rest_days: List[str] = []

    for m in pair_re.finditer(text):
        work_month_name = m.group(2).lower()
        work_day = int(m.group(3))
        work_month = HU_MONTHS.get(work_month_name)

        rest_month_name = m.group(5).lower()
        rest_day = int(m.group(6))
        rest_month = HU_MONTHS.get(rest_month_name)

        if not work_month or not rest_month:
            continue

        work_iso = f"{target_year:04d}-{work_month:02d}-{work_day:02d}"
        rest_iso = f"{target_year:04d}-{rest_month:02d}-{rest_day:02d}"

        working_weekends.append(work_iso)
        rest_days.append(rest_iso)

    if not working_weekends and not rest_days:
        return None

    def uniq(seq: List[str]) -> List[str]:
        seen = set()
        out: List[str] = []
        for x in seq:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out

    return (uniq(working_weekends), uniq(rest_days))

def try_autofetch_swaps(target_year: int, cfg: dict) -> Tuple[bool, str]:
    autofetch = cfg.get("swap_autofetch", {})
    if not autofetch.get("enabled", True):
        return (False, "Auto-fetch disabled")

    current_year = datetime.now().year
    max_ahead = int(autofetch.get("max_future_years_ahead", 2))
    if target_year > current_year + max_ahead:
        return (False, f"Year {target_year} is too far in the future to auto-fetch yet")

    year_key = str(target_year)
    swaps = cfg.setdefault("hu_workday_swaps", {}).setdefault(year_key, {})

    ttl_hours = int(autofetch.get("attempt_ttl_hours", 24))
    last_attempt = swaps.get("last_attempt")
    if last_attempt:
        try:
            last_dt = datetime.fromisoformat(last_attempt)
            if (datetime.now() - last_dt) < timedelta(hours=ttl_hours):
                return (False, f"Auto-fetch already attempted recently for {target_year}")
        except Exception:
            pass

    swaps["last_attempt"] = datetime.now().isoformat(timespec="seconds")

    decree_year = target_year - 1
    max_scan = int(autofetch.get("max_scan", 60))
    yy = decree_year % 100

    for n in range(1, max_scan + 1):
        docid = f"a{yy:02d}{n:04d}.ngm"
        url = f"https://net.jogtar.hu/jogszabaly?docid={docid}"
        try:
            html_text = _http_get(url, timeout_sec=7)
        except Exception:
            continue

        plain = _strip_html(html_text)
        parsed = _parse_swaps_from_text(target_year, plain)
        if parsed:
            working_weekends, rest_days = parsed

            swaps["working_weekends"] = working_weekends
            swaps["rest_days"] = rest_days
            swaps["source_url"] = url
            swaps["fetched_at"] = datetime.now().isoformat(timespec="seconds")
            swaps["status"] = "ok"
            swaps.pop("error", None)

            save_config_atomic(cfg)
            return (True, f"Fetched swaps for {target_year} from {docid}")

    swaps["status"] = "missing"
    swaps["error"] = f"Could not locate decree content for {target_year} (not published yet or unreachable)"
    save_config_atomic(cfg)
    return (False, swaps["error"])

# ---------------------------
# Routes
# ---------------------------
@app.route("/")
@login_required
def index():
    cfg = load_config()
    return render_template("index.html", email=session["email"], lock_past_months=cfg["lock_past_months"])

@app.route("/register", methods=["GET", "POST"])
def register():
    global users
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        if not email or not password:
            flash("Please provide both email and password.")
            return redirect(url_for("register"))
        if email in users:
            flash("Email already registered.")
            return redirect(url_for("register"))
        users[email] = generate_password_hash(password)
        save_users(users)
        flash("Registration successful! You can now log in.")
        return redirect(url_for("login"))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    global users
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        if email in users and check_password_hash(users[email], password):
            session["email"] = email
            flash("Logged in successfully!")
            return redirect(url_for("index"))
        flash("Incorrect email or password.")
        return redirect(url_for("login"))
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop("email", None)
    flash("You have been logged out.")
    return redirect(url_for("login"))

@app.route("/change_password", methods=["GET", "POST"])
@login_required
def change_password():
    global users
    email = session["email"]
    if request.method == "POST":
        current_password = request.form.get("current_password")
        new_password = request.form.get("new_password")
        confirm_password = request.form.get("confirm_password")
        if not check_password_hash(users.get(email), current_password):
            flash("Current password is incorrect.")
            return redirect(url_for("change_password"))
        if new_password != confirm_password:
            flash("New passwords do not match.")
            return redirect(url_for("change_password"))
        users[email] = generate_password_hash(new_password)
        save_users(users)
        flash("Password changed successfully!")
        return redirect(url_for("index"))
    return render_template("change_password.html")

@app.route("/api/days", methods=["GET"])
@login_required
def get_days():
    email = session["email"]
    day_states = get_user_day_states(email)

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
    for d in range(1, num_days + 1):
        iso = date(year, month, d).isoformat()
        days[str(d)] = day_states.get(iso, "empty")
    return jsonify({"year": year, "month": month, "days": days})

@app.route("/api/day", methods=["POST"])
@login_required
def update_day():
    global day_states_all
    email = session["email"]
    day_states = get_user_day_states(email)

    data = request.get_json()
    if not data or "date" not in data or "state" not in data:
        return jsonify({"error": "Invalid data"}), 400

    iso = data["date"]
    state = data["state"]
    if state not in ["empty", "office", "home", "day_off"]:
        return jsonify({"error": "Invalid state"}), 400

    day_states[iso] = state
    save_day_states_all(day_states_all)
    return jsonify({"success": True, "date": iso, "state": state})

def calculate_stats(day_states: dict, year: int, month: Optional[int] = None) -> dict:
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

    return {"office": office_percent, "home": home_percent, "total_working_days": total_work}

@app.route("/api/stats", methods=["GET"])
@login_required
def stats():
    email = session["email"]
    day_states = get_user_day_states(email)

    year = request.args.get("year")
    if not year:
        year = datetime.now().year
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

@app.route("/api/calendar_rules", methods=["GET"])
@login_required
def calendar_rules():
    cfg = load_config()

    year_param = request.args.get("year")
    if not year_param:
        return jsonify({"error": "Missing year"}), 400
    try:
        year = int(year_param)
    except ValueError:
        return jsonify({"error": "Invalid year"}), 400

    public_holidays = sorted(list(hungarian_public_holidays(year)))

    year_key = str(year)
    swaps = cfg.get("hu_workday_swaps", {}).get(year_key, {})
    working_weekends = swaps.get("working_weekends", []) or []
    rest_days = swaps.get("rest_days", []) or []

    swap_status = swaps.get("status")
    swap_message = None

    if not working_weekends and not rest_days:
        ok, msg = try_autofetch_swaps(year, cfg)
        cfg2 = load_config()
        swaps2 = cfg2.get("hu_workday_swaps", {}).get(year_key, {})
        working_weekends = swaps2.get("working_weekends", []) or []
        rest_days = swaps2.get("rest_days", []) or []
        swap_status = swaps2.get("status", "missing")
        swap_message = msg if not ok else None
    else:
        swap_status = swap_status or "ok"

    if swap_status != "ok" and not swap_message:
        swap_message = swaps.get("error") or f"No swap data available for {year} yet."

    return jsonify({
        "year": year,
        "public_holidays": public_holidays,
        "working_weekends": working_weekends,
        "rest_days": rest_days,
        "swap_status": swap_status,
        "swap_message": swap_message
    })

@app.route("/admin/toggle_lock")
@login_required
def toggle_lock():
    if session["email"] != "admin@example.com":
        flash("Access denied.")
        return redirect(url_for("index"))

    cfg = load_config()
    value = request.args.get("value", "true").lower()
    cfg["lock_past_months"] = True if value == "true" else False
    save_config_atomic(cfg)

    flash("Lock configuration updated.")
    return redirect(url_for("admin_stats"))

@app.route("/admin/stats")
@login_required
def admin_stats():
    if session["email"] != "admin@example.com":
        flash("Access denied.")
        return redirect(url_for("index"))

    cfg = load_config()
    year_param = request.args.get("year")
    try:
        current_year = int(year_param) if year_param else datetime.now().year
    except ValueError:
        current_year = datetime.now().year

    stats_data = []
    for email in users:
        if email == "admin@example.com":
            continue
        user_day_states = day_states_all.get(email, {})
        monthly_stats = {m: calculate_stats(user_day_states, current_year, m) for m in range(1, 13)}
        yearly_stats = calculate_stats(user_day_states, current_year)
        stats_data.append({"email": email, "monthly": monthly_stats, "yearly": yearly_stats})

    return render_template("admin_stats.html", stats_data=stats_data, current_year=current_year, config=cfg)

@app.route("/admin/reset_password/<string:user_email>")
@login_required
def admin_reset_password(user_email):
    global users
    if session["email"] != "admin@example.com":
        flash("Access denied.")
        return redirect(url_for("index"))
    if user_email not in users:
        flash("User not found.")
        return redirect(url_for("admin_stats"))
    users[user_email] = generate_password_hash("apple123")
    save_users(users)
    flash(f"Password for {user_email} has been reset to apple123.")
    return redirect(url_for("admin_stats"))

@app.route("/admin/export_csv")
@login_required
def export_csv():
    if session["email"] != "admin@example.com":
        flash("Access denied.")
        return redirect(url_for("index"))
    output = [["User Email", "Date", "Status"]]
    for email, days in day_states_all.items():
        for day_str, status in days.items():
            output.append([email, day_str, status])
    csv_data = "\n".join([",".join(row) for row in output])
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=day_states.csv"}
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9090, debug=True)
