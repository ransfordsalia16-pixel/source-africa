// STAGE 1: still mocked. businesses/products tables exist on the backend but have no
// endpoints yet — see sourcebridge-server/src/db/schema.sql.
import { delay } from "./client.js";
import * as db from "../mock/data.js";

export async function getSuppliers() {
  return delay([...db.suppliers]);
}

// The demo signs suppliers in as SUP-001, Shenzhen Solar Technology Ltd, so
// every supplier page has one consistent "my company" to work with.
export async function getMySupplier() {
  return delay(db.suppliers[0]);
}

export async function getProductsBySupplier(supplierId) {
  return delay(db.products.filter((p) => p.supplierId === supplierId));
}

export async function getSupplierById(id) {
  return delay(db.suppliers.find((s) => s.id === id) || null);
}

export async function getProducts() {
  return delay([...db.products]);
}

export async function getProductById(id) {
  return delay(db.products.find((p) => p.id === id) || null);
}

export async function addProduct(payload) {
  const product = {
    id: `PRD-${Math.floor(Math.random() * 900 + 100)}`,
    supplierId: db.supplierProfile.id === "USR-SUP-01" ? "SUP-001" : payload.supplierId,
    views: 0,
    inquiries: 0,
    ...payload,
  };
  db.products.push(product);
  return delay(product);
}

export async function updateProduct(id, payload) {
  const product = db.products.find((p) => p.id === id);
  if (product) Object.assign(product, payload);
  return delay(product);
}
