// Real HTTP layer for the product catalog — talks to sourcebridge-server via apiFetch, same as
// businessApplications.js. Not mocked, unlike the getProducts/addProduct/etc. still in
// suppliers.js (that file's supplier-directory lookups stay mocked; only products went real).
import { apiFetch } from "./client.js";

export async function listProducts(category) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch(`/api/products${query}`);
}

export async function getProduct(id) {
  return apiFetch(`/api/products/${id}`);
}

export async function listMyProducts() {
  return apiFetch("/api/products/mine");
}

export async function createProduct(fields) {
  return apiFetch("/api/products/mine", {
    method: "POST",
    body: JSON.stringify(fields),
  });
}

export async function updateProduct(id, fields) {
  return apiFetch(`/api/products/mine/${id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}
