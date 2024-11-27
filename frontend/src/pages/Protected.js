import React, { useState } from "react";
import { getProtectedData } from "../api";

const Protected = () => {
  const [message, setMessage] = useState("");

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const data = await getProtectedData(token);
      setMessage(data.message);
    } catch (err) {
      console.error(err);
      alert("Unauthorized!");
    }
  };

  return (
    <div>
      <h2>Protected Page</h2>
      <button onClick={fetchData}>Get Protected Data</button>
      <p>{message}</p>
    </div>
  );
};

export default Protected;
