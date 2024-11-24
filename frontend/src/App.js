import React, { useState, useEffect } from "react";

function App() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/calendar")
      .then((res) => res.json())
      .then((data) => setEntries(data));
  }, []);

  return (
    <div>
      <h1>Calendar App</h1>
      <ul>
        {entries.map((entry, index) => (
          <li key={index}>
            {entry.date}: {entry.type}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
