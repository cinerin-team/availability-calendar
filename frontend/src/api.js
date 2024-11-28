import axios from "axios";

const API_BASE_URL = "/api";

export const registerUser = (email, password) => {
  return axios.post(`${API_BASE_URL}/register`, { email, password });
};

export const loginUser = (email, password) => {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);
  return axios.post(`${API_BASE_URL}/token`, formData);
};

export const getCalendar = (token) => {
  return axios.get(`${API_BASE_URL}/calendar`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const updateCalendar = (token, date, type) => {
  return axios.post(
    `${API_BASE_URL}/calendar`,
    { date, type },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};