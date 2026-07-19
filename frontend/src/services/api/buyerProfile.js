// Real HTTP layer for buyer company verification — talks to sourcebridge-server via apiFetch,
// same as businessApplications.js. Separate from services/api/buyers.js, which stays mocked
// (sourcing requests/RFQs are a different feature, and its own getBuyerVerificationQueue is the
// old mock queue this real flow sits alongside, not replaces).
import { apiFetch } from "./client.js";

export async function getMyProfile() {
  const { profile } = await apiFetch("/api/buyer-profile/me");
  return profile;
}

export async function saveMyProfile(fields) {
  const { profile } = await apiFetch("/api/buyer-profile/me", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return profile;
}

export async function listAdminProfiles(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/api/admin/buyer-profiles${query}`);
}

export async function getAdminProfile(id) {
  return apiFetch(`/api/admin/buyer-profiles/${id}`);
}

export async function transitionAdminProfile(id, toState, reason) {
  const { profile } = await apiFetch(`/api/admin/buyer-profiles/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({ toState, reason }),
  });
  return profile;
}
