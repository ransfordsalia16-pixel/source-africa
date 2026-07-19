import { delay } from "./client.js";
import * as db from "../mock/data.js";

function removeFromQueue(id) {
  const idx = db.verificationQueue.findIndex((v) => v.id === id);
  if (idx !== -1) db.verificationQueue.splice(idx, 1);
}

export async function getSupplierVerificationQueue() {
  return delay([...db.verificationQueue]);
}

export async function approveSupplier(verificationId) {
  const record = db.verificationQueue.find((v) => v.id === verificationId);
  if (record) {
    const supplier = db.suppliers.find((s) => s.id === record.supplierId);
    if (supplier) supplier.trustLevel = "gold";
    removeFromQueue(verificationId);
  }
  return delay(record);
}

export async function rejectSupplier(verificationId) {
  const record = db.verificationQueue.find((v) => v.id === verificationId);
  removeFromQueue(verificationId);
  return delay(record);
}
