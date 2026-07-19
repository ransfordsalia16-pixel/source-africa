// Real: talks to sourcebridge-server's payout-account routes (backend/src/routes/payoutAccounts.js).
import { apiFetch } from "./client.js";

export async function getMyPayoutAccount() {
  return apiFetch("/api/payout-account/mine");
}

export async function requestPayoutAccountChange({ type, currentPassword, details }) {
  return apiFetch("/api/payout-account/mine", {
    method: "POST",
    body: JSON.stringify({ type, currentPassword, details }),
  });
}
