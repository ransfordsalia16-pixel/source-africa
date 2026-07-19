import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Deliberately not reachable from the main navigation or any public call-to-action — only a
// small footer link on the marketing page points here. This is the only place in the app that
// can put a session into the admin dashboard, and even here, the actual authorization decision
// belongs to the server: every /api/admin/* route re-checks the role on every request regardless
// of what this page decides.
export default function AdminSignIn() {
  const { signIn, verifyMfaLogin, discardSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function proceedAfterSignIn(session) {
    if (session.role !== "admin") {
      discardSession();
      setError("This account doesn't have admin access.");
      return;
    }
    navigate("/admin", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        return;
      }
      proceedAfterSignIn(result);
    } catch (err) {
      setError(err.message || "Something went wrong signing you in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const session = await verifyMfaLogin(mfaToken, code.trim());
      proceedAfterSignIn(session);
    } catch (err) {
      setError(err.message || "That code isn't valid.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen admin-auth-screen">
      <div className="auth-card admin-auth-card">
        <span className="welcome-brand-inline auth-card-brand">
          <span className="welcome-mark admin-mark">SB</span> SourceBridge Africa
        </span>
        <span className="admin-portal-tag">Admin portal</span>

        {mfaToken ? (
          <>
            <h1>Enter your code</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              Enter the 6-digit code from your authenticator app, or one of your backup codes.
            </p>
            <form onSubmit={handleVerifyCode}>
              <div className="form-field">
                <label>Code</label>
                <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoComplete="one-time-code" autoFocus />
              </div>
              {error && <p style={{ color: "#ffb4b0", fontSize: "0.86rem", marginBottom: 14 }}>{error}</p>}
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Verifying..." : "Verify and sign in"}
              </button>
            </form>
            <p className="auth-card-footnote admin-auth-footnote">
              <button type="button" onClick={() => { setMfaToken(null); setCode(""); setError(""); }} style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", textDecoration: "underline" }}>
                Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>Admin sign in</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              Restricted access. Sign-in attempts and every subsequent action are logged.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label>Admin email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sourcebridge.example" autoComplete="username" />
              </div>
              <div className="form-field">
                <label>Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
              {error && <p style={{ color: "#ffb4b0", fontSize: "0.86rem", marginBottom: 14 }}>{error}</p>}
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Verifying..." : "Sign in"}
              </button>
            </form>

            <p className="auth-card-footnote admin-auth-footnote">
              <Link to="/">Back to SourceBridge Africa</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
