import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8001",
  timeout: 30000,   // longer timeout — Finnhub fetches can take ~10s for batch
});

export default api;