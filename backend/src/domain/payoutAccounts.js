import bcrypt from "bcryptjs";
import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";
import { getBusinessOwnedBy } from "./orderAccess.js";

export class NoVerifiedBusinessError extends Error {
  constructor() {
    super("Only a verified supplier business can manage a payout account.");
    this.status = 403;
  }
}
export class InvalidPasswordError extends Error {
  constructor() {
    super("Your current password is incorrect.");
    this.status = 401;
  }
}

const COOLING_OFF_HOURS = 24;

const getPasswordHash = db.prepare("SELECT password_hash FROM users WHERE id = ?");
const insertAccount = db.prepare(`
  INSERT INTO payout_accounts (id, business_id, type, masked_details, status, activates_at)
  VALUES (@id, @business_id, @type, @masked_details, 'pending_cooling_off', @activates_at)
`);
const insertChange = db.prepare(`
  INSERT INTO payout_account_changes (id, business_id, payout_account_id, action, actor_user_id)
  VALUES (@id, @business_id, @payout_account_id, @action, @actor_user_id)
`);
const getActiveAccount = db.prepare("SELECT * FROM payout_accounts WHERE business_id = ? AND status = 'active' LIMIT 1");
const getPendingAccounts = db.prepare("SELECT * FROM payout_accounts WHERE business_id = ? AND status = 'pending_cooling_off' ORDER BY created_at DESC");
const markReplaced = db.prepare("UPDATE payout_accounts SET status = 'replaced', replaced_at = datetime('now') WHERE id = ?");
const markActive = db.prepare("UPDATE payout_accounts SET status = 'active' WHERE id = ?");

// Never stores a real account number — only enough to let the owner recognize which account
// this is (last 4 digits + the bank/provider name they gave us).
function maskDetails(type, details) {
  const last4 = String(details.accountNumber || details.phoneNumber || "").slice(-4).padStart(4, "*");
  const label = type === "mobile_money" ? details.provider : details.bankName;
  return `${label || "Account"} ****${last4}`;
}

function requireVerifiedBusiness(user) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business || business.verification_status !== "SUPPLIER_VERIFIED") {
    throw new NoVerifiedBusinessError();
  }
  return business;
}

// Activates any pending account whose cooling-off period has elapsed. Called lazily on every
// read instead of via a cron job — fine for a system this size, and means "is it active yet"
// is always answered from the current time, not a stale flag.
function activateDueAccounts(businessId) {
  const now = new Date().toISOString();
  for (const pending of getPendingAccounts.all(businessId)) {
    if (pending.activates_at <= now) {
      const current = getActiveAccount.get(businessId);
      if (current) markReplaced.run(current.id);
      markActive.run(pending.id);
    }
  }
}

export function getMyPayoutAccount(user) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business) return { active: null, pending: [] };
  activateDueAccounts(business.id);
  return {
    active: getActiveAccount.get(business.id) || null,
    pending: getPendingAccounts.all(business.id),
  };
}

// The high-risk action: adding or changing where payouts go. Requires the caller to re-type
// their current password (verified against the real hash, not trusted from the session alone)
// and never takes effect immediately — it sits in a cooling-off period first, so a hijacked
// session can queue a change but can't redirect a payout that same day.
export function requestPayoutAccountChange(user, { type, details, currentPassword }) {
  const business = requireVerifiedBusiness(user);

  const row = getPasswordHash.get(user.id);
  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw new InvalidPasswordError();
  }

  activateDueAccounts(business.id);
  const hadActiveAccount = !!getActiveAccount.get(business.id);

  const activatesAt = new Date(Date.now() + COOLING_OFF_HOURS * 60 * 60 * 1000).toISOString();
  const account = {
    id: genId("PACC"),
    business_id: business.id,
    type,
    masked_details: maskDetails(type, details),
    activates_at: activatesAt,
  };
  insertAccount.run(account);
  insertChange.run({
    id: genId("PACHG"),
    business_id: business.id,
    payout_account_id: account.id,
    action: hadActiveAccount ? "replaced" : "added",
    actor_user_id: user.id,
  });
  recordAuditLog({
    actorUserId: user.id,
    action: `${hadActiveAccount ? "Requested a change to" : "Added"} the payout account for business ${business.id}: ${account.masked_details}`,
    targetType: "payout_account",
    targetId: account.id,
  });

  return db.prepare("SELECT * FROM payout_accounts WHERE id = ?").get(account.id);
}
