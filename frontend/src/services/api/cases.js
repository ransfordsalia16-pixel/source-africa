// Real: talks to sourcebridge-server's support case system (Stage 5).
import { apiFetch } from "./client.js";

export async function submitSupportRequest({ subject, description, orderId }) {
  return apiFetch("/api/support-requests", {
    method: "POST",
    body: JSON.stringify({ subject, description, orderId }),
  });
}

export async function getMySupportRequests() {
  return apiFetch("/api/support-requests");
}

// Admin-only. Every one of these is independently re-checked server-side
// (requirePermission("support")) — nothing here is a substitute for that.
export async function adminGetCases({ mine } = {}) {
  const params = mine ? "?mine=true" : "";
  return apiFetch(`/api/admin/cases${params}`);
}

export async function adminGetCase(id) {
  return apiFetch(`/api/admin/cases/${id}`);
}

export async function adminAssignCase(id) {
  return apiFetch(`/api/admin/cases/${id}/assign`, { method: "POST" });
}

export async function adminAddCaseNote(id, note) {
  return apiFetch(`/api/admin/cases/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminEscalateCase(id, note) {
  return apiFetch(`/api/admin/cases/${id}/escalate`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminCloseCase(id, note) {
  return apiFetch(`/api/admin/cases/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
