// Real: talks to sourcebridge-server's TOTP endpoints (backend/src/routes/auth.js).
import { apiFetch } from "./client.js";

export async function startEnrollment() {
  return apiFetch("/api/auth/mfa/enroll", { method: "POST" });
}

export async function confirmEnrollment(code) {
  return apiFetch("/api/auth/mfa/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disableMfa(currentPassword) {
  return apiFetch("/api/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({ currentPassword }),
  });
}
