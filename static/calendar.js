document.addEventListener("DOMContentLoaded", function() {
    let currentDate = new Date();
    
    const calendarDiv = document.getElementById("calendar");
    const currentMonthYearSpan = document.getElementById("current-month-year");
    const prevMonthBtn = document.getElementById("prev-month");
    const nextMonthBtn = document.getElementById("next-month");
    const todayBtn = document.getElementById("today");
    const monthlyStatsDiv = document.getElementById("monthly-stats");
    const yearlyStatsDiv = document.getElementById("yearly-stats");
    
    function loadCalendar(year, month) {
        fetch(`/api/days?year=${year}&month=${month}`)
            .then(response => response.json())
            .then(data => {
                renderCalendar(year, month, data.days);
                updateStats(year, month);
            });
    }
    
    function renderCalendar(year, month, daysData) {
        calendarDiv.innerHTML = "";
        currentMonthYearSpan.textContent = `${year} - ${month < 10 ? '0' + month : month}`;
        
        const table = document.createElement("table");
        const headerRow = document.createElement("tr");
        const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        weekdays.forEach(day => {
            const th = document.createElement("th");
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        
        const firstDay = new Date(year, month - 1, 1);
        let startDay = firstDay.getDay();
        
        let row = document.createElement("tr");
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
                // Ha a lockPastMonths kapcsoló be van kapcsolva, ellenőrizzük az aktuális hónapot
                if (typeof lockPastMonths !== 'undefined' && lockPastMonths) {
                    let now = new Date();
                    if (year !== now.getFullYear() || month !== (now.getMonth() + 1)) {
                        alert("Modifications are locked for months other than the current month.");
                        return;
                    }
                }
                // Állapotváltás: empty → office → home → day_off → empty
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
                    headers: {
                        "Content-Type": "application/json"
                    },
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
            
            if (row.children.length === 7) {
                table.appendChild(row);
                row = document.createElement("tr");
            }
        }
        if (row.children.length > 0) {
            while (row.children.length < 7) {
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
                    Office: ${data.office}%<br>
                    Home: ${data.home}%<br>
                    Total Work Days: ${data.total_work_days}
                `;
                if (data.office >= 60) {
                    monthlyStatsDiv.style.backgroundColor = "lightgreen";
                } else {
                    monthlyStatsDiv.style.backgroundColor = "lightcoral";
                }
            });
        fetch(`/api/stats?year=${year}`)
            .then(response => response.json())
            .then(data => {
                yearlyStatsDiv.innerHTML = `
                    Office: ${data.office}%<br>
                    Home: ${data.home}%<br>
                    Total Work Days: ${data.total_work_days}
                `;
                if (data.office >= 60) {
                    yearlyStatsDiv.style.backgroundColor = "lightgreen";
                } else {
                    yearlyStatsDiv.style.backgroundColor = "lightcoral";
                }
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
