import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const INTENTS = [
  { key: "buy", title: "Buyer", desc: "I want to source products from verified suppliers." },
  { key: "sell", title: "Supplier", desc: "I want to sell products to buyers on the platform." },
  { key: "both", title: "Buyer & Supplier", desc: "I want to do both." },
];

export default function CreateAccount() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [intent, setIntent] = useState("buy");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      // Every account this form creates is a buyer account — "intent" is just what the person
      // told us they came here to do, stored for later, never something the request body can
      // use to grant supplier or admin access. The server independently enforces the same rule.
      await register({ name, email, password, intent });
      if (intent !== "buy") {
        showToast("Your buyer account is ready. Supplier applications are coming soon.");
      }
      navigate("/buyer", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong creating your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card-wide">
        <Link to="/" className="welcome-brand-inline auth-card-brand">
          <span className="welcome-mark">SB</span> SourceBridge Africa
        </Link>
        <h1>Create your account</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Every account starts as a buyer account. You can apply to sell later.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>What brings you to the platform?</label>
            <div className="intent-cards">
              {INTENTS.map((i) => (
                <button
                  type="button"
                  key={i.key}
                  className={`intent-card ${intent === i.key ? "active" : ""}`}
                  onClick={() => setIntent(i.key)}
                >
                  <strong>{i.title}</strong>
                  <span>{i.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>Full name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            <div className="form-field">
              <label>Confirm password</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" autoComplete="new-password" />
            </div>
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 14 }}>{error}</p>}
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Creating your account..." : "Create account"}
          </button>
        </form>

        <p className="auth-card-footnote">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
