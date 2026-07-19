// Real: talks to sourcebridge-server's conversations system (Stage 2). Every function here
// keeps the same orderId-keyed shape the buyer Messages page already used against the mock data,
// so pages/buyer/Messages.jsx and pages/supplier/Messages.jsx barely need to know a
// conversationId exists on the backend.
import { apiFetch } from "./client.js";

export async function getThreadIds() {
  const rows = await apiFetch("/api/conversations");
  return rows.map((r) => r.orderId);
}

export async function getThread(orderId) {
  const { messages } = await apiFetch(`/api/orders/${orderId}/conversation`);
  return messages;
}

export async function sendMessage(orderId, text) {
  return apiFetch(`/api/orders/${orderId}/conversation/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function hideThread(orderId) {
  return apiFetch(`/api/orders/${orderId}/conversation/hide`, { method: "POST" });
}

export async function unhideThread(orderId) {
  return apiFetch(`/api/orders/${orderId}/conversation/unhide`, { method: "POST" });
}

// Admin-only. adminListConversations() is metadata only (no message bodies, no case needed).
// adminViewConversation() reads message content and requires a real, assigned support case — the
// backend rejects a missing caseId with 400 and a case that doesn't grant access with 404,
// regardless of what this function passes.
export async function adminListConversations() {
  return apiFetch("/api/admin/conversations");
}

export async function adminViewConversation(conversationId, caseId) {
  const params = new URLSearchParams({ caseId });
  return apiFetch(`/api/admin/conversations/${conversationId}?${params.toString()}`);
}
