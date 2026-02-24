const rulesCache = new Map();

function fetchRulesForYear(year) {
  if (rulesCache.has(year)) return Promise.resolve(rulesCache.get(year));

  return fetch(`/api/calendar_rules?year=${year}`)
    .then(r => r.json())
    .then(data => {
      const rules = {
        publicHolidays: new Set(data.public_holidays || []),
        workingWeekends: new Set(data.working_weekends || []),
        restDays: new Set(data.rest_days || []),
        swapStatus: data.swap_status || "ok",
        swapMessage: data.swap_message || null
      };
      rulesCache.set(year, rules);
      return rules;
    });
}

function isWeekend(dateObj) {
  const d = dateObj.getDay(); // 0=Sun, 6=Sat
  return d === 0 || d === 6;
}

function isBlockedDate(iso, dateObj, rules) {
  if (rules.publicHolidays.has(iso) || rules.restDays.has(iso)) return true;
  if (isWeekend(dateObj) && !rules.workingWeekends.has(iso)) return true;
  return false;
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }
function toISO(year, month, day) { return `${year}-${pad2(month)}-${pad2(day)}`; }

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function ensureWarningEl() {
  let el = document.getElementById("rules-warning");
  if (!el) {
    el = document.createElement("span");
    el.id = "rules-warning";
    el.className = "rules-warning";
    const header = document.getElementById("current-month-year");
    header.insertAdjacentElement("afterend", el);
  }
  return el;
}

