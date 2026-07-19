import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import StatusPill from "./StatusPill.jsx";
import ProgressSteps from "./ProgressSteps.jsx";
import { orderStages, orderStageLabels, getShipmentForOrder } from "../services/api/orders.js";
import { openDispute } from "../services/api/disputes.js";
import { currency } from "../utils/format.js";
import { useToast } from "../context/ToastContext.jsx";

const DISPUTE_REASONS = [
  "Product not received",
  "Product does not match the order",
  "Wrong quantity",
  "Damaged goods",
  "Materially different product",
  "Supplier failed to meet agreed specifications",
  "Suspected fraud",
  "Other",
];

// Shared between the buyer, supplier, and admin views. Everyone is looking at
// the same order record, they just see different actions in the footer.
export default function OrderDetailModal({ order, open, onClose, footer, onDisputeOpened }) {
  const [shipment, setShipment] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  useEffect(() => {
    if (open && order) {
      getShipmentForOrder(order.id).then(setShipment);
    }
    if (!open) {
      setReporting(false);
      setReason(DISPUTE_REASONS[0]);
      setDescription("");
      setError("");
    }
  }, [open, order]);

  if (!order) return null;

  async function handleSubmitDispute(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await openDispute(order.id, { reason, description });
      showToast("Your report has been filed. SourceBridge will review the evidence with both sides.");
      setReporting(false);
      onDisputeOpened?.();
      onClose();
    } catch (err) {
      setError(err.message || "Could not open a dispute on this order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order.product}
      footer={
        reporting ? null : (
          <>
            {footer}
            <button className="btn btn-danger" onClick={() => setReporting(true)}>Report a problem</button>
          </>
        )
      }
    >
      {reporting ? (
        <form onSubmit={handleSubmitDispute}>
          <p className="muted" style={{ marginBottom: 14 }}>
            Opening a dispute pauses this order and brings in SourceBridge to review the evidence from both sides.
          </p>
          <div className="form-field">
            <label>What went wrong</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {DISPUTE_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Details</label>
            <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what happened" />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 12 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setReporting(false)}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>
            {order.id}
            {order.buyerName ? ` · Buyer: ${order.buyerName}` : ""}
          </p>
          <ProgressSteps stages={orderStages} labels={orderStageLabels} current={order.stage} />
          <div className="doc-checklist" style={{ marginTop: 18 }}>
            <li>
              Order value <strong>{currency(order.value, order.currency)}</strong>
            </li>
            <li>
              Payment status <StatusPill status={order.paymentStatus} />
            </li>
            <li>
              Estimated arrival <strong>{order.eta}</strong>
            </li>
            {shipment && (
              <>
                <li>
                  Carrier <strong>{shipment.carrier}</strong>
                </li>
                <li>
                  Route <strong>{shipment.origin} to {shipment.destination}</strong>
                </li>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
