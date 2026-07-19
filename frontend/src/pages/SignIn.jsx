import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignIn() {
  const { signIn, verifyMfaLogin, discardSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function proceedAfterSignIn(session) {
    if (session.role === "admin") {
      // Right password, wrong door. No session for an admin account is left sitting around
      // after using the public form — they're pointed at the admin sign in instead.
      discardSession();
      setError("This sign in is for buyer and supplier accounts. Admin accounts use the admin sign in below.");
      return;
    }
    const redirectTo = location.state?.from?.pathname;
    navigate(redirectTo && redirectTo !== "/" ? redirectTo : `/${session.role}`, { replace: true });
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
    <div className="auth-screen">
      <div className="auth-card">
        <Link to="/" className="welcome-brand-inline auth-card-brand">
          <span className="welcome-mark">SB</span> SourceBridge Africa
        </Link>

        {mfaToken ? (
          <>
            <h1>Enter your code</h1>
            <p className="muted" style={{ marginBottom: 24 }}>Enter the 6-digit code from your authenticator app, or one of your backup codes.</p>
            <form onSubmit={handleVerifyCode}>
              <div className="form-field">
                <label>Code</label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 14 }}>{error}</p>}
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Verifying..." : "Verify and sign in"}
              </button>
            </form>
            <p className="auth-card-footnote">
              <button type="button" onClick={() => { setMfaToken(null); setCode(""); setError(""); }} style={{ background: "none", border: "none", padding: 0, color: "var(--forest)", cursor: "pointer", textDecoration: "underline" }}>
                Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p className="muted" style={{ marginBottom: 24 }}>Welcome back. Sign in to your buyer or supplier account.</p>

            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
              </div>
              <div className="form-field">
                <label>Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
              {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 14 }}>{error}</p>}
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="auth-card-footnote">
              New to SourceBridge? <Link to="/create-account">Create an account</Link>
            </p>
            <p className="auth-card-footnote">
              <Link to="/admin-login">Admin sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
