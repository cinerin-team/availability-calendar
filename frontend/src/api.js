import axios from "axios";

const API = axios.create({
  baseURL: "/api", // Nginx-en keresztül érjük el a backendet
});

// Regisztráció
export const register = async (email, password) => {
  const response = await API.post("/register", { email, password });
  return response.data;
};

// Bejelentkezés
export const login = async (email, password) => {
  const response = await API.post("/token", new URLSearchParams({ username: email, password }));
  return response.data;
};

// Védett adat lekérése
export const getProtectedData = async (token) => {
  const response = await API.get("/protected", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};