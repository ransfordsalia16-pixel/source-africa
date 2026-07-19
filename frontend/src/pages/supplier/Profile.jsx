import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import { getMySupplier } from "../../services/api/suppliers.js";
import { getMyPayoutAccount, requestPayoutAccountChange } from "../../services/api/payoutAccounts.js";
import { trustLabel } from "../../utils/format.js";
import { useToast } from "../../context/ToastContext.jsx";

const DOCUMENTS = ["Business license", "Factory inspection", "Export history", "Certifications (ISO, CE, IEC)"];
const EMPTY_PAYOUT_FORM = { type: "bank", bankName: "", accountNumber: "", provider: "", phoneNumber: "", currentPassword: "" };

function PayoutAccountPanel() {
  const [account, setAccount] = useState(undefined); // undefined = loading
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_PAYOUT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function load() {
    getMyPayoutAccount().then(setAccount);
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await requestPayoutAccountChange({
        type: form.type,
        currentPassword: form.currentPassword,
        details:
          form.type === "bank"
            ? { bankName: form.bankName, accountNumber: form.accountNumber }
            : { provider: form.provider, phoneNumber: form.phoneNumber },
      });
      showToast("Payout account change requested. It enters a 24-hour cooling-off period before it becomes active — this protects you if your account is ever compromised.");
      setEditing(false);
      setForm(EMPTY_PAYOUT_FORM);
      load();
    } catch (err) {
      setError(err.message || "Could not update your payout account.");
    } finally {
      setSaving(false);
    }
  }

  if (account === undefined) return null;

  return (
    <Panel title="Payout account">
      <p className="muted" style={{ marginBottom: 14 }}>
        Where SourceBridge sends your funds once a payout is released. Changing this requires your password and takes 24 hours to become active.
      </p>

      {account.active ? (
        <div className="doc-checklist" style={{ marginBottom: 14 }}>
          <li>{account.active.maskedDetails} <span className="pill pill-ok">Active</span></li>
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 14 }}>No active payout account yet.</p>
      )}

      {account.pending.map((p) => (
        <div key={p.id} className="doc-checklist" style={{ marginBottom: 14 }}>
          <li>{p.maskedDetails} <span className="pill pill-warn">Cooling off until {new Date(p.activatesAt).toLocaleString()}</span></li>
        </div>
      ))}

      {!editing ? (
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
          {account.active ? "Change payout account" : "Add payout account"}
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Account type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="bank">Bank account</option>
              <option value="mobile_money">Mobile money</option>
            </select>
          </div>
          {form.type === "bank" ? (
            <div className="form-row">
              <div className="form-field">
                <label>Bank name</label>
                <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Ghana Commercial Bank" />
              </div>
              <div className="form-field">
                <label>Account number</label>
                <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="0123456789" />
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-field">
                <label>Provider</label>
                <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="MTN Mobile Money" />
              </div>
              <div className="form-field">
                <label>Phone number</label>
                <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="0201234567" />
              </div>
            </div>
          )}
          <div className="form-field">
            <label>Confirm your password</label>
            <input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} placeholder="Required to change payout details" />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? "Saving..." : "Save payout account"}</button>{" "}
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setEditing(false); setForm(EMPTY_PAYOUT_FORM); setError(""); }}>Cancel</button>
        </form>
      )}
    </Panel>
  );
}

export default function SupplierProfile() {
  const [me, setMe] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    getMySupplier().then(setMe);
  }, []);

  if (!me) return null;

  return (
    <>
      <PageHeader title="Company profile" subtitle="This is what buyers see when they open your storefront." />
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="pill pill-warn">{trustLabel(me.trustLevel)}</span>
            <h2 style={{ marginTop: 10 }}>{me.name}</h2>
            <p className="muted">{me.location} · {me.type} · Founded {me.established} · {me.employees} employees</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="muted" style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase" }}>Trust score</span>
            <strong style={{ fontSize: "2rem", color: "var(--forest)" }}>
              {me.trustScore}<span className="muted" style={{ fontSize: "1rem" }}>/100</span>
            </strong>
          </div>
        </div>

        <div className="doc-checklist" style={{ marginTop: 18 }}>
          {DOCUMENTS.map((doc) => {
            const isVerified = me.verified.some((v) => doc.startsWith(v));
            return (
              <li key={doc}>
                {doc} <span className={`pill ${isVerified ? "pill-ok" : "pill-danger"}`}>{isVerified ? "Verified" : "Missing"}</span>
              </li>
            );
          })}
        </div>

        <h2 style={{ marginTop: 22 }}>Photos of your company</h2>
        <div className="media-grid">
          <div>Factory entrance</div>
          <div>Production line</div>
          <div>Warehouse</div>
          <div>Your team</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => showToast("Uploaded. SourceBridge will review it shortly.")}>
            Add a photo or video
          </button>
        </div>
      </Panel>

      <PayoutAccountPanel />
    </>
  );
}
