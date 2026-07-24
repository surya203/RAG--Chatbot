import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribe to forced logout when refresh fails (401 after expired access token). */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach((listener) => listener());
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    clearAuthTokens();
    notifySessionExpired();
    return null;
  }

  try {
    // Use a bare axios call so this does not recurse through interceptors.
    const { data } = await axios.post<{
      access_token: string;
      refresh_token: string;
    }>(`${API_BASE_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken });
    setAuthTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearAuthTokens();
    notifySessionExpired();
    return null;
  }
}

/** Single-flight refresh so concurrent 401s share one /auth/refresh call. */
export function ensureFreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/register") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      const accessToken = await ensureFreshAccessToken();
      if (accessToken) {
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export function setAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function getStoredAccessToken() {
  return localStorage.getItem("access_token");
}

/** Pull a human-readable message out of an axios/FastAPI error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return "Request timed out. On Render, generation can be slow — try fewer features, or uncheck Listening and try again.";
    }
    if (!error.response) {
      return "Could not reach the API. The Render service may be waking up — wait 30s and try again.";
    }
    if (error.response.status === 502 || error.response.status === 504) {
      return "The server timed out while generating. Try again with fewer features (uncheck Listening first).";
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors come back as an array of {msg, ...}.
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
