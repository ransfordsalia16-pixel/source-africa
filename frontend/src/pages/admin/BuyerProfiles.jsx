import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import Modal from "../../components/Modal.jsx";
import { listAdminProfiles, getAdminProfile, transitionAdminProfile } from "../../services/api/buyerProfile.js";
import { useToast } from "../../context/ToastContext.jsx";

const FILTERS = [
  { value: "BUYER_VERIFICATION_PENDING", label: "Pending review" },
  { value: "", label: "All profiles" },
  { value: "BUYER_VERIFIED", label: "Verified" },
  { value: "BUYER_REJECTED", label: "Rejected" },
];

export default function AdminBuyerProfiles() {
  const [filter, setFilter] = useState(FILTERS[0].value);
  const [profiles, setProfiles] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState(null); // "BUYER_VERIFIED" | "BUYER_REJECTED"
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function load() {
    listAdminProfiles(filter || undefined).then(setProfiles);
  }

  useEffect(load, [filter]);

  function openProfile(p) {
    setViewing(p);
    setAction(null);
    setReason("");
    setError("");
    getAdminProfile(p.id).then(setDetail);
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
      await transitionAdminProfile(viewing.id, action, reason.trim());
      showToast(`${detail.companyName} is now ${action === "BUYER_VERIFIED" ? "verified" : "rejected"}.`);
      setViewing(null);
      load();
    } catch (err) {
      setError(err.message || "Could not update this profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Buyer profiles"
        subtitle="Real buyer accounts submitting company info for verification — separate from the legacy demo queue under Buyer verification."
        actions={
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        }
      />
      <Panel>
        <DataTable
          empty="No buyer profiles match this filter."
          columns={[
            { label: "Company", render: (p) => (<><strong>{p.companyName}</strong><br /><span className="muted">{p.location}</span></>) },
            { label: "Type", key: "businessType" },
            { label: "Status", render: (p) => <StatusPill status={p.verificationStatus} /> },
            { label: "Submitted", render: (p) => p.createdAt },
            { label: "", render: (p) => <button className="btn btn-secondary btn-sm" onClick={() => openProfile(p)}>Review</button> },
          ]}
          rows={profiles}
        />
      </Panel>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={detail?.companyName}
        footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}
      >
        {detail && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <p className="muted">{detail.location} · {detail.businessType}</p>
              <StatusPill status={detail.verificationStatus} />
            </div>
            {detail.reviewNotes && <p style={{ marginBottom: 14 }}><strong>Last review note:</strong> {detail.reviewNotes}</p>}

            {!action && detail.verificationStatus === "BUYER_VERIFICATION_PENDING" && (
              <>
                <button className="btn btn-primary btn-sm" style={{ marginRight: 8 }} onClick={() => { setAction("BUYER_VERIFIED"); setReason(""); setError(""); }}>Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => { setAction("BUYER_REJECTED"); setReason(""); setError(""); }}>Reject</button>
              </>
            )}
            {!action && detail.verificationStatus !== "BUYER_VERIFICATION_PENDING" && (
              <p className="muted">No action available for this status.</p>
            )}

            {action && (
              <form onSubmit={handleTransition} style={{ marginTop: 10 }}>
                <div className="form-field">
                  <label>Reason for {action === "BUYER_VERIFIED" ? "approving" : "rejecting"} this profile</label>
                  <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the decision" />
                </div>
                {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
                <button className={`btn ${action === "BUYER_VERIFIED" ? "btn-primary" : "btn-danger"}`} type="submit" disabled={busy}>
                  {busy ? "Saving..." : `Confirm ${action === "BUYER_VERIFIED" ? "approve" : "reject"}`}
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
