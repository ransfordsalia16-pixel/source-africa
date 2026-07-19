import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import { getBuyerRequests } from "../../services/api/buyers.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function SupplierRequests() {
  const [requests, setRequests] = useState([]);
  const [quoting, setQuoting] = useState(null);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const showToast = useToast();

  useEffect(() => {
    getBuyerRequests().then(setRequests);
  }, []);

  function submitQuote(e) {
    e.preventDefault();
    setQuoting(null);
    setPrice("");
    setNote("");
    showToast("Your quote has been sent to the buyer.");
  }

  return (
    <>
      <PageHeader title="Buyer requests" subtitle="Sourcing requests from buyers who might be a good fit for what you make." />
      <Panel>
        <DataTable
          columns={[
            { label: "Request", render: (r) => (<><strong>{r.product}</strong><br /><span className="muted">{r.id}</span></>) },
            { label: "Quantity", key: "quantity" },
            { label: "Budget", key: "budget" },
            { label: "Delivery to", key: "destination" },
            { label: "Needed by", key: "requiredBy" },
            { label: "", render: (r) => <button className="btn btn-primary btn-sm" onClick={() => setQuoting(r)}>Send a quote</button> },
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
            <button className="btn btn-primary" onClick={submitQuote}>Send quote</button>
          </>
        }
      >
        <form onSubmit={submitQuote}>
          <div className="form-field">
            <label>Your unit price</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="For example, $19.50" />
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
