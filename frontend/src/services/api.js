import axios from "axios";
import { normalizePrediction } from "./cropLabels.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("leafline_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = async (credentials) =>
  (await api.post("/auth/login", credentials)).data;
export const register = async (details) =>
  (await api.post("/auth/register", details)).data;
export const getSummary = async () => {
  const { data } = await api.get("/predictions/summary");
  return { ...data.data, recent: data.data.recent.map(normalizePrediction) };
};
export const getAiStatus = async () =>
  (await api.get("/predictions/status")).data.data;
export const getScans = async (params) => {
  const { data } = await api.get("/predictions", { params });
  return {
    scans: data.data.map(normalizePrediction),
    pagination: data.pagination,
  };
};
export const getScan = async (id) =>
  normalizePrediction((await api.get(`/predictions/${id}`)).data.data);
export const deletePrediction = async (id) =>
  (await api.delete(`/predictions/${id}`)).data.data;
export const createScan = async (file) => {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post("/predictions", form);
  window.dispatchEvent(new Event("leafline:scan-saved"));
  return { scan: normalizePrediction(data.data) };
};
export const updateProfile = async (profile) =>
  (await api.patch("/auth/me", profile)).data.user;
