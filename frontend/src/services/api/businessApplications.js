// Real HTTP layer for the supplier application/verification workflow — talks to
// sourcebridge-server via apiFetch/apiUpload, same as auth.js and orders.js. Not mocked: there
// is no mock/data.js fallback here, unlike suppliers.js/verification.js/buyers.js.
import { apiFetch, apiUpload, apiFetchBlobUrl } from "./client.js";

export async function getMyApplication() {
  const { application } = await apiFetch("/api/business-applications/me");
  return application;
}

export async function saveMyApplication(fields) {
  const { business } = await apiFetch("/api/business-applications/me", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return business;
}

export async function submitMyApplication(reason) {
  const { business } = await apiFetch("/api/business-applications/me/submit", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return business;
}

export async function uploadMyDocument(type, file) {
  const form = new FormData();
  form.append("type", type);
  form.append("file", file);
  return apiUpload("/api/business-applications/me/documents", form);
}

export async function uploadMyImage(caption, file) {
  const form = new FormData();
  if (caption) form.append("caption", caption);
  form.append("file", file);
  return apiUpload("/api/business-applications/me/images", form);
}

export async function openMyDocumentFile(documentId) {
  const url = await apiFetchBlobUrl(`/api/business-applications/me/documents/${documentId}/file`);
  window.open(url, "_blank");
}
export async function openMyImageFile(imageId) {
  const url = await apiFetchBlobUrl(`/api/business-applications/me/images/${imageId}/file`);
  window.open(url, "_blank");
}

// --- Admin ---

export async function listAdminApplications(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/api/admin/business-applications${query}`);
}

export async function getAdminApplication(businessId) {
  return apiFetch(`/api/admin/business-applications/${businessId}`);
}

export async function transitionAdminApplication(businessId, toState, reason) {
  const { business } = await apiFetch(`/api/admin/business-applications/${businessId}/transition`, {
    method: "POST",
    body: JSON.stringify({ toState, reason }),
  });
  return business;
}

export async function openAdminDocumentFile(businessId, documentId) {
  const url = await apiFetchBlobUrl(`/api/admin/business-applications/${businessId}/documents/${documentId}/file`);
  window.open(url, "_blank");
}
export async function openAdminImageFile(businessId, imageId) {
  const url = await apiFetchBlobUrl(`/api/admin/business-applications/${businessId}/images/${imageId}/file`);
  window.open(url, "_blank");
}
