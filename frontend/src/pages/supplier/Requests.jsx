import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import { getOpenRequests, submitQuote as submitQuoteApi } from "../../services/api/sourcingRequests.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function SupplierRequests() {
  const [requests, setRequests] = useState([]);
  const [quoting, setQuoting] = useState(null);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const showToast = useToast();

  function load() {
    getOpenRequests().then(setRequests);
  }

  useEffect(load, []);

  async function submitQuote(e) {
    e.preventDefault();
    setSending(true);
    try {
      await submitQuoteApi(quoting.id, { priceLabel: price, note: note || undefined });
      showToast("Your quote has been sent to the buyer.");
      setQuoting(null);
      setPrice("");
      setNote("");
      load();
    } catch (err) {
      showToast(err.message || "Could not send that quote.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title="Buyer requests" subtitle="Sourcing requests from buyers who might be a good fit for what you make." />
      <Panel>
        <DataTable
          empty="No open buyer requests right now."
          columns={[
            { label: "Request", render: (r) => (<><strong>{r.product}</strong><br /><span className="muted">{r.id}</span></>) },
            { label: "Quantity", render: (r) => r.quantity || "Not specified" },
            { label: "Budget", render: (r) => r.budget || "Not specified" },
            { label: "Delivery to", render: (r) => r.destination || "Not specified" },
            { label: "Needed by", render: (r) => r.requiredBy || "Not specified" },
            {
              label: "",
              render: (r) =>
                r.myQuote ? (
                  <span className="pill pill-ok">Quoted: {r.myQuote.priceLabel}</span>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => setQuoting(r)}>Send a quote</button>
                ),
            },
          ]}
          rows={requests}
        />
      </Panel>

      <Modal
        open={!!quoting}
        onClose={() => setQuoting(null)}
        title={`Quote for ${quoting?.product || ""}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setQuoting(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={sending} onClick={submitQuote}>{sending ? "Sending..." : "Send quote"}</button>
          </>
        }
      >
        <form onSubmit={submitQuote}>
          <div className="form-field">
            <label>Your price</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="For example, $19.50 per unit, or $10,200 total" />
          </div>
          <div className="form-field">
            <label>A note for the buyer</label>
            <textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Introduce your factory and your terms" />
          </div>
        </form>
      </Modal>
    </>
  );
}
