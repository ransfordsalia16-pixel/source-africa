// Real: talks to sourcebridge-server's payment routes (backend/src/routes/payments.js),
// backed by MockPaymentProvider in development — see components/DevelopmentModeBanner.jsx.
// Replaces the old STAGE 1 mock (secureEscrow/getTransactions against mock/data.js).
import { apiFetch } from "./client.js";

export async function createOrder(fields) {
  return apiFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(fields),
  });
}

export async function payOrder(orderId) {
  return apiFetch(`/api/orders/${orderId}/pay`, { method: "POST" });
}

export async function getMyTransactions() {
  return apiFetch("/api/payments/mine");
}

export async function adminGetTransactions() {
  return apiFetch("/api/admin/payments");
}
