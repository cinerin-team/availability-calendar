document.addEventListener("DOMContentLoaded", function() {
    let currentDate = new Date();

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];

    const calendarDiv = document.getElementById("calendar");
    const currentMonthYearSpan = document.getElementById("current-month-year");
    const prevMonthBtn = document.getElementById("prev-month");
    const nextMonthBtn = document.getElementById("next-month");
    const todayBtn = document.getElementById("today");
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
        // Extra header for Week Number
        const weekHeader = document.createElement("th");
        weekHeader.textContent = "Week";
        headerRow.appendChild(weekHeader);
        // Weekdays starting from Monday
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        weekdays.forEach(day => {
            const th = document.createElement("th");
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        const firstDay = new Date(year, month - 1, 1);
        // Adjust so Monday is 0: (getDay() + 6) % 7
        let startDay = (firstDay.getDay() + 6) % 7;
        // Compute the first Monday (even if in previous month)
        let firstMonday = new Date(year, month - 1, 1 - startDay);

        let weekCount = 0;
        let row = document.createElement("tr");
        let mondayDate = new Date(firstMonday);
        mondayDate.setDate(mondayDate.getDate() + (7 * weekCount));
        let weekCell = document.createElement("td");
        weekCell.textContent = getWeekNumber(mondayDate);
        row.appendChild(weekCell);

        // Fill empty cells before the first day of the month
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

            cell.addEventListener("click", function() {
                // If global lock is enabled, allow modifications only for current month
                if (typeof lockPastMonths !== 'undefined' && lockPastMonths) {
                    let now = new Date();
                    if (year !== now.getFullYear() || month !== (now.getMonth() + 1)) {
                        alert("Modifications are locked for months other than the current month.");
                        return;
                    }
                }
                // Cycle statuses: empty → office → home → day_off → empty
                let newState;
                if (state === "empty") {
                    newState = "office";
                } else if (state === "office") {
                    newState = "home";
                } else if (state === "home") {
                    newState = "day_off";
                } else {
                    newState = "empty";
                }
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

            // When the row is complete (7 days), append it and start a new row with week number
            if ((row.children.length - 1) === 7) { // subtract the week column
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
        // Append any remaining row if not full
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

    loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
});

// Helper function to get ISO week number
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}
