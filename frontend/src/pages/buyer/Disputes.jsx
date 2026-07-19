import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { getMyDisputes, getDispute, uploadEvidence, openEvidenceFile } from "../../services/api/disputes.js";
import { useToast } from "../../context/ToastContext.jsx";

const EVIDENCE_TYPES = [
  { value: "product_photo", label: "Product photo" },
  { value: "product_video", label: "Product video" },
  { value: "invoice", label: "Invoice" },
  { value: "shipping_document", label: "Shipping document" },
  { value: "delivery_confirmation", label: "Delivery confirmation" },
  { value: "inspection_report", label: "Inspection report" },
  { value: "other", label: "Other" },
];

export default function BuyerDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [evidenceType, setEvidenceType] = useState("product_photo");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  function loadList() {
    getMyDisputes().then(setDisputes);
  }

  useEffect(loadList, []);

  useEffect(() => {
    if (!activeId) return setDetail(null);
    getDispute(activeId).then(setDetail);
  }, [activeId]);

  async function handleUpload(e) {
    e.preventDefault();
    const file = e.target.elements.file.files[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await uploadEvidence(activeId, file, { type: evidenceType, description: evidenceDescription });
      showToast("Evidence uploaded.");
      setEvidenceDescription("");
      e.target.reset();
      getDispute(activeId).then(setDetail);
    } catch (err) {
      setError(err.message || "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHeader title="Disputes" subtitle="Track any reports you have filed and add evidence for SourceBridge to review." />
      <div className="panel-grid-2">
        <Panel title="Your disputes">
          {disputes.length === 0 && <div className="empty-state">No disputes filed. You can report a problem from an order's tracking view.</div>}
          {disputes.map((d) => (
            <div key={d.id} className="list-item-row" style={{ cursor: "pointer" }} onClick={() => setActiveId(d.id)}>
              <div>
                <strong>{d.reason}</strong>
                <br />
                <span className="muted">{d.id} · {d.orderId}</span>
              </div>
              <StatusPill status={d.status === "resolved" ? "resolved" : "investigating"} />
            </div>
          ))}
        </Panel>
        <Panel title={detail ? detail.dispute.reason : "Select a dispute"}>
          {detail && (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                {detail.dispute.description || "No further details provided."}
              </p>
              {detail.dispute.resolution && (
                <p style={{ marginBottom: 12 }}>
                  <strong>Resolution:</strong> {detail.dispute.resolution}
                </p>
              )}
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
              {detail.dispute.status !== "resolved" && (
                <form onSubmit={handleUpload}>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Evidence type</label>
                      <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                        {EVIDENCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>File (JPG, PNG, WEBP, or PDF, up to 10MB)</label>
                      <input type="file" name="file" accept=".jpg,.jpeg,.png,.webp,.pdf" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Description</label>
                    <input value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} placeholder="What does this show" />
                  </div>
                  {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
                  <button className="btn btn-primary btn-sm" type="submit" disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload evidence"}
                  </button>
                </form>
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
