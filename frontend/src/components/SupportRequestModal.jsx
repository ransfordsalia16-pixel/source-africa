import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import StatusPill from "./StatusPill.jsx";
import { submitSupportRequest, getMySupportRequests } from "../services/api/cases.js";
import { getOrders } from "../services/api/orders.js";
import { useToast } from "../context/ToastContext.jsx";

// Reachable from the Sidebar footer on both the buyer and supplier dashboards. Case notes
// (the internal staff timeline) never appear here — only the requester's own subject/description
// and the case's current status, which is all the backend ever returns to a non-admin caller.
export default function SupportRequestModal({ open, onClose }) {
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function loadRequests() {
    getMySupportRequests().then(setRequests);
  }

  useEffect(() => {
    if (!open) return;
    loadRequests();
    getOrders().then(setOrders);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSubject("");
      setDescription("");
      setOrderId("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim()) {
      setError("A subject is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitSupportRequest({ subject: subject.trim(), description: description.trim(), orderId: orderId || undefined });
      showToast("Your request has been sent to SourceBridge support.");
      setSubject("");
      setDescription("");
      setOrderId("");
      loadRequests();
    } catch (err) {
      setError(err.message || "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Contact support">
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div className="form-field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?" />
        </div>
        <div className="form-field">
          <label>Details</label>
          <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add any context that will help support look into this" />
        </div>
        {orders.length > 0 && (
          <div className="form-field">
            <label>Related order (optional)</label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Not related to a specific order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.id} · {o.product}</option>
              ))}
            </select>
          </div>
        )}
        {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
        <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send request"}
        </button>
      </form>

      <h2 style={{ fontSize: "0.95rem", marginBottom: 10 }}>Your past requests</h2>
      {requests.length === 0 && <div className="empty-state">No support requests yet.</div>}
      {requests.map((r) => (
        <div key={r.id} className="list-item-row">
          <div>
            <strong>{r.subject}</strong>
            <br />
            <span className="muted">{r.id}{r.orderId ? ` · ${r.orderId}` : ""}</span>
          </div>
          <StatusPill status={r.status} />
        </div>
      ))}
    </Modal>
  );
}
