// 60-40 Calculator - Calendar frontend
// Features in this file:
// - Monday-first calendars (+ week number in month view)
// - Month name header
// - "All Year" view (read-only)
// - Lock past months (global)
// - Auto-grey + lock: weekends + Hungarian public holidays + shifted rest days
//   BUT allow shifted working weekends (working Saturdays) to remain editable
// - Thicker border for "today" cell in month + year view

document.addEventListener("DOMContentLoaded", function () {
  let currentDate = new Date();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const calendarDiv = document.getElementById("calendar");
  const currentMonthYearSpan = document.getElementById("current-month-year");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const todayBtn = document.getElementById("today");
  const allYearBtn = document.getElementById("all-year");
  const monthlyStatsDiv = document.getElementById("monthly-stats");
  const yearlyStatsDiv = document.getElementById("yearly-stats");

  const todayIso = toISO(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());

  // ------------------------------------------------------------
  // Hungary “workday swap” overrides (shifted working weekends/rest days)
  // Keep this list updated if you need more years.
  // ------------------------------------------------------------
  const HU_WORKDAY_SWAPS = {
    // 2025:
    // - Working Saturdays: 2025-05-17, 2025-10-18, 2025-12-13
    // - Shifted rest days: 2025-05-02, 2025-10-24, 2025-12-24
    2025: {
      workingWeekends: ["2025-05-17", "2025-10-18", "2025-12-13"],
      restDays: ["2025-05-02", "2025-10-24", "2025-12-24"]
    },
    // 2026:
    // - Working Saturdays: 2026-01-10, 2026-08-08, 2026-12-12
    // - Shifted rest days: 2026-01-02, 2026-08-21, 2026-12-24
    2026: {
      workingWeekends: ["2026-01-10", "2026-08-08", "2026-12-12"],
      restDays: ["2026-01-02", "2026-08-21", "2026-12-24"]
    }
  };

  // Cache for computed year rules
  const yearRulesCache = new Map();

  function getYearRules(year) {
    if (yearRulesCache.has(year)) return yearRulesCache.get(year);

    const publicHolidays = getHungarianPublicHolidays(year); // Set(YYYY-MM-DD)
    const overrides = HU_WORKDAY_SWAPS[year] || { workingWeekends: [], restDays: [] };

    const rules = {
      publicHolidays,
      workingWeekends: new Set(overrides.workingWeekends || []),
      restDays: new Set(overrides.restDays || [])
    };

    yearRulesCache.set(year, rules);
    return rules;
  }

  function isWeekend(dateObj) {
    const d = dateObj.getDay(); // 0=Sun,6=Sat
    return d === 0 || d === 6;
  }

  function isBlockedDate(iso, dateObj, rules) {
    // Always blocked if it is a public holiday or a shifted rest day
    if (rules.publicHolidays.has(iso) || rules.restDays.has(iso)) return true;

    // Weekends are blocked unless explicitly marked as "working weekend"
    if (isWeekend(dateObj) && !rules.workingWeekends.has(iso)) return true;

    return false;
  }

  function loadCalendar(year, month) {
    fetch(`/api/days?year=${year}&month=${month}`)
      .then((response) => response.json())
      .then((data) => {
        currentMonthYearSpan.textContent = `${year} - ${monthNames[month - 1]}`;
        renderCalendar(year, month, data.days);
        updateStats(year, month);
      });
  }

  function renderCalendar(year, month, daysData) {
    calendarDiv.innerHTML = "";

    const rules = getYearRules(year);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");

    // Week number column
    const weekHeader = document.createElement("th");
    weekHeader.textContent = "Week";
    headerRow.appendChild(weekHeader);

    // Monday-first headers
    weekdays.forEach((day) => {
      const th = document.createElement("th");
      th.textContent = day;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    const firstDay = new Date(year, month - 1, 1);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday=0

    // First displayed Monday (could be in previous month)
    const firstMonday = new Date(year, month - 1, 1 - startDay);

    let weekCount = 0;
    let row = document.createElement("tr");

    // Week number cell for the first row
    let mondayDate = new Date(firstMonday);
    mondayDate.setDate(mondayDate.getDate() + 7 * weekCount);
    let weekCell = document.createElement("td");
    weekCell.textContent = getWeekNumber(mondayDate);
    row.appendChild(weekCell);

    // Empty cells before the 1st day
    for (let i = 0; i < startDay; i++) {
      const cell = document.createElement("td");
      cell.textContent = "";
      row.appendChild(cell);
    }

    const numDays = new Date(year, month, 0).getDate();

    for (let day = 1; day <= numDays; day++) {
      const cell = document.createElement("td");
      cell.textContent = day;

      const iso = toISO(year, month, day);
      const dateObj = new Date(year, month - 1, day);

      // Apply saved state class
      let state = daysData[day] || "empty";
      cell.classList.add(state);

      // Today outline
      if (iso === todayIso) cell.classList.add("today-cell");

      // Blocked (weekend/holiday/rest day) -> grey + NO click handler
      const blocked = isBlockedDate(iso, dateObj, rules);
      if (blocked) {
        cell.classList.add("blocked-day");
        // optional tooltip
        // cell.title = rules.publicHolidays.has(iso) ? "Public holiday" : "Non-working day";
      } else {
        // Editable day: attach click handler
        cell.addEventListener("click", function () {
          // Global lock: allow modifications only for current month
          if (typeof lockPastMonths !== "undefined" && lockPastMonths) {
            const now = new Date();
            if (year !== now.getFullYear() || month !== now.getMonth() + 1) {
              alert("Modifications are locked for months other than the current month.");
              return;
            }
          }

          // Cycle statuses: empty → office → home → day_off → empty
          let newState;
          if (state === "empty") newState = "office";
          else if (state === "office") newState = "home";
          else if (state === "home") newState = "day_off";
          else newState = "empty";

          fetch("/api/day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: iso, state: newState }),
          })
            .then((r) => r.json())
            .then((resp) => {
              if (resp.success) {
                state = newState;
                cell.classList.remove("empty", "office", "home", "day_off");
                cell.classList.add(newState);
                updateStats(year, month);
              } else {
                alert("Error updating status.");
              }
            });
        });
      }

      row.appendChild(cell);

      // Completed week: 1 week col + 7 days
      if (row.children.length - 1 === 7) {
        table.appendChild(row);
        weekCount++;
        row = document.createElement("tr");

        mondayDate = new Date(firstMonday);
        mondayDate.setDate(mondayDate.getDate() + 7 * weekCount);
        weekCell = document.createElement("td");
        weekCell.textContent = getWeekNumber(mondayDate);
        row.appendChild(weekCell);
      }
    }

    // Tail fillers
    if (row.children.length - 1 > 0) {
      while (row.children.length - 1 < 7) {
        const cell = document.createElement("td");
        cell.textContent = "";
        row.appendChild(cell);
      }
      table.appendChild(row);
    }

    calendarDiv.appendChild(table);
  }

  function updateStats(year, month) {
    fetch(`/api/stats?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        monthlyStatsDiv.innerHTML = `
          <h2>Monthly Statistics</h2>
          Office: ${data.office}%<br>
          Home: ${data.home}%<br>
          Total Working Days: ${data.total_working_days}
        `;
        monthlyStatsDiv.style.backgroundColor = data.office >= 60 ? "lightgreen" : "lightcoral";
      });

    fetch(`/api/stats?year=${year}`)
      .then((r) => r.json())
      .then((data) => {
        yearlyStatsDiv.innerHTML = `
          <h2>Yearly Statistics</h2>
          Office: ${data.office}%<br>
          Home: ${data.home}%<br>
          Total Working Days: ${data.total_working_days}
        `;
        yearlyStatsDiv.style.backgroundColor = data.office >= 60 ? "lightgreen" : "lightcoral";
      });
  }

  // -----------------------
  // All Year view (read-only)
  // -----------------------
  function loadYear(year) {
    currentMonthYearSpan.textContent = `${year} - All Year`;
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    Promise.all(
      months.map((m) =>
        fetch(`/api/days?year=${year}&month=${m}`)
          .then((r) => r.json())
          .then((d) => ({ month: m, days: d.days }))
      )
    ).then((monthsData) => {
      monthsData.sort((a, b) => a.month - b.month);
      renderYearGrid(year, monthsData);

      // Yearly stats
      fetch(`/api/stats?year=${year}`)
        .then((r) => r.json())
        .then((data) => {
          yearlyStatsDiv.innerHTML = `
            <h2>Yearly Statistics</h2>
            Office: ${data.office}%<br>
            Home: ${data.home}%<br>
            Total Working Days: ${data.total_working_days}
          `;
          yearlyStatsDiv.style.backgroundColor = data.office >= 60 ? "lightgreen" : "lightcoral";
        });

      monthlyStatsDiv.innerHTML = `
        <h2>Monthly Statistics</h2>
        <em>Shown per-month only in Month view.</em>
      `;
      monthlyStatsDiv.style.backgroundColor = "";
    });
  }

  function renderYearGrid(year, monthsData) {
    calendarDiv.innerHTML = "";

    const rules = getYearRules(year);

    const grid = document.createElement("div");
    grid.id = "year-grid";
    grid.className = "year-grid";

    monthsData.forEach(({ month, days }) => {
      const card = document.createElement("div");
      card.className = "month-card";

      const title = document.createElement("div");
      title.className = "month-title";
      title.textContent = monthNames[month - 1];
      card.appendChild(title);

      const table = document.createElement("table");
      const headerRow = document.createElement("tr");

      weekdays.forEach((d) => {
        const th = document.createElement("th");
        th.textContent = d;
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);

      const firstDay = new Date(year, month - 1, 1);
      const startDay = (firstDay.getDay() + 6) % 7;

      let row = document.createElement("tr");
      for (let i = 0; i < startDay; i++) {
        const td = document.createElement("td");
        td.textContent = "";
        row.appendChild(td);
      }

      const numDays = new Date(year, month, 0).getDate();
      for (let d = 1; d <= numDays; d++) {
        const td = document.createElement("td");
        td.textContent = d;

        const iso = toISO(year, month, d);
        const dateObj = new Date(year, month - 1, d);

        const state = days[d] || "empty";
        td.classList.add(state);

        // Today outline
        if (iso === todayIso) td.classList.add("today-cell");

        // Blocked days are grey (year view is read-only anyway)
        if (isBlockedDate(iso, dateObj, rules)) {
          td.classList.add("blocked-day");
        }

        row.appendChild(td);

        if (row.children.length === 7) {
          table.appendChild(row);
          row = document.createElement("tr");
        }
      }

      if (row.children.length > 0) {
        while (row.children.length < 7) {
          const td = document.createElement("td");
          td.textContent = "";
          row.appendChild(td);
        }
        table.appendChild(row);
      }

      card.appendChild(table);
      grid.appendChild(card);
    });

    calendarDiv.appendChild(grid);
  }

  // -----------------------
  // Controls
  // -----------------------
  prevMonthBtn.addEventListener("click", function () {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
  });

  nextMonthBtn.addEventListener("click", function () {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
  });

  todayBtn.addEventListener("click", function () {
    currentDate = new Date();
    loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
  });

  allYearBtn.addEventListener("click", function () {
    loadYear(currentDate.getFullYear());
  });

  // Initial load (month view)
  loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
});

// -----------------------
// Helpers
// -----------------------
function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function toISO(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

// ISO week number
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

// Hungarian official public holidays (plus movable ones)
// We return only the “public holiday” dates (not Sundays like Easter Sunday).
function getHungarianPublicHolidays(year) {
  const holidays = new Set();

  // Fixed-date holidays
  holidays.add(toISO(year, 1, 1));   // New Year's Day
  holidays.add(toISO(year, 3, 15));  // National Holiday
  holidays.add(toISO(year, 5, 1));   // Labour Day
  holidays.add(toISO(year, 8, 20));  // State Foundation Day
  holidays.add(toISO(year, 10, 23)); // 1956 Memorial Day
  holidays.add(toISO(year, 11, 1));  // All Saints' Day
  holidays.add(toISO(year, 12, 25)); // Christmas
  holidays.add(toISO(year, 12, 26)); // Christmas (2nd day)

  // Movable holidays based on Easter
  const easterSunday = getEasterSunday(year);
  const goodFriday = addDays(easterSunday, -2);
  const easterMonday = addDays(easterSunday, 1);
  const pentecostMonday = addDays(easterSunday, 50);

  holidays.add(toISO(goodFriday.getFullYear(), goodFriday.getMonth() + 1, goodFriday.getDate()));
  holidays.add(toISO(easterMonday.getFullYear(), easterMonday.getMonth() + 1, easterMonday.getDate()));
  holidays.add(toISO(pentecostMonday.getFullYear(), pentecostMonday.getMonth() + 1, pentecostMonday.getDate()));

  return holidays;
}

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
