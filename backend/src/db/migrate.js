import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

db.exec(schema);

// CREATE TABLE IF NOT EXISTS (above) does nothing for a businesses table that already existed
// before this column set was added — SQLite needs an explicit ALTER TABLE per missing column,
// each one idempotent so re-running this script against an already-upgraded database is a no-op.
const NEW_BUSINESS_COLUMNS = [
  ["description", "TEXT"],
  ["contact_email", "TEXT"],
  ["contact_phone", "TEXT"],
  ["website", "TEXT"],
  ["products_summary", "TEXT"],
  ["verification_status", "TEXT NOT NULL DEFAULT 'SUPPLIER_VERIFIED'"],
  ["updated_at", "TEXT"],
];
const existingColumns = new Set(db.prepare("PRAGMA table_info(businesses)").all().map((c) => c.name));
for (const [name, definition] of NEW_BUSINESS_COLUMNS) {
  if (!existingColumns.has(name)) {
    db.exec(`ALTER TABLE businesses ADD COLUMN ${name} ${definition}`);
  }
}

const NEW_PRODUCT_COLUMNS = [["updated_at", "TEXT"]];
const existingProductColumns = new Set(db.prepare("PRAGMA table_info(products)").all().map((c) => c.name));
for (const [name, definition] of NEW_PRODUCT_COLUMNS) {
  if (!existingProductColumns.has(name)) {
    db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
  }
}

const NEW_ORDER_COLUMNS = [
  ["protection_model", "TEXT NOT NULL DEFAULT 'standard'"],
  ["version", "INTEGER NOT NULL DEFAULT 1"],
];
const existingOrderColumns = new Set(db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name));
for (const [name, definition] of NEW_ORDER_COLUMNS) {
  if (!existingOrderColumns.has(name)) {
    db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
  }
}

const NEW_PAYMENT_COLUMNS = [
  ["buyer_id", "TEXT"],
  ["supplier_business_id", "TEXT"],
  ["order_version_id", "TEXT"],
  ["platform_fee_cents", "INTEGER NOT NULL DEFAULT 0"],
  ["refund_status", "TEXT"],
];
const existingPaymentColumns = new Set(db.prepare("PRAGMA table_info(payments)").all().map((c) => c.name));
for (const [name, definition] of NEW_PAYMENT_COLUMNS) {
  if (!existingPaymentColumns.has(name)) {
    db.exec(`ALTER TABLE payments ADD COLUMN ${name} ${definition}`);
  }
}

const NEW_USER_COLUMNS = [
  ["mfa_secret_encrypted", "TEXT"],
  ["mfa_pending_secret_encrypted", "TEXT"],
];
const existingUserColumns = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
for (const [name, definition] of NEW_USER_COLUMNS) {
  if (!existingUserColumns.has(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  }
}

console.log("Migration complete.");
