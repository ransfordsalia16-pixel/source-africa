import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import Modal from "../../components/Modal.jsx";
import { getBuyerRequests, createBuyerRequest } from "../../services/api/buyers.js";
import { useToast } from "../../context/ToastContext.jsx";

const EMPTY_FORM = { product: "", quantity: "", budget: "", destination: "", requiredBy: "", specs: "" };

export default function BuyerRequests() {
  const [requests, setRequests] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToast();

  function load() {
    getBuyerRequests().then(setRequests);
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createBuyerRequest({
        product: form.product || "Untitled request",
        quantity: form.quantity || "Not specified",
        budget: form.budget || "Not specified",
        destination: form.destination || "Not specified",
        requiredBy: form.requiredBy || "Not specified",
      });
      showToast("Your request is on its way to verified suppliers.");
      setCreating(false);
      setForm(EMPTY_FORM);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My requests"
        subtitle="Every sourcing request you have submitted, and what has happened since."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}>Start a new sourcing request</button>}
      />

      <Panel>
        <DataTable
          columns={[
            { label: "Request", render: (r) => (<><strong>{r.product}</strong><br /><span className="muted">{r.id} · submitted {r.createdAt}</span></>) },
            { label: "Quantity", key: "quantity" },
            { label: "Budget", key: "budget" },
            { label: "Needed by", key: "requiredBy" },
            { label: "Quotes", render: (r) => r.quotesCount },
            { label: "Status", render: (r) => <StatusPill status={r.status} /> },
            { label: "", render: (r) => <button className="btn btn-secondary btn-sm" onClick={() => setViewing(r)}>View</button> },
          ]}
          rows={requests}
        />
      </Panel>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.product} footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}>
        {viewing && (
          <div className="doc-checklist">
            <li>Quantity <strong>{viewing.quantity}</strong></li>
            <li>Budget <strong>{viewing.budget}</strong></li>
            <li>Delivery to <strong>{viewing.destination}</strong></li>
            <li>Needed by <strong>{viewing.requiredBy}</strong></li>
            <li>Quotes received <strong>{viewing.quotesCount}</strong></li>
            <li>Status <StatusPill status={viewing.status} /></li>
          </div>
        )}
      </Modal>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Tell us what you need"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Sending..." : "Send to suppliers"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>What are you looking for</label>
            <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="For example, restaurant chairs" />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>How many</label>
              <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="500 units" />
            </div>
            <div className="form-field">
              <label>Your budget</label>
              <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="$9,000 to $11,000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Where it is going</label>
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Accra, Ghana" />
            </div>
            <div className="form-field">
              <label>When you need it</label>
              <input type="date" value={form.requiredBy} onChange={(e) => setForm({ ...form, requiredBy: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label>Anything else suppliers should know</label>
            <textarea rows="3" value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} placeholder="Size, material, colour, or anything specific" />
          </div>
        </form>
      </Modal>
    </>
  );
}
