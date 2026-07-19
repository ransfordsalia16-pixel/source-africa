import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import Modal from "../../components/Modal.jsx";
import {
  listAdminApplications,
  getAdminApplication,
  transitionAdminApplication,
  openAdminDocumentFile,
  openAdminImageFile,
} from "../../services/api/businessApplications.js";
import { useToast } from "../../context/ToastContext.jsx";

const FILTERS = [
  { value: "SUPPLIER_VERIFICATION_PENDING", label: "Pending review" },
  { value: "", label: "All applications" },
  { value: "SUPPLIER_VERIFIED", label: "Verified" },
  { value: "SUPPLIER_RESTRICTED", label: "Restricted" },
  { value: "SUPPLIER_SUSPENDED", label: "Suspended" },
  { value: "SUPPLIER_REJECTED", label: "Rejected" },
];

// Which transitions an admin can take from each status — mirrors the server's TRANSITIONS map
// in domain/supplierVerification.js. This is a UI convenience only: the server independently
// re-validates every edge and rejects anything not actually legal from the real current state.
const ACTIONS_BY_STATUS = {
  SUPPLIER_VERIFICATION_PENDING: [
    { toState: "SUPPLIER_VERIFIED", label: "Approve", gerund: "approving", pastTense: "approved", className: "btn-primary" },
    { toState: "SUPPLIER_REJECTED", label: "Reject", gerund: "rejecting", pastTense: "rejected", className: "btn-danger" },
    { toState: "SUPPLIER_RESTRICTED", label: "Restrict", gerund: "restricting", pastTense: "restricted", className: "btn-secondary" },
  ],
  SUPPLIER_VERIFIED: [
    { toState: "SUPPLIER_RESTRICTED", label: "Restrict", gerund: "restricting", pastTense: "restricted", className: "btn-secondary" },
    { toState: "SUPPLIER_SUSPENDED", label: "Suspend", gerund: "suspending", pastTense: "suspended", className: "btn-danger" },
  ],
  SUPPLIER_RESTRICTED: [
    { toState: "SUPPLIER_VERIFIED", label: "Reinstate", gerund: "reinstating", pastTense: "reinstated", className: "btn-primary" },
    { toState: "SUPPLIER_SUSPENDED", label: "Suspend", gerund: "suspending", pastTense: "suspended", className: "btn-danger" },
  ],
  SUPPLIER_SUSPENDED: [
    { toState: "SUPPLIER_VERIFIED", label: "Reinstate", gerund: "reinstating", pastTense: "reinstated", className: "btn-primary" },
    { toState: "SUPPLIER_RESTRICTED", label: "Restrict", gerund: "restricting", pastTense: "restricted", className: "btn-secondary" },
  ],
};

const DOCUMENT_TYPE_LABELS = {
  business_license: "Business license",
  tax_certificate: "Tax registration certificate",
  export_license: "Export license",
  bank_verification: "Bank account verification",
  certification: "Product certification",
  other: "Other",
};

