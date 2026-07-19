import { apiFetch, setToken, clearToken } from "./client.js";
import { buyerProfile, supplierProfile, adminProfile } from "../mock/data.js";
import { toFrontendRole } from "../../constants/roles.js";

// Cosmetic-only fallback (company name, job title, trust level) for the three seeded demo
// accounts, keyed by their known user id, so their dashboards keep showing richer profile data
// than the real backend models yet. A newly registered account simply won't match anything here
// and falls back to the server's own fields (name, location, avatar initials) with no fake
// company or trust level attached. This is never consulted for authorization, only display.
const COSMETIC_FALLBACK_BY_USER_ID = {
  [buyerProfile.id]: buyerProfile,
  [supplierProfile.id]: supplierProfile,
  [adminProfile.id]: adminProfile,
};

const STORAGE_KEY = "sourcebridge.session";

function buildSession(user) {
  const cosmetic = COSMETIC_FALLBACK_BY_USER_ID[user.id];
  return {
    // Always derived from what the server says this account's role_key is — never from
    // anything the caller chose or passed in. toFrontendRole is a fixed mapping (several
    // granular admin role_keys all bucket to "admin"), not a client choice.
    role: toFrontendRole(user.role),
    serverRole: user.role,
    profile: {
      ...cosmetic,
      name: user.name,
      location: user.location || cosmetic?.location,
      avatarInitials: user.avatarInitials || cosmetic?.avatarInitials || user.name?.slice(0, 2)?.toUpperCase(),
      // Always the real column now (see domain/mfa.js) — never the cosmetic fallback's
      // hardcoded value, which would otherwise mask the actual state for the 3 demo accounts.
      mfaEnabled: !!user.mfaEnabled,
    },
    onboardingIntent: user.onboardingIntent || null,
    signedInAt: new Date().toISOString(),
  };
}

async function persistSession(token, user) {
  setToken(token);
  const session = buildSession(user);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

// Returns either a full session (unchanged, most accounts) or, for an account with two-factor
// sign-in on, { mfaRequired: true, mfaToken } — no session is written yet in that case. The
// caller (AuthContext) is responsible for telling these two shapes apart.
export async function signIn(email, password) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.mfaRequired) return result;
  return persistSession(result.token, result.user);
}

export async function verifyMfaLogin(mfaToken, code) {
  const { token, user } = await apiFetch("/api/auth/login/mfa", {
    method: "POST",
    body: JSON.stringify({ mfaToken, code }),
  });
  return persistSession(token, user);
}

export async function register({ name, email, password, intent }) {
  const { token, user } = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, intent }),
  });
  return persistSession(token, user);
}

// Used by the admin sign-in page to reject a non-admin account without ever writing a session
// for it in the first place. This is a UX nicety, not a security boundary — every admin API
// route independently re-checks the server-side role regardless of what the frontend does here.
export function discardSession() {
  localStorage.removeItem(STORAGE_KEY);
  clearToken();
}

export async function signOut() {
  discardSession();
}

// Re-derives the session from whatever the server currently says this account's role_key is.
// Needed because a role can change server-side mid-session (e.g. a supplier application being
// approved flips buyer -> supplier) and the cached session above only gets built once, at
// sign-in/register time — nothing else refreshes it automatically.
export async function refreshSession() {
  const { user } = await apiFetch("/api/auth/me");
  const session = buildSession(user);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
