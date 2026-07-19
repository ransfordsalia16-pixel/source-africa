// The real HTTP layer, talking to sourcebridge-server. Most services go through apiFetch;
// suppliers.js, buyers.js, and audit.js are still mocked and use delay() instead — see the
// "STAGE 1" comment at the top of each of those files.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_KEY = "sourcebridge.token";

export function delay(value, ms = 260) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request to ${path} failed with status ${response.status}`);
  }
  return data;
}

// For multipart uploads: no Content-Type header is set here on purpose, so the browser can add
// its own multipart boundary. Used by disputes.js for evidence uploads.
export async function apiUpload(path, formData) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.error || `Upload to ${path} failed with status ${response.status}`);
  }
  return data;
}

// Fetches a binary response (an evidence file) with the auth header attached, and hands back an
// object URL. This is why evidence files are opened through a helper instead of a bare <img
// src="..."> or <a href="..."> pointing at the API — neither of those can attach an
// Authorization header, so the request would just be rejected as unauthenticated.
export async function apiFetchBlobUrl(path) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Could not load file (status ${response.status}).`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