export default function AdminSupplierApplications() {
  const [filter, setFilter] = useState(FILTERS[0].value);
  const [applications, setApplications] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState(null); // { toState, label }
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function load() {
    listAdminApplications(filter || undefined).then(setApplications);
  }

  useEffect(load, [filter]);

  function openApplication(app) {
    setViewing(app);
    setAction(null);
    setReason("");
    setError("");
    getAdminApplication(app.id).then(setDetail);
  }

  async function handleTransition(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await transitionAdminApplication(viewing.id, action.toState, reason.trim());
      showToast(`${detail.business.name} is now ${action.pastTense}.`);
      setViewing(null);
      load();
    } catch (err) {
      setError(err.message || "Could not update this application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Supplier applications"
        subtitle="Real applicant accounts applying to sell on SourceBridge — separate from the legacy demo queue under Supplier verification."
        actions={
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        }
      />
      <Panel>
        <DataTable
          empty="No applications match this filter."
          columns={[
            { label: "Business", render: (b) => (<><strong>{b.name}</strong><br /><span className="muted">{b.location}</span></>) },
            { label: "Type", key: "type" },
            { label: "Status", render: (b) => <StatusPill status={b.verificationStatus} /> },
            { label: "Submitted", render: (b) => b.createdAt },
            { label: "", render: (b) => <button className="btn btn-secondary btn-sm" onClick={() => openApplication(b)}>Review</button> },
          ]}
          rows={applications}
        />
      </Panel>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={detail?.business.name}
        footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}
      >
        {detail && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <p className="muted">{detail.business.location} · {detail.business.type} · {detail.business.category}</p>
              <StatusPill status={detail.business.verificationStatus} />
            </div>
            {detail.business.description && <p style={{ marginBottom: 14 }}>{detail.business.description}</p>}
            {detail.business.productsSummary && (
              <p style={{ marginBottom: 14 }}><strong>Products and services:</strong> {detail.business.productsSummary}</p>
            )}
            <p className="muted" style={{ marginBottom: 14 }}>
              {detail.business.contactEmail || "No contact email"} · {detail.business.contactPhone || "No contact phone"} · {detail.business.website || "No website"}
            </p>

            <h2 style={{ fontSize: "0.95rem", marginBottom: 10 }}>Documents</h2>
            {detail.documents.length === 0 && <p className="muted" style={{ marginBottom: 14 }}>No documents uploaded yet.</p>}
            <div className="doc-checklist" style={{ marginBottom: 16 }}>
              {detail.documents.map((d) => (
                <li key={d.id}>
                  {DOCUMENT_TYPE_LABELS[d.type] || d.type}
                  <button className="btn btn-secondary btn-sm" onClick={() => openAdminDocumentFile(detail.business.id, d.id)}>View</button>
                </li>
              ))}
            </div>

            <h2 style={{ fontSize: "0.95rem", marginBottom: 10 }}>Photos</h2>
            {detail.images.length === 0 && <p className="muted" style={{ marginBottom: 14 }}>No photos uploaded yet.</p>}
            <div className="doc-checklist" style={{ marginBottom: 16 }}>
              {detail.images.map((img) => (
                <li key={img.id}>
                  {img.caption || "Photo"}
                  <button className="btn btn-secondary btn-sm" onClick={() => openAdminImageFile(detail.business.id, img.id)}>View</button>
                </li>
              ))}
            </div>

            {detail.transitions.length > 0 && (
              <>
                <h2 style={{ fontSize: "0.95rem", marginBottom: 10 }}>History</h2>
                <div className="doc-checklist" style={{ marginBottom: 16 }}>
                  {detail.transitions.map((t) => (
                    <li key={t.id}>
                      {t.fromState} → {t.toState}{t.reason ? ` — ${t.reason}` : ""} <span className="muted">{t.createdAt}</span>
                    </li>
                  ))}
                </div>
              </>
            )}

            {!action && (ACTIONS_BY_STATUS[detail.business.verificationStatus] || []).map((a) => (
              <button
                key={a.toState}
                className={`btn ${a.className} btn-sm`}
                style={{ marginRight: 8 }}
                onClick={() => { setAction(a); setReason(""); setError(""); }}
              >
                {a.label}
              </button>
            ))}
            {!action && !(ACTIONS_BY_STATUS[detail.business.verificationStatus] || []).length && (
              <p className="muted">No action available for this status — the applicant needs to act next.</p>
            )}

            {action && (
              <form onSubmit={handleTransition} style={{ marginTop: 10 }}>
                <div className="form-field">
                  <label>Reason for {action.gerund} this application</label>
                  <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the decision" />
                </div>
                {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
                <button className={`btn ${action.className}`} type="submit" disabled={busy}>
                  {busy ? "Saving..." : `Confirm ${action.label.toLowerCase()}`}
                </button>{" "}
                <button className="btn btn-secondary" type="button" onClick={() => setAction(null)}>Cancel</button>
              </form>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
