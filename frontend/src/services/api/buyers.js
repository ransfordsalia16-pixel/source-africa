// STAGE 1: still mocked. Buyer verification (its own admin review flow) has no backend
// endpoint yet — this is a later stage, not the auth/orders work done in Stage 1.
import { delay } from "./client.js";
import * as db from "../mock/data.js";

export async function getBuyerProfile() {
  return delay({ ...db.buyerProfile });
}

export async function getBuyerRequests() {
  return delay([...db.buyerRequests]);
}

export async function createBuyerRequest(payload) {
  const request = {
    id: `RFQ-${Math.floor(Math.random() * 9000 + 1000)}`,
    status: "searching",
    quotesCount: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    ...payload,
  };
  db.buyerRequests.unshift(request);
  return delay(request);
}

export async function getBuyerVerificationQueue() {
  return delay([...db.buyerVerificationQueue]);
}

export async function approveBuyer(id) {
  const record = db.buyerVerificationQueue.find((b) => b.id === id);
  if (record) record.status = "approved";
  return delay(record);
}
