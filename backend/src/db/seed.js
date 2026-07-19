import bcrypt from "bcryptjs";
import { db } from "./connection.js"; // also loads .env, resolved relative to this project, not process.cwd()
import { genId } from "../util/id.js";

const ROLES = [
  { key: "buyer", label: "Buyer", perms: { verification: 0, payments: 0, disputes: 0, settings: 0, support: 0 } },
  { key: "supplier", label: "Supplier", perms: { verification: 0, payments: 0, disputes: 0, settings: 0, support: 0 } },
  { key: "super_admin", label: "Founder / Owner", perms: { verification: 1, payments: 1, disputes: 1, settings: 1, support: 1 } },
  { key: "security_admin", label: "Security administrator", perms: { verification: 0, payments: 0, disputes: 0, settings: 1, support: 0 } },
  { key: "finance_admin", label: "Finance administrator", perms: { verification: 0, payments: 1, disputes: 0, settings: 0, support: 0 } },
  { key: "verification_team", label: "Verification team", perms: { verification: 1, payments: 0, disputes: 0, settings: 0, support: 0 } },
  { key: "customer_support", label: "Customer support", perms: { verification: 0, payments: 0, disputes: 1, settings: 0, support: 1 } },
  { key: "dispute_officer", label: "Dispute officer", perms: { verification: 0, payments: 0, disputes: 1, settings: 0, support: 0 } },
  { key: "technical_team", label: "Technical team", perms: { verification: 0, payments: 0, disputes: 0, settings: 1, support: 0 } },
];

const insertRole = db.prepare("INSERT OR IGNORE INTO roles (key, label) VALUES (?, ?)");
const insertPerms = db.prepare(
  "INSERT OR IGNORE INTO role_permissions (role_key, verification, payments, disputes, settings, support) VALUES (?, ?, ?, ?, ?, ?)"
);
for (const r of ROLES) {
  insertRole.run(r.key, r.label);
  insertPerms.run(r.key, r.perms.verification, r.perms.payments, r.perms.disputes, r.perms.settings, r.perms.support);
}

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, email, password_hash, name, role_key, location, avatar_initials, mfa_enabled, last_login_at)
  VALUES (@id, @email, @password_hash, @name, @role_key, @location, @avatar_initials, @mfa_enabled, @last_login_at)
`);

const buyer = {
  id: "USR-BUY-01",
  email: "ama@boateng-hospitality.example",
  password_hash: bcrypt.hashSync(process.env.DEMO_BUYER_PASSWORD || "demo-buyer-pass", 10),
  name: "Ama Boateng",
  role_key: "buyer",
  location: "Accra, Ghana",
  avatar_initials: "AB",
  mfa_enabled: 0,
  last_login_at: null,
};

const supplierUser = {
  id: "USR-SUP-01",
  email: "liwei@shenzhensolar.example",
  password_hash: bcrypt.hashSync(process.env.DEMO_SUPPLIER_PASSWORD || "demo-supplier-pass", 10),
  name: "Li Wei",
  role_key: "supplier",
  location: "Shenzhen, China",
  avatar_initials: "LW",
  mfa_enabled: 0,
  last_login_at: null,
};

const admin = {
  id: "USR-ADM-01",
  email: "kwame@sourcebridge.example",
  password_hash: bcrypt.hashSync(process.env.DEMO_ADMIN_PASSWORD || "demo-admin-pass", 10),
  name: "Kwame Asante",
  role_key: "super_admin",
  location: "Accra, Ghana",
  avatar_initials: "KA",
  mfa_enabled: 0,
  last_login_at: null,
};

// Added for Phase 1 (supplier verification): a second buyer to prove one applicant can never
// see or act on another applicant's business (IDOR check), a verification_team admin who can
// actually approve/reject/restrict/suspend applications, and a finance_admin who deliberately
// cannot (role_permissions.verification = 0 for that role) so the RBAC denial path is provable
// end to end, not just present in code.
const buyerTwo = {
  id: "USR-BUY-02",
  email: "kojo@tema-imports.example",
  password_hash: bcrypt.hashSync(process.env.DEMO_BUYER_TWO_PASSWORD || "demo-buyer-two-pass", 10),
  name: "Kojo Mensah",
  role_key: "buyer",
  location: "Tema, Ghana",
  avatar_initials: "KM",
  mfa_enabled: 0,
  last_login_at: null,
};

const verificationAdmin = {
  id: "USR-VER-01",
  email: "abena@sourcebridge.example",
  password_hash: bcrypt.hashSync(process.env.DEMO_VERIFICATION_ADMIN_PASSWORD || "demo-verification-pass", 10),
  name: "Abena Owusu",
  role_key: "verification_team",
  location: "Accra, Ghana",
  avatar_initials: "AO",
  mfa_enabled: 0,
  last_login_at: null,
};

const financeAdmin = {
  id: "USR-ADM-03",
  email: "yaw@sourcebridge.example",
  password_hash: bcrypt.hashSync(process.env.DEMO_FINANCE_ADMIN_PASSWORD || "demo-finance-pass", 10),
  name: "Yaw Darko",
  role_key: "finance_admin",
  location: "Accra, Ghana",
  avatar_initials: "YD",
  mfa_enabled: 0,
  last_login_at: null,
};

for (const u of [buyer, supplierUser, admin, buyerTwo, verificationAdmin, financeAdmin]) insertUser.run(u);

const insertBusiness = db.prepare(`
  INSERT OR IGNORE INTO businesses (id, owner_user_id, name, type, location, established_year, employees, category, trust_level, trust_score, verification_status)
  VALUES (@id, @owner_user_id, @name, @type, @location, @established_year, @employees, @category, @trust_level, @trust_score, @verification_status)
