import axios from "axios";

const api = axios.create({
  baseURL:'https://smart-financial-consulting-platform.onrender.com',
  timeout: 30000,   // longer timeout — Finnhub fetches can take ~10s for batch
});

export default api;