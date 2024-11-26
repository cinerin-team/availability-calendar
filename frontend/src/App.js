import React, { useState, useEffect } from 'react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [entries, setEntries] = useState([]);

  const API_BASE_URL = "http://backend:8000";

  const handleLogin = async (e) => {
  	e.preventDefault();
  	const email = e.target.email.value;
  	const password = e.target.password.value;

  	const response = await fetch(`${API_BASE_URL}/login`, {
  		method: "POST",
  		headers: { "Content-Type": "application/json" },
  		body: JSON.stringify({ email, password }),
  	});

  	if (response.ok) {
  		const data = await response.json();
  		setUserId(data.user_id);
  		setIsLoggedIn(true);
  	} else {
  		alert("Login failed");
  	}
  };

  const handleRegister = async (e) => {
  	e.preventDefault();
  	const email = e.target.email.value;
  	const password = e.target.password.value;

  	try {
    		const response = await fetch("${API_BASE_URL}:8000/register", {
      			method: "POST",
      			headers: { "Content-Type": "application/json" },
      			body: JSON.stringify({ email, password }),
    			});

    		if (response.ok) {
      			alert("Registration successful!");
    		} else {
      			const errorData = await response.json();
      			console.error("Registration error:", errorData);
      			alert("Registration failed: " + (errorData.detail || "Unknown error"));
    		}
  	} catch (error) {
    		console.error("Fetch error:", error);
    		alert("An error occurred. Check console for details.");
  	}
  };
    
  const addEntry = async (date, type) => {
    const response = await fetch("${API_BASE_URL}:8000/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type, user_id: userId }),
    });

    if (response.ok) {
      fetchEntries();
    } else {
      alert("Failed to add entry");
    }
  };

  const fetchEntries = async () => {
    const response = await fetch(`${API_BASE_URL}:8000/entries?user_id=${userId}`);
    const data = await response.json();
    setEntries(data);
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchEntries();
    }
  }, [isLoggedIn]);

  return (
    <div>
      <h1>Calendar App</h1>
      {!isLoggedIn ? (
        <div>
          <form onSubmit={handleLogin}>
            <h2>Login</h2>
            <input type="email" name="email" placeholder="Email" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Login</button>
          </form>
          <form onSubmit={handleRegister}>
            <h2>Register</h2>
            <input type="email" name="email" placeholder="Email" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Register</button>
          </form>
        </div>
      ) : (
        <div>
          <h2>Your Calendar</h2>
          <button onClick={() => addEntry("2024-01-01", "home_office")}>Add Home Office</button>
          <button onClick={() => addEntry("2024-01-02", "office")}>Add:x Office</button>
          <button onClick={() => addEntry("2024-01-03", "vacation")}>Add Vacation</button>
          <ul>
            {entries.map((entry, index) => (
              <li key={index}>
                {entry.date}: {entry.type}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;