`);

// All seeded demo businesses predate the application flow, so they're already verified rather
// than starting at SUPPLIER_APPLICATION_STARTED.
const BUSINESSES = [
  { id: "SUP-001", owner_user_id: supplierUser.id, name: "Shenzhen Solar Technology Ltd", type: "Manufacturer", location: "Shenzhen, China", established_year: 2014, employees: "150+", category: "Energy", trust_level: "gold", trust_score: 94, verification_status: "SUPPLIER_VERIFIED" },
  { id: "SUP-002", owner_user_id: null, name: "Guangzhou Furniture Works", type: "Manufacturer", location: "Guangzhou, China", established_year: 2010, employees: "300+", category: "Furniture", trust_level: "platinum", trust_score: 98, verification_status: "SUPPLIER_VERIFIED" },
  { id: "SUP-003", owner_user_id: null, name: "Ningbo EV Components Co.", type: "Manufacturer", location: "Ningbo, China", established_year: 2018, employees: "80+", category: "Automotive", trust_level: "verified", trust_score: 76, verification_status: "SUPPLIER_VERIFIED" },
  { id: "SUP-004", owner_user_id: null, name: "Yiwu Trading International", type: "Trading Company", location: "Yiwu, China", established_year: 2016, employees: "40+", category: "Electronics", trust_level: "verified", trust_score: 71, verification_status: "SUPPLIER_VERIFIED" },
  { id: "SUP-005", owner_user_id: null, name: "Foshan Industrial Machinery", type: "Manufacturer", location: "Foshan, China", established_year: 2009, employees: "220+", category: "Industrial", trust_level: "gold", trust_score: 89, verification_status: "SUPPLIER_VERIFIED" },
];
for (const b of BUSINESSES) insertBusiness.run(b);

// Real product rows for the seeded supplier account (SUP-001) so its dashboard isn't empty the
// moment supplier/Overview.jsx and supplier/Profile.jsx stop reading the old mock supplier data.
// Deterministic IDs, INSERT OR IGNORE, matching the idempotency pattern used everywhere else here.
const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (id, business_id, name, category, price_label, moq, production_time)
  VALUES (@id, @business_id, @name, @category, @price_label, @moq, @production_time)
`);
const PRODUCTS = [
  { id: "PRD-SEED-001", business_id: "SUP-001", name: "450W Monocrystalline Solar Panel", category: "Energy", price_label: "$62 to $78 per unit", moq: "50 units", production_time: "15 to 20 days" },
  { id: "PRD-SEED-002", business_id: "SUP-001", name: "5kW Off-Grid Solar Inverter", category: "Energy", price_label: "$210 to $260 per unit", moq: "10 units", production_time: "20 to 25 days" },
];
for (const p of PRODUCTS) insertProduct.run(p);

// Matches the cosmetic company name already shown for this account (see
// COSMETIC_FALLBACK_BY_USER_ID in frontend/src/services/api/auth.js) so the seeded demo buyer
// appears verified out of the box. The second buyer (buyerTwo) intentionally has no profile,
// leaving a ready manual test path for the submit -> review -> verify flow.
const insertBuyerProfile = db.prepare(`
  INSERT OR IGNORE INTO buyer_profiles (id, user_id, company_name, location, business_type, verification_status, reviewed_by_user_id, reviewed_at)
  VALUES (@id, @user_id, @company_name, @location, @business_type, @verification_status, @reviewed_by_user_id, @reviewed_at)
`);
insertBuyerProfile.run({
  id: genId("BYR"),
  user_id: buyer.id,
  company_name: "Boateng Hospitality Group",
  location: "Accra, Ghana",
  business_type: "Hospitality",
  verification_status: "BUYER_VERIFIED",
  reviewed_by_user_id: admin.id,
  reviewed_at: "2026-06-01 09:00:00",
});

const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (id, buyer_id, supplier_business_id, product_summary, currency, value_cents, state, eta)
  VALUES (@id, @buyer_id, @supplier_business_id, @product_summary, @currency, @value_cents, @state, @eta)
