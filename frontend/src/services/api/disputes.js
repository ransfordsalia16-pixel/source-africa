// Real: talks to sourcebridge-server's disputes and evidence system (Stage 4).
import { apiFetch, apiUpload, apiFetchBlobUrl } from "./client.js";

export async function openDispute(orderId, { reason, description }) {
  return apiFetch(`/api/orders/${orderId}/disputes`, {
    method: "POST",
    body: JSON.stringify({ reason, description }),
  });
}

export async function getMyDisputes() {
  return apiFetch("/api/disputes");
}

export async function getDispute(id) {
  return apiFetch(`/api/disputes/${id}`);
}

export async function uploadEvidence(disputeId, file, { type, description } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (type) formData.append("type", type);
  if (description) formData.append("description", description);
  return apiUpload(`/api/disputes/${disputeId}/evidence`, formData);
}

export async function openEvidenceFile(disputeId, evidenceId) {
  const url = await apiFetchBlobUrl(`/api/disputes/${disputeId}/evidence/${evidenceId}/file`);
  window.open(url, "_blank");
}

// Admin-only. Every one of these is independently re-checked server-side (role_permissions for
// listing, an explicit dispute_officer/super_admin role check for assign and resolve) — nothing
// here is a substitute for that, just the calls the admin pages make.
export async function adminGetDisputes() {
  return apiFetch("/api/admin/disputes");
}

export async function adminGetDispute(id) {
  return apiFetch(`/api/admin/disputes/${id}`);
}

export async function adminAssignDispute(id) {
  return apiFetch(`/api/admin/disputes/${id}/assign`, { method: "POST" });
}

export async function adminResolveDispute(id, { outcome, resolution }) {
  return apiFetch(`/api/admin/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome, resolution }),
  });
}
