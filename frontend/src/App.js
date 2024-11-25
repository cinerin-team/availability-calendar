import React, { useState } from 'react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    const response = await fetch("http://localhost:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      setIsLoggedIn(true);
    } else {
      alert("Login failed");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    const response = await fetch("http://localhost:8000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      alert("Registration successful!");
    } else {
      alert("Registration failed");
    }
  };

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
          <h2>Welcome!</h2>
          <p>The calendar will be here soon!</p>
        </div>
      )}
    </div>
  );
}

export default App;

