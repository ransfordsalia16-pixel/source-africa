import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import Modal from "../../components/Modal.jsx";
import {
  adminGetDisputes,
  adminGetDispute,
  adminAssignDispute,
  adminResolveDispute,
  openEvidenceFile,
} from "../../services/api/disputes.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export default function AdminDisputes() {
  const { profile } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [outcome, setOutcome] = useState("supplier");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function load() {
    adminGetDisputes().then(setDisputes);
  }

  useEffect(load, []);

  function openDispute(d) {
    setViewing(d);
    setResolution("");
    setError("");
    adminGetDispute(d.id).then(setDetail);
  }

  async function handleAssign() {
    setBusy(true);
    try {
      await adminAssignDispute(viewing.id);
      showToast(`${profile.name} is now reviewing ${viewing.id}.`);
      adminGetDispute(viewing.id).then(setDetail);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(e) {
    e.preventDefault();
    if (!resolution.trim()) {
      setError("Resolution notes are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminResolveDispute(viewing.id, { outcome, resolution: resolution.trim() });
      showToast(outcome === "supplier" ? "Funds released to the supplier." : "Buyer refunded.");
      setViewing(null);
      load();
    } catch (err) {
      setError(err.message || "Could not resolve this dispute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Disputes" subtitle="Look into disagreements between buyers and suppliers, then release payment or refund based on the evidence." />
      <Panel>
        <DataTable
          columns={[
            { label: "Dispute", render: (d) => (<><strong>{d.reason}</strong><br /><span className="muted">{d.id} · {d.orderId}</span></>) },
            { label: "Status", render: (d) => <StatusPill status={d.status === "resolved" ? "resolved" : "investigating"} /> },
            { label: "Reviewer", render: (d) => d.assignedReviewerId ? "Assigned" : "Unassigned" },
            { label: "", render: (d) => <button className="btn btn-secondary btn-sm" onClick={() => openDispute(d)}>Review</button> },
          ]}
          rows={disputes}
        />
      </Panel>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.reason}
        footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}
      >
        {detail && (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              {detail.dispute.orderId} · Opened {detail.dispute.createdAt}
            </p>
            <p style={{ marginBottom: 14 }}>{detail.dispute.description || "No further details provided."}</p>

            <h2 style={{ fontSize: "0.95rem", marginBottom: 10 }}>Evidence</h2>
            {detail.evidence.length === 0 && <p className="muted" style={{ marginBottom: 14 }}>No evidence uploaded yet.</p>}
            <div className="doc-checklist" style={{ marginBottom: 16 }}>
              {detail.evidence.map((ev) => (
                <li key={ev.id}>
                  {ev.type.replace(/_/g, " ")} {ev.description ? `— ${ev.description}` : ""}
                  <button className="btn btn-secondary btn-sm" onClick={() => openEvidenceFile(detail.dispute.id, ev.id)}>View</button>
                </li>
              ))}
            </div>

            {detail.dispute.status === "resolved" ? (
              <p><strong>Resolution:</strong> {detail.dispute.resolution}</p>
            ) : (
              <>
                {!detail.dispute.assignedReviewerId && (
                  <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={handleAssign} disabled={busy}>
                    Take this case
                  </button>
                )}
                <form onSubmit={handleResolve}>
                  <div className="form-field">
                    <label>Outcome</label>
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                      <option value="supplier">Release payment to the supplier</option>
                      <option value="buyer">Refund the buyer</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Resolution notes</label>
                    <textarea rows="3" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Explain the decision based on the evidence" />
                  </div>
                  {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? "Resolving..." : "Resolve dispute"}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
