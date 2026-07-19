// Real HTTP layer for the sourcing-request (RFQ) workflow — talks to sourcebridge-server via
// apiFetch, same as businessApplications.js and products.js. Not mocked.
import { apiFetch } from "./client.js";

export async function createRequest(fields) {
  return apiFetch("/api/sourcing-requests", {
    method: "POST",
    body: JSON.stringify(fields),
  });
}

export async function getMyRequests() {
  return apiFetch("/api/sourcing-requests/mine");
}

export async function getRequestDetail(id) {
  return apiFetch(`/api/sourcing-requests/${id}`);
}

export async function getOpenRequests() {
  return apiFetch("/api/sourcing-requests/open");
}

export async function submitQuote(id, fields) {
  return apiFetch(`/api/sourcing-requests/${id}/quotes`, {
    method: "POST",
    body: JSON.stringify(fields),
  });
}
