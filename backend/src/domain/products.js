import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { getBusinessOwnedBy } from "./orderAccess.js";

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found.");
    this.status = 404;
  }
}
// Thrown on create when the caller has no business, or their business hasn't cleared review
// yet — only SUPPLIER_VERIFIED businesses can list new products. Matches why a restricted or
// suspended business's existing products drop out of the public marketplace (see
// listPublicProducts) but the owner can still see them via listMyProducts.
export class NotAVerifiedSupplierError extends Error {
  constructor() {
    super("Your business must be a verified supplier to list products.");
    this.status = 403;
  }
}

const insertProduct = db.prepare(`
  INSERT INTO products (id, business_id, name, category, price_label, moq, production_time)
  VALUES (@id, @business_id, @name, @category, @price_label, @moq, @production_time)
`);
const updateProductRow = db.prepare(`
  UPDATE products
  SET name = @name, category = @category, price_label = @price_label, moq = @moq,
      production_time = @production_time, updated_at = datetime('now')
  WHERE id = @id
`);
const getProductById = db.prepare("SELECT * FROM products WHERE id = ?");
const listByBusiness = db.prepare("SELECT * FROM products WHERE business_id = ? ORDER BY created_at DESC");

const PUBLIC_LIST_BASE = `
  SELECT products.*, businesses.name AS business_name, businesses.location AS business_location,
         businesses.trust_level AS business_trust_level, businesses.trust_score AS business_trust_score
  FROM products
  JOIN businesses ON businesses.id = products.business_id
  WHERE businesses.verification_status = 'SUPPLIER_VERIFIED'
`;
const listPublic = db.prepare(`${PUBLIC_LIST_BASE} ORDER BY products.created_at DESC`);
const listPublicByCategory = db.prepare(`${PUBLIC_LIST_BASE} AND products.category = ? ORDER BY products.created_at DESC`);
const getPublicById = db.prepare(`${PUBLIC_LIST_BASE} AND products.id = ?`);

const DRAFT_FIELDS = ["name", "category", "price_label", "moq", "production_time"];

function requireVerifiedBusiness(user) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business || business.verification_status !== "SUPPLIER_VERIFIED") {
    throw new NotAVerifiedSupplierError();
  }
  return business;
}

export function createProduct(user, fields) {
  const business = requireVerifiedBusiness(user);
  const record = { id: genId("PRD"), business_id: business.id };
  for (const field of DRAFT_FIELDS) record[field] = fields[field] ?? null;
  insertProduct.run(record);
  return getProductById.get(record.id);
}

// Ownership is checked against the caller's own resolved business, not a client-supplied
// business id — the same IDOR closure used throughout domain/supplierVerification.js.
export function updateProduct(user, productId, fields) {
  const business = getBusinessOwnedBy.get(user.id);
  const existing = business && getProductById.get(productId);
  if (!existing || existing.business_id !== business.id) throw new ProductNotFoundError();

  const record = { id: productId };
  for (const field of DRAFT_FIELDS) record[field] = fields[field] ?? existing[field];
  updateProductRow.run(record);
  return getProductById.get(productId);
}

export function listMyProducts(user) {
  const business = getBusinessOwnedBy.get(user.id);
  return business ? listByBusiness.all(business.id) : [];
}

export function listPublicProducts({ category } = {}) {
  return category ? listPublicByCategory.all(category) : listPublic.all();
}

export function getPublicProductById(id) {
  const row = getPublicById.get(id);
  if (!row) throw new ProductNotFoundError();
  return row;
}
