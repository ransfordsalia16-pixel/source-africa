-- SourceBridge Africa backend schema, Stage 1.
-- Money is stored as integer cents. All ids are stable text ids. All tables carry created_at.
-- Tables marked [STAGE 2+] exist now so later stages don't need a migration, but have no
-- endpoints yet in this stage.

CREATE TABLE IF NOT EXISTS roles (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key TEXT PRIMARY KEY REFERENCES roles(key),
  verification INTEGER NOT NULL DEFAULT 0,
  payments INTEGER NOT NULL DEFAULT 0,
  disputes INTEGER NOT NULL DEFAULT 0,
  settings INTEGER NOT NULL DEFAULT 0,
  support INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role_key TEXT NOT NULL REFERENCES roles(key),
  location TEXT,
  avatar_initials TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  -- AES-256-GCM encrypted (see security/encryption.js), never plaintext. mfa_pending holds a
  -- newly generated secret during enrollment, before the user has proven they can actually
  -- generate a valid code with it — mfa_enabled only flips on once that's confirmed, so a
  -- half-finished enrollment can never silently lock an account's real secret in.
  mfa_secret_encrypted TEXT,
  mfa_pending_secret_encrypted TEXT,
  last_login_at TEXT,
  -- What the person said they came here to do at signup ("buy", "sell", "both"). Display and
  -- analytics only: no authorization check anywhere in this codebase reads this column. Actual
  -- permissions come only from role_key, which self-registration always sets to 'buyer'.
  onboarding_intent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time recovery codes for when a device with the authenticator app is lost. Hashed with the
-- same bcrypt already used for passwords — never stored in plaintext. Each row is used at most
-- once (used_at gets set on first successful use, see domain/mfa.js's verifyLoginCode).
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user ON mfa_backup_codes(user_id);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT,
  location TEXT,
  established_year INTEGER,
  employees TEXT,
  category TEXT,
  trust_level TEXT NOT NULL DEFAULT 'unverified',
  trust_score INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  products_summary TEXT,
  -- Backend-controlled supplier application/verification lifecycle. Distinct from trust_level
  -- above, which is a buyer-facing trust tier assigned only once a business is verified.
  -- Defaults to already-verified because that default also backfills the pre-existing seeded
  -- businesses (which never went through the application flow) on both fresh installs and the
  -- ALTER TABLE guard in migrate.js. See domain/supplierVerification.js for the state machine.
  verification_status TEXT NOT NULL DEFAULT 'SUPPLIER_VERIFIED',
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One business per owner. NULLs (the seeded demo factories with no owner_user_id) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_owner_unique ON businesses(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- A buyer's company info, reviewed by an admin as a trust indicator. Distinct from businesses:
-- a business is a supplier's storefront (products, trust_level shown to buyers); a buyer
-- profile is just "is this buyer's company real", and verifying it doesn't grant any role or
-- permission. See domain/buyerVerification.js for the (smaller, three-state) state machine.
CREATE TABLE IF NOT EXISTS buyer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  company_name TEXT NOT NULL,
  location TEXT,
  business_type TEXT,
  verification_status TEXT NOT NULL DEFAULT 'BUYER_VERIFICATION_PENDING',
  review_notes TEXT,
  reviewed_by_user_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products ( -- [STAGE 2+: no write endpoints yet]
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  category TEXT,
  price_label TEXT,
  moq TEXT,
  production_time TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  inquiries INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Supplier application documents (business license, tax certificate, etc.), uploaded while a
-- business's verification_status is SUPPLIER_APPLICATION_STARTED or SUPPLIER_REJECTED and
-- reviewed by an admin during SUPPLIER_VERIFICATION_PENDING. See routes/businessApplications.js.
CREATE TABLE IF NOT EXISTS business_documents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL, -- 'business_license' | 'tax_certificate' | 'export_license' | 'bank_verification' | 'certification' | 'other'
  file_path TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_images (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  file_path TEXT NOT NULL,
  caption TEXT,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- History of businesses.verification_status changes. Mirrors order_state_transitions.
CREATE TABLE IF NOT EXISTS business_verification_transitions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_business_documents_business ON business_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_business_images_business ON business_images(business_id);
CREATE INDEX IF NOT EXISTS idx_business_verification_transitions_business ON business_verification_transitions(business_id);

-- A buyer's sourcing request (RFQ), browsable by any supplier once open. No state-machine
-- complexity needed here, unlike orders — status just tracks whether anyone has quoted yet.
CREATE TABLE IF NOT EXISTS sourcing_requests (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  product TEXT NOT NULL,
  quantity TEXT,
  budget TEXT,
  destination TEXT,
  required_by TEXT,
  specs TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | QUOTED | CLOSED
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

-- A supplier's quote against a sourcing request. Only the buyer who owns the request sees every
-- quote's price; a supplier browsing open requests only ever sees their own quote, never a
-- competitor's price. See domain/sourcingRequests.js.
CREATE TABLE IF NOT EXISTS sourcing_request_quotes (
  id TEXT PRIMARY KEY,
  sourcing_request_id TEXT NOT NULL REFERENCES sourcing_requests(id),
  supplier_business_id TEXT NOT NULL REFERENCES businesses(id),
  price_label TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sourcing_requests_buyer ON sourcing_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_status ON sourcing_requests(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_request_quotes_request ON sourcing_request_quotes(sourcing_request_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_request_quotes_supplier ON sourcing_request_quotes(supplier_business_id);
-- One quote per supplier per request — domain/sourcingRequests.js also checks this up front for
-- a clean error message, but the constraint is the actual guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sourcing_request_quotes_unique ON sourcing_request_quotes(sourcing_request_id, supplier_business_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  supplier_business_id TEXT NOT NULL REFERENCES businesses(id),
  product_summary TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  value_cents INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'DRAFT',
  -- Which transaction-protection path this order follows ('standard' | 'high_value' | 'custom'),
  -- decided once at order creation (see domain/orders.js) and shown to both sides up front —
  -- never re-computed mid-order. Distinct from order state, which tracks where the order
  -- currently is; this tracks which path it's on.
  protection_model TEXT NOT NULL DEFAULT 'standard',
  version INTEGER NOT NULL DEFAULT 1,
  eta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items ( -- [STAGE 2+: single-item orders only for now]
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT REFERENCES products(id),
  quantity TEXT,
  unit_price_cents INTEGER
);

-- A snapshot of order terms at a point in time. One row is written at order creation
-- (version_number 1); this is what payments.order_version_id points to, so a payment record is
-- always traceable to the exact terms it paid for, not just "whatever the order currently says."
-- Full order-editing (which would add version 2+) is out of scope for this phase.
CREATE TABLE IF NOT EXISTS order_versions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  version_number INTEGER NOT NULL,
  product_summary TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_versions_order ON order_versions(order_id);

CREATE TABLE IF NOT EXISTS order_state_transitions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_participants ( -- [STAGE 2+]
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  hidden_at TEXT,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  attachment_url TEXT,
  related_order_id TEXT REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  buyer_id TEXT REFERENCES users(id),
  supplier_business_id TEXT REFERENCES businesses(id),
  order_version_id TEXT REFERENCES order_versions(id),
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  refund_status TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT REFERENCES payments(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  signature_verified INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  supplier_business_id TEXT NOT NULL REFERENCES businesses(id),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  released_by_user_id TEXT REFERENCES users(id),
  released_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Where a supplier's payout would go. Never stores a full account/card number — only a masked
-- display value the owner can recognize (see domain/payoutAccounts.js). Changing this is treated
-- as a high-risk action: a new account starts 'pending_cooling_off' and only becomes 'active'
-- after activates_at passes, so a compromised session can't redirect payouts instantly.
CREATE TABLE IF NOT EXISTS payout_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL, -- 'bank' | 'mobile_money'
  masked_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_cooling_off', -- 'pending_cooling_off' | 'active' | 'replaced'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  activates_at TEXT NOT NULL,
  replaced_at TEXT
);

-- Audit trail specifically for payout-destination changes, separate from the general
-- audit_logs table so this specific high-risk action history is easy to pull on its own.
CREATE TABLE IF NOT EXISTS payout_account_changes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  payout_account_id TEXT NOT NULL REFERENCES payout_accounts(id),
  action TEXT NOT NULL, -- 'added' | 'replaced'
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payout_accounts_business ON payout_accounts(business_id);

CREATE TABLE IF NOT EXISTS disputes ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  opened_by_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'investigating',
  assigned_reviewer_id TEXT REFERENCES users(id),
  resolution TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS evidence ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  dispute_id TEXT REFERENCES disputes(id),
  order_id TEXT REFERENCES orders(id),
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  file_path TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inspections ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  inspector TEXT,
  result TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipments ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  carrier TEXT,
  origin TEXT,
  destination TEXT,
  stage TEXT,
  eta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications ( -- [STAGE 2+]
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_cases (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'dispute' | 'support_request'
  order_id TEXT REFERENCES orders(id),
  dispute_id TEXT REFERENCES disputes(id),
  opened_by_user_id TEXT REFERENCES users(id),
  subject TEXT,
  description TEXT,
  assigned_to_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'escalated' | 'closed'
  notes TEXT, -- unused as of Stage 5; superseded by case_notes below, left in place harmlessly
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- An attributed timeline of internal staff notes on a case. Never returned to the buyer or
-- supplier who opened the case — support_cases.subject/description is their own words back to
-- them, case_notes is the staff-only working log.
CREATE TABLE IF NOT EXISTS case_notes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES support_cases(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Generic audit trail. Every sensitive read or write by staff goes through here, including
-- order state transitions and (in later stages) conversation access.
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT,
  case_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_business_id);
CREATE INDEX IF NOT EXISTS idx_transitions_order ON order_state_transitions(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
