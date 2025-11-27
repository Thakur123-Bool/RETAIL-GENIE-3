// src/lib/api.js
import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    // optional: normalize error
    const err = e?.response?.data || { message: e.message || "Network error" };
    return Promise.reject(err);
  }
);

export default api;