`);
const insertTransition = db.prepare(`
  INSERT OR IGNORE INTO order_state_transitions (id, order_id, from_state, to_state, actor_user_id, reason)
  VALUES (@id, @order_id, @from_state, @to_state, @actor_user_id, @reason)
`);

const ORDERS = [
  { id: "ORD-8842", buyer_id: buyer.id, supplier_business_id: "SUP-002", product_summary: "Hotel Dining Chairs (1,000 units)", currency: "USD", value_cents: 2750000, state: "SHIPPED", eta: "2026-08-02" },
  { id: "ORD-8830", buyer_id: buyer.id, supplier_business_id: "SUP-001", product_summary: "450W Solar Panels (120 units)", currency: "USD", value_cents: 920000, state: "PRODUCTION_STARTED", eta: "2026-08-18" },
  { id: "ORD-8811", buyer_id: buyer.id, supplier_business_id: "SUP-003", product_summary: "EV Charging Cables (300 units)", currency: "USD", value_cents: 1140000, state: "INSPECTION_IN_PROGRESS", eta: "2026-08-10" },
  { id: "ORD-8790", buyer_id: buyer.id, supplier_business_id: "SUP-004", product_summary: "Smart Door Locks (150 units)", currency: "USD", value_cents: 390000, state: "COMPLETED", eta: "2026-06-30" },
  { id: "ORD-8776", buyer_id: buyer.id, supplier_business_id: "SUP-005", product_summary: "Rock Crusher Unit", currency: "USD", value_cents: 490000, state: "RECEIVED", eta: "2026-07-25" },
];

for (const o of ORDERS) {
  insertOrder.run(o);
  // Deterministic id (not genId(), which is fresh random every run) so INSERT OR IGNORE
  // actually dedupes across repeated `npm run seed` calls instead of appending a new row every
  // time — order_state_transitions has no unique constraint to catch this the way businesses/
  // buyer_profiles do via their owner/user_id uniqueness.
  insertTransition.run({
    id: `TRN-SEED-${o.id}`,
    order_id: o.id,
    from_state: "DRAFT",
    to_state: o.state,
    actor_user_id: null,
    reason: "Seed data initial state",
  });
}

// Conversation history, seeded only for ORD-8830 — the one order in this demo where both the
// buyer and the supplier business actually have a login. The other seeded suppliers have no
// owner_user_id (same as a real factory that hasn't signed up yet), so there is no legitimate
// user to attribute a "supplier" message to on those orders. Their conversations start empty
// and get created for real the first time either side opens or sends a message.
const insertConversation = db.prepare("INSERT OR IGNORE INTO conversations (id, order_id, created_at) VALUES (?, ?, ?)");
const insertParticipant = db.prepare(
  "INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)"
);
const insertMessage = db.prepare(`
  INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, body, related_order_id, created_at)
  VALUES (@id, @conversation_id, @sender_id, @body, @related_order_id, @created_at)
`);

// Deterministic ids here too, same reason as the transitions above.
const seedConversationId = "CONV-SEED-8830";
insertConversation.run(seedConversationId, "ORD-8830", "2026-07-16 09:00:00");
insertParticipant.run(seedConversationId, buyer.id);
insertParticipant.run(seedConversationId, supplierUser.id);

const SEED_MESSAGES = [
  { id: "MSG-SEED-8830-1", sender_id: supplierUser.id, body: "Panels have passed initial quality checks, packaging begins tomorrow.", created_at: "2026-07-16 16:05:00" },
  { id: "MSG-SEED-8830-2", sender_id: buyer.id, body: "Thank you, please confirm the shipping date once available.", created_at: "2026-07-16 16:40:00" },
];
for (const m of SEED_MESSAGES) {
  insertMessage.run({ conversation_id: seedConversationId, related_order_id: "ORD-8830", ...m });
}

console.log("Seed complete.");
console.log("Demo logins:");
console.log(`  buyer:              ${buyer.email} / ${process.env.DEMO_BUYER_PASSWORD || "demo-buyer-pass"}`);
console.log(`  buyer (second):     ${buyerTwo.email} / ${process.env.DEMO_BUYER_TWO_PASSWORD || "demo-buyer-two-pass"}`);
console.log(`  supplier:           ${supplierUser.email} / ${process.env.DEMO_SUPPLIER_PASSWORD || "demo-supplier-pass"}`);
console.log(`  admin (super):      ${admin.email} / ${process.env.DEMO_ADMIN_PASSWORD || "demo-admin-pass"}`);
console.log(`  admin (verification): ${verificationAdmin.email} / ${process.env.DEMO_VERIFICATION_ADMIN_PASSWORD || "demo-verification-pass"}`);
console.log(`  admin (finance):    ${financeAdmin.email} / ${process.env.DEMO_FINANCE_ADMIN_PASSWORD || "demo-finance-pass"}`);
