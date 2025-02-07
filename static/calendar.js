document.addEventListener("DOMContentLoaded", function() {
    let currentDate = new Date();
    
    const calendarDiv = document.getElementById("calendar");
    const currentMonthYearSpan = document.getElementById("current-month-year");
    const prevMonthBtn = document.getElementById("prev-month");
    const nextMonthBtn = document.getElementById("next-month");
    const monthlyStatsDiv = document.getElementById("monthly-stats");
    const yearlyStatsDiv = document.getElementById("yearly-stats");
    
    function loadCalendar(year, month) {
        // month: 1-től 12-ig
        fetch(`/api/days?year=${year}&month=${month}`)
            .then(response => response.json())
            .then(data => {
                renderCalendar(year, month, data.days);
                updateStats(year, month);
            });
    }
    
    function renderCalendar(year, month, daysData) {
        // Töröljük az előző naptár tartalmát
        calendarDiv.innerHTML = "";
        
        currentMonthYearSpan.textContent = `${year} - ${month < 10 ? '0' + month : month}`;
        
        // Táblázat létrehozása
        const table = document.createElement("table");
        const headerRow = document.createElement("tr");
        const weekdays = ["Vas", "Hét", "Ked", "Sze", "Csü", "Pén", "Szo"];
        weekdays.forEach(day => {
            const th = document.createElement("th");
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        
        // Az adott hónap első napjának napja (0 = vasárnap, 6 = szombat)
        const firstDay = new Date(year, month - 1, 1);
        let startDay = firstDay.getDay();
        
        let row = document.createElement("tr");
        // Üres cellák a hónap kezdete előtt
        for (let i = 0; i < startDay; i++) {
            let cell = document.createElement("td");
            cell.textContent = "";
            row.appendChild(cell);
        }
        
        const numDays = new Date(year, month, 0).getDate();
        for (let day = 1; day <= numDays; day++) {
            let cell = document.createElement("td");
            cell.textContent = day;
            // Az adott nap állapota
            let state = daysData[day] || "empty";
            cell.classList.add(state);
            cell.dataset.day = day;
            
            cell.addEventListener("click", function() {
                // Állapot ciklus: empty -> office -> home -> empty
                let newState;
                if (state === "empty") {
                    newState = "office";
                } else if (state === "office") {
                    newState = "home";
                } else {
                    newState = "empty";
                }
                // Dátum formázása: YYYY-MM-DD
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
                        cell.classList.remove("empty", "office", "home");
                        cell.classList.add(newState);
                        updateStats(year, month);
                    } else {
                        alert("Hiba történt az állapot frissítésekor.");
                    }
                });
            });
            
            row.appendChild(cell);
            
            // Ha a sorban 7 cella van, hozzuk létre a következő sort
            if (row.children.length === 7) {
                table.appendChild(row);
                row = document.createElement("tr");
            }
        }
        // Utolsó sor feltöltése, ha szükséges
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
        // Havi statisztikák lekérése
        fetch(`/api/stats?year=${year}&month=${month}`)
            .then(response => response.json())
            .then(data => {
                monthlyStatsDiv.innerHTML = `
                    Irodai munka: ${data.office}%<br>
                    Otthoni munka: ${data.home}%<br>
                    Összes munkanap: ${data.total_work_days}
                `;
            });
        // Éves statisztikák lekérése
        fetch(`/api/stats?year=${year}`)
            .then(response => response.json())
            .then(data => {
                yearlyStatsDiv.innerHTML = `
                    Irodai munka: ${data.office}%<br>
                    Otthoni munka: ${data.home}%<br>
                    Összes munkanap: ${data.total_work_days}
                `;
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
    
    // Kezdeti betöltés az aktuális hónappal
    loadCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
});
