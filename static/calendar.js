document.addEventListener("DOMContentLoaded", function() {
    let currentDate = new Date();

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const calendarDiv = document.getElementById("calendar");
    const currentMonthYearSpan = document.getElementById("current-month-year");
    const prevMonthBtn = document.getElementById("prev-month");
    const nextMonthBtn = document.getElementById("next-month");
    const todayBtn = document.getElementById("today");
    const allYearBtn = document.getElementById("all-year");
    const monthlyStatsDiv = document.getElementById("monthly-stats");
    const yearlyStatsDiv = document.getElementById("yearly-stats");

    function loadCalendar(year, month) {
        // month: 1-12
        fetch(`/api/days?year=${year}&month=${month}`)
            .then(response => response.json())
            .then(data => {
                // Display "YYYY - MonthName"
                currentMonthYearSpan.textContent = `${year} - ${monthNames[month - 1]}`;
                renderCalendar(year, month, data.days);
                updateStats(year, month);
            });
    }

    function renderCalendar(year, month, daysData) {
        calendarDiv.innerHTML = "";
        const table = document.createElement("table");
        const headerRow = document.createElement("tr");

        // Week number column
        const weekHeader = document.createElement("th");
        weekHeader.textContent = "Week";
        headerRow.appendChild(weekHeader);

        // Monday-first headers
        weekdays.forEach(day => {
            const th = document.createElement("th");
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        const firstDay = new Date(year, month - 1, 1);
        let startDay = (firstDay.getDay() + 6) % 7; // Monday=0

        // First displayed Monday (could be in previous month)
        let firstMonday = new Date(year, month - 1, 1 - startDay);

        let weekCount = 0;
        let row = document.createElement("tr");

        let mondayDate = new Date(firstMonday);
        mondayDate.setDate(mondayDate.getDate() + (7 * weekCount));
        let weekCell = document.createElement("td");
        weekCell.textContent = getWeekNumber(mondayDate);
        row.appendChild(weekCell);

        // Empty cells before 1st
        for (let i = 0; i < startDay; i++) {
            let cell = document.createElement("td");
            cell.textContent = "";
            row.appendChild(cell);
        }

        const numDays = new Date(year, month, 0).getDate();
        for (let day = 1; day <= numDays; day++) {
            let cell = document.createElement("td");
            cell.textContent = day;
            let state = daysData[day] || "empty";
            cell.classList.add(state);
            cell.dataset.day = day;

            // Click handler only in month view (year view is read-only)
            cell.addEventListener("click", function() {
                if (typeof lockPastMonths !== 'undefined' && lockPastMonths) {
                    let now = new Date();
                    if (year !== now.getFullYear() || month !== (now.getMonth() + 1)) {
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

                let dateStr = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
                fetch("/api/day", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date: dateStr, state: newState })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        state = newState;
                        cell.classList.remove("empty", "office", "home", "day_off");
                        cell.classList.add(newState);
                        updateStats(year, month);
                    } else {
                        alert("Error updating status.");
                    }
                });
            });

            row.appendChild(cell);

            // Completed week (7 day cells + 1 week column)
            if ((row.children.length - 1) === 7) {
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

        // Tail fillers
        if ((row.children.length - 1) > 0) {
            while ((row.children.length - 1) < 7) {
                let cell = document.createElement("td");
                cell.textContent = "";
                row.appendChild(cell);
            }
            table.appendChild(row);
        }
        calendarDiv.appendChild(table);
    }

    function updateStats(year, month) {
        // Monthly stats
        fetch(`/api/stats?year=${year}&month=${month}`)
            .then(response => response.json())
            .then(data => {
                monthlyStatsDiv.innerHTML = `
                    <h2>Monthly Statistics</h2>
                    Office: ${data.office}%<br>
                    Home: ${data.home}%<br>
                    Total Working Days: ${data.total_working_days}
                `;
                monthlyStatsDiv.style.backgroundColor = data.office >= 60 ? "lightgreen" : "lightcoral";
            });

        // Yearly stats
        fetch(`/api/stats?year=${year}`)
            .then(response => response.json())
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

    // ---- All Year view ----
    function loadYear(year) {
        currentMonthYearSpan.textContent = `${year} - All Year`;
        const months = Array.from({ length: 12 }, (_, i) => i + 1);

        // Fetch all months in parallel
        Promise.all(
            months.map(m =>
                fetch(`/api/days?year=${year}&month=${m}`)
                    .then(r => r.json())
                    .then(d => ({ month: m, days: d.days }))
            )
        ).then(monthsData => {
            monthsData.sort((a, b) => a.month - b.month);
            renderYearGrid(year, monthsData);

            // Update yearly stats; monthly stats not értelmezett a teljes nézetben
            fetch(`/api/stats?year=${year}`)
                .then(response => response.json())
                .then(data => {
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
            // Compact header without week number to save space
            weekdays.forEach(d => {
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
                const state = days[d] || "empty";
                td.classList.add(state);
                // No click handler in All Year view (read-only)
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

    // ---- Controls ----
    prevMonthBtn.addEventListener("click", function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
    });

    nextMonthBtn.addEventListener("click", function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
    });

    todayBtn.addEventListener("click", function() {
        currentDate = new Date();
        loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
    });

    allYearBtn.addEventListener("click", function() {
        loadYear(currentDate.getFullYear());
    });

    // Initial monthly load
    loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
});

// ISO week number
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