function setWarning(rules, year) {
  const el = ensureWarningEl();
  if (!rules || rules.swapStatus === "ok") {
    el.textContent = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "inline";
  el.textContent = ` ⚠ No official workday-swap data for ${year} yet.`;
  if (rules.swapMessage) el.title = rules.swapMessage;
}

document.addEventListener("DOMContentLoaded", function () {
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

  const nowReal = new Date();
  const todayIso = toISO(nowReal.getFullYear(), nowReal.getMonth() + 1, nowReal.getDate());

  // View state
  let viewDate = new Date(nowReal.getFullYear(), nowReal.getMonth(), 1); // always 1st day to avoid overflow
  let viewMode = "month"; // "month" | "year"

  function headerMonth(y, m) {
    currentMonthYearSpan.textContent = `${y} - ${monthNames[m - 1]}`;
  }

  function headerYear(y) {
    currentMonthYearSpan.textContent = `${y} - All Year`;
  }

  function updateStats(year, month) {
    fetch(`/api/stats?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => {
        monthlyStatsDiv.innerHTML = `
          <h2>Monthly Statistics</h2>
          Office: ${data.office}%<br>
          Home: ${data.home}%<br>
          Total Working Days: ${data.total_working_days}
        `;
        monthlyStatsDiv.style.backgroundColor = data.office >= 60 ? "lightgreen" : "lightcoral";
      });

    fetch(`/api/stats?year=${year}`)
      .then(r => r.json())
      .then(data => {
        yearlyStatsDiv.innerHTML = `
          <h2>Yearly Statistics</h2>
          Office: ${data.office}%<br>
          Home: ${data.home}%<br>
          Total Working Days: ${data.total_working_days}
        `;
        yearlyStatsDiv.style.backgroundColor = data.office >= 60 ? "lightgreen" : "lightcoral";
      });
  }

  function loadMonthFromViewDate() {
    viewMode = "month";
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth() + 1;

    Promise.all([
      fetchRulesForYear(y),
      fetch(`/api/days?year=${y}&month=${m}`).then(r => r.json())
    ]).then(([rules, data]) => {
      headerMonth(y, m);
      setWarning(rules, y);
      renderMonthTable(y, m, data.days, rules);
      updateStats(y, m);
    });
  }

  function loadYear(year) {
    viewMode = "year";
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    Promise.all([
      fetchRulesForYear(year),
      Promise.all(months.map(m =>
        fetch(`/api/days?year=${year}&month=${m}`)
          .then(r => r.json())
          .then(d => ({ month: m, days: d.days }))
      ))
    ]).then(([rules, monthsData]) => {
      monthsData.sort((a, b) => a.month - b.month);
      headerYear(year);
      setWarning(rules, year);
      renderYearGrid(year, monthsData, rules);

      fetch(`/api/stats?year=${year}`).then(r => r.json()).then(data => {
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

  function renderMonthTable(year, month, daysData, rules) {
    calendarDiv.innerHTML = "";

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");

    const weekHeader = document.createElement("th");
    weekHeader.textContent = "Week";
    headerRow.appendChild(weekHeader);

    weekdays.forEach(w => {
      const th = document.createElement("th");
      th.textContent = w;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    const firstDay = new Date(year, month - 1, 1);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday=0
    const firstMonday = new Date(year, month - 1, 1 - startDay);

    let weekCount = 0;
    let row = document.createElement("tr");

    let mondayDate = new Date(firstMonday);
    mondayDate.setDate(mondayDate.getDate() + (7 * weekCount));
    let weekCell = document.createElement("td");
    weekCell.textContent = getWeekNumber(mondayDate);
    row.appendChild(weekCell);

    for (let i = 0; i < startDay; i++) {
      const td = document.createElement("td");
      td.textContent = "";
      row.appendChild(td);
    }

    const numDays = new Date(year, month, 0).getDate();
    for (let day = 1; day <= numDays; day++) {
      const td = document.createElement("td");
      td.textContent = day;

      const iso = toISO(year, month, day);
      const dateObj = new Date(year, month - 1, day);

      let state = daysData[day] || "empty";
      td.classList.add(state);

      if (iso === todayIso) td.classList.add("today-cell");

      const blocked = isBlockedDate(iso, dateObj, rules);
      if (blocked) {
        td.classList.add("blocked-day");
      } else {
        td.addEventListener("click", function () {
          if (typeof lockPastMonths !== "undefined" && lockPastMonths) {
            const now = new Date();
            const currentY = now.getFullYear();
            const currentM = now.getMonth() + 1;
            if (year !== currentY || month !== currentM) {
              alert("Modifications are locked for months other than the current month.");
              return;
            }
          }

          let newState;
          if (state === "empty") newState = "office";
          else if (state === "office") newState = "home";
          else if (state === "home") newState = "day_off";
          else newState = "empty";

          fetch("/api/day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: iso, state: newState })
          })
            .then(r => r.json())
            .then(resp => {
              if (resp.success) {
                state = newState;
                td.classList.remove("empty", "office", "home", "day_off");
                td.classList.add(newState);
                updateStats(year, month);
              } else {
                alert("Error updating status.");
              }
            });
        });
      }

      row.appendChild(td);

      if (row.children.length - 1 === 7) {
        table.appendChild(row);
        weekCount++;
        row = document.createElement("tr");

        mondayDate = new Date(firstMonday);
        mondayDate.setDate(mondayDate.getDate() + (7 * weekCount));
        weekCell = document.createElement("td");
        weekCell.textContent = getWeekNumber(mondayDate);
        row.appendChild(weekCell);
      }
    }

    if (row.children.length - 1 > 0) {
      while (row.children.length - 1 < 7) {
        const td = document.createElement("td");
        td.textContent = "";
        row.appendChild(td);
      }
      table.appendChild(row);
    }

    calendarDiv.appendChild(table);
  }

  function renderYearGrid(year, monthsData, rules) {
    calendarDiv.innerHTML = "";

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
      weekdays.forEach(w => {
        const th = document.createElement("th");
        th.textContent = w;
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

        if (iso === todayIso) td.classList.add("today-cell");
        if (isBlockedDate(iso, dateObj, rules)) td.classList.add("blocked-day");

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

  // Buttons
  prevMonthBtn.addEventListener("click", function () {
    if (viewMode === "year") {
      viewDate = new Date(viewDate.getFullYear() - 1, 0, 1);
      loadYear(viewDate.getFullYear());
      return;
    }
    viewDate.setMonth(viewDate.getMonth() - 1);
    viewDate.setDate(1);
    loadMonthFromViewDate();
  });

  nextMonthBtn.addEventListener("click", function () {
    if (viewMode === "year") {
      viewDate = new Date(viewDate.getFullYear() + 1, 0, 1);
      loadYear(viewDate.getFullYear());
      return;
    }
    viewDate.setMonth(viewDate.getMonth() + 1);
    viewDate.setDate(1);
    loadMonthFromViewDate();
  });

  todayBtn.addEventListener("click", function () {
    const now = new Date();
    viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    loadMonthFromViewDate();
  });

  allYearBtn.addEventListener("click", function () {
    loadYear(viewDate.getFullYear());
  });

  // Initial load
  loadMonthFromViewDate();
});
