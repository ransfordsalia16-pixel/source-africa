import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import Modal from "../../components/Modal.jsx";
import SegmentedTabs from "../../components/SegmentedTabs.jsx";
import {
  adminGetCases,
  adminGetCase,
  adminAssignCase,
  adminAddCaseNote,
  adminEscalateCase,
  adminCloseCase,
} from "../../services/api/cases.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

const TABS = [
  { key: "mine", label: "Assigned to me" },
  { key: "all", label: "All cases" },
];

export default function AdminCases() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("mine");
  const [cases, setCases] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function load() {
    adminGetCases({ mine: tab === "mine" }).then(setCases);
  }

  useEffect(load, [tab]);

  function openCase(c) {
    setViewing(c);
    setNote("");
    setError("");
    adminGetCase(c.id).then(setDetail);
  }

  function refreshDetail() {
    adminGetCase(viewing.id).then(setDetail);
    load();
  }

  async function handleAssign() {
    setBusy(true);
    try {
      await adminAssignCase(viewing.id);
      showToast(`${profile.name} is now handling ${viewing.id}.`);
      refreshDetail();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!note.trim()) {
      setError("A note is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminAddCaseNote(viewing.id, note.trim());
      setNote("");
      refreshDetail();
    } catch (err) {
      setError(err.message || "Could not add that note.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEscalate() {
    if (!note.trim()) {
      setError("Add a note explaining the escalation first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminEscalateCase(viewing.id, note.trim());
      showToast(`${viewing.id} escalated and returned to the unassigned queue.`);
      setNote("");
      refreshDetail();
    } catch (err) {
      setError(err.message || "Could not escalate this case.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!note.trim()) {
      setError("Add a closing note first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminCloseCase(viewing.id, note.trim());
      showToast(`${viewing.id} closed.`);
      setNote("");
      refreshDetail();
    } catch (err) {
      setError(err.message || "Could not close this case.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Support cases" subtitle="Disputes and support requests, tracked from open to close with a full staff notes timeline." />
      <Panel>
        <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 14 }}>
          <DataTable
            columns={[
              { label: "Case", render: (c) => (<><strong>{c.subject}</strong><br /><span className="muted">{c.id} · {c.type === "dispute" ? "Dispute" : "Support request"}</span></>) },
              { label: "Order", render: (c) => c.orderId || <span className="muted">—</span> },
              { label: "Status", render: (c) => <StatusPill status={c.status} /> },
              { label: "Assignee", render: (c) => c.assignedToUserId ? (c.assignedToUserId === profile.id ? "You" : "Assigned") : "Unassigned" },
              { label: "", render: (c) => <button className="btn btn-secondary btn-sm" onClick={() => openCase(c)}>Open</button> },
            ]}
            rows={cases}
          />
          {cases.length === 0 && <div className="empty-state">Nothing here right now.</div>}
        </div>
      </Panel>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.subject}
        footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}
      >
        {detail && (
          <>
            <p className="muted" style={{ marginBottom: 4 }}>
              {detail.case.id} · {detail.case.type === "dispute" ? "Dispute" : "Support request"}
              {detail.case.orderId ? ` · ${detail.case.orderId}` : ""}
            </p>
            <p style={{ marginBottom: 14 }}>{detail.case.description || "No further details provided."}</p>

            <h2 style={{ fontSize: "0.95rem", marginBottom: 10 }}>Staff notes</h2>
            <div className="doc-checklist" style={{ marginBottom: 16 }}>
              {detail.notes.length === 0 && <p className="muted">No notes yet.</p>}
              {detail.notes.map((n) => (
                <li key={n.id}>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>{n.createdAt}</span>
                  {n.note}
                </li>
              ))}
            </div>

            {detail.case.status === "closed" ? (
              <p className="muted">This case is closed.</p>
            ) : (
              <>
                {!detail.case.assignedToUserId && (
                  <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={handleAssign} disabled={busy}>
                    Assign to me
                  </button>
                )}
                <div className="form-field">
                  <label>Add a note</label>
                  <textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you find or do?" />
                </div>
                {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={busy}>Add note</button>
                  <button className="btn btn-secondary btn-sm" onClick={handleEscalate} disabled={busy}>Escalate</button>
                  <button className="btn btn-danger btn-sm" onClick={handleClose} disabled={busy}>Close case</button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
