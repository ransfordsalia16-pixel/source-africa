import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../services/api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authApi.getStoredSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Keeps things in sync if the user signs out from another tab.
    function onStorage(e) {
      if (e.key === "sourcebridge.session") {
        setSession(authApi.getStoredSession());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Returns either the new session (unchanged behavior) or { mfaRequired: true, mfaToken } —
  // in the latter case no session is set yet, since the sign-in isn't actually finished. The
  // caller (SignIn.jsx / AdminSignIn.jsx) is expected to check for mfaRequired and, if present,
  // collect a code and call verifyMfaLogin instead of treating this as a completed sign-in.
  async function signIn(email, password) {
    setLoading(true);
    try {
      const result = await authApi.signIn(email, password);
      if (result.mfaRequired) return result;
      setSession(result);
      return result;
    } finally {
      setLoading(false);
    }
  }

  async function verifyMfaLogin(mfaToken, code) {
    setLoading(true);
    try {
      const nextSession = await authApi.verifyMfaLogin(mfaToken, code);
      setSession(nextSession);
      return nextSession;
    } finally {
      setLoading(false);
    }
  }

  async function register(payload) {
    setLoading(true);
    try {
      const nextSession = await authApi.register(payload);
      setSession(nextSession);
      return nextSession;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await authApi.signOut();
    setSession(null);
  }

  // Used when a sign-in technically succeeded (right credentials) but the account isn't allowed
  // to be here (e.g. a non-admin at the admin sign-in page) — discards whatever session was just
  // created instead of leaving it sitting in localStorage for a route guard to catch later.
  function discardSession() {
    authApi.discardSession();
    setSession(null);
  }

  // Re-fetches the account's current role from the server and updates the cached session. Used
  // after an action that might have changed the signed-in user's role server-side (e.g. a
  // supplier application being approved) — see pages/buyer/BecomeSupplier.jsx.
  async function refreshSession() {
    const nextSession = await authApi.refreshSession();
    setSession(nextSession);
    return nextSession;
  }

  const value = {
    session,
    role: session?.role || null,
    profile: session?.profile || null,
    isAuthenticated: !!session,
    loading,
    signIn,
    verifyMfaLogin,
    register,
    signOut,
    discardSession,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
