import { apiFetch, delay } from "./client.js";
import * as db from "../mock/data.js";

export const orderStages = ["order_confirmed", "production", "inspection", "shipping", "customs", "delivered"];
export const orderStageLabels = {
  order_confirmed: "Order confirmed",
  production: "Production",
  inspection: "Quality inspection",
  shipping: "Shipping",
  customs: "Customs clearance",
  delivered: "Delivered",
};

// Real: hits sourcebridge-server, scoped server-side to whoever the JWT belongs to.
export async function getOrders() {
  return apiFetch("/api/orders");
}

export async function getOrderById(id) {
  return apiFetch(`/api/orders/${id}`);
}

export async function getOrdersBySupplier(supplierId) {
  const rows = await apiFetch("/api/orders");
  return rows.filter((o) => o.supplierId === supplierId);
}

// The backend tracks a much finer-grained state machine (see orderStateMachine.js on the
// server) than the six buckets this app displays. This picks the backend state that lands in
// the next visible bucket, so "mark next stage ready" still reads as one click per stage shown.
const NEXT_BACKEND_STATE = {
  SUPPLIER_NOTIFIED: "PRODUCTION_STARTED",
  PRODUCTION_STARTED: "PRODUCTION_COMPLETED",
  PRODUCTION_COMPLETED: "READY_FOR_SHIPMENT",
  READY_FOR_SHIPMENT: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: "RECEIVED",
  RECEIVED: "INSPECTION_PENDING",
  INSPECTION_PENDING: "INSPECTION_IN_PROGRESS",
  INSPECTION_IN_PROGRESS: "APPROVED",
  APPROVED: "PAYOUT_PENDING",
  PAYOUT_PENDING: "PAYOUT_RELEASED",
  PAYOUT_RELEASED: "COMPLETED",
};

export async function advanceOrderStage(id) {
  const order = await apiFetch(`/api/orders/${id}`);
  const toState = NEXT_BACKEND_STATE[order.state];
  if (!toState) return order; // already at COMPLETED, or in a state this simplified UI doesn't drive
  return apiFetch(`/api/orders/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({ toState }),
  });
}

// STAGE 1: shipments has no backend endpoint yet (schema exists, see sourcebridge-server
// src/db/schema.sql). Still reading the in-memory mock data here.
export async function getShipments() {
  return delay([...db.shipments]);
}

export async function getShipmentForOrder(orderId) {
  return delay(db.shipments.find((s) => s.orderId === orderId) || null);
}
