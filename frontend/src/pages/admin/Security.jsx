import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import Modal from "../../components/Modal.jsx";
import { getAuditLog, getRolePermissions } from "../../services/api/audit.js";
import { startEnrollment, confirmEnrollment, disableMfa } from "../../services/api/mfa.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

const COLUMNS = [
  { key: "verification", label: "Verification" },
  { key: "payments", label: "Payments" },
  { key: "disputes", label: "Disputes" },
  { key: "settings", label: "Settings" },
  { key: "support", label: "Support" },
];

function MfaPanel() {
  const { profile, refreshSession } = useAuth();
  const [enrolling, setEnrolling] = useState(null); // { secret, otpauthUrl }
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  async function handleStartEnroll() {
    setBusy(true);
    setError("");
    try {
      const result = await startEnrollment();
      setEnrolling(result);
      setCode("");
    } catch (err) {
      showToast(err.message || "Could not start enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await confirmEnrollment(code.trim());
      setEnrolling(null);
      setBackupCodes(result.backupCodes);
      await refreshSession();
    } catch (err) {
      setError(err.message || "That code isn't valid.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await disableMfa(password);
      setDisabling(false);
      setPassword("");
      showToast("Two-factor sign-in is now off.");
      await refreshSession();
    } catch (err) {
      setError(err.message || "Could not turn off two-factor sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Your session">
      <div className="session-card">
        <div className="avatar">{profile?.avatarInitials}</div>
        <div>
          <strong style={{ display: "block" }}>{profile?.name}</strong>
          <span className="muted">{profile?.role} · Last signed in {profile?.lastLogin}</span>
        </div>
        <span className={`pill ${profile?.mfaEnabled ? "pill-ok" : "pill-danger"}`} style={{ marginLeft: "auto" }}>
          {profile?.mfaEnabled ? "Two factor sign in on" : "Two factor sign in off"}
        </span>
      </div>

      {!profile?.mfaEnabled && !enrolling && (
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={handleStartEnroll} disabled={busy}>
          Turn on two-factor sign-in
        </button>
      )}

      {enrolling && (
        <form onSubmit={handleConfirm} style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 10 }}>
            Add this key to an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.
          </p>
          <div className="doc-checklist" style={{ marginBottom: 14 }}>
            <li>Secret key <code style={{ userSelect: "all" }}>{enrolling.secret}</code></li>
          </div>
          <div className="form-field">
            <label>6-digit code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{busy ? "Confirming..." : "Confirm and turn on"}</button>{" "}
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setEnrolling(null); setError(""); }}>Cancel</button>
        </form>
      )}

      {profile?.mfaEnabled && !disabling && (
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => { setDisabling(true); setError(""); }}>
          Turn off two-factor sign-in
        </button>
      )}

      {disabling && (
        <form onSubmit={handleDisable} style={{ marginTop: 16 }}>
          <div className="form-field">
            <label>Confirm your password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required to turn off two-factor sign-in" autoFocus />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
          <button className="btn btn-danger btn-sm" type="submit" disabled={busy}>{busy ? "Turning off..." : "Turn off two-factor sign-in"}</button>{" "}
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setDisabling(false); setPassword(""); setError(""); }}>Cancel</button>
        </form>
      )}

      <Modal
        open={!!backupCodes}
        onClose={() => setBackupCodes(null)}
        title="Save your backup codes"
        footer={<button className="btn btn-primary" onClick={() => setBackupCodes(null)}>I've saved these codes</button>}
      >
        <p style={{ color: "var(--danger)", marginBottom: 14 }}>
          Save these now. Each works once, if you lose access to your authenticator app, and they will not be shown again.
        </p>
        <div className="doc-checklist">
          {backupCodes?.map((c) => (
            <li key={c}><code style={{ userSelect: "all" }}>{c}</code></li>
          ))}
        </div>
      </Modal>
    </Panel>
  );
}

export default function AdminSecurity() {
  const [auditLog, setAuditLog] = useState([]);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    getAuditLog().then(setAuditLog);
    getRolePermissions().then(setPermissions);
  }, []);

  return (
    <>
      <PageHeader title="Security and access" subtitle="How SourceBridge keeps admin access tightly controlled and fully accountable." />

      <MfaPanel />

      <Panel title="Who can do what">
        <p className="muted" style={{ marginBottom: 14 }}>
          No single role can do everything. A founder can see and approve anything, but day to day work is spread across roles so one login being compromised does not put the whole platform at risk.
        </p>
        <div className="table-wrap">
          <table className="data-table rbac-table">
            <thead>
              <tr>
                <th>Role</th>
                {COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.role}>
                  <td>{p.role}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={p[c.key] ? "rbac-yes" : "rbac-no"}>
                      {p[c.key] ? "Yes" : "No"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Everything that has happened here is on record">
        <p className="muted" style={{ marginBottom: 14 }}>
          Approvals, payment releases, and document access are all logged permanently. Nobody, including the founder, can quietly edit or remove an entry.
        </p>
        {auditLog.map((l) => (
          <div key={l.id} className="list-item-row">
            <div>
              <strong>{l.action}</strong>
              <br />
              <span className="muted">{l.actor}</span>
            </div>
            <span className="muted">{l.time}</span>
          </div>
        ))}
      </Panel>
    </>
  );
}
