import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import { adminListConversations, adminViewConversation } from "../../services/api/messages.js";
import { adminGetCases } from "../../services/api/cases.js";

export default function AdminConversations() {
  const [conversations, setConversations] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [myCasesForOrder, setMyCasesForOrder] = useState(null);
  const [caseId, setCaseId] = useState("");
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminListConversations().then(setConversations);
  }, []);

  function openConversation(conversation) {
    setViewing(conversation);
    setCaseId("");
    setMessages(null);
    setError("");
    setMyCasesForOrder(null);
    adminGetCases({ mine: true }).then((cases) => {
      setMyCasesForOrder(cases.filter((c) => c.orderId === conversation.orderId));
    });
  }

  function closeModal() {
    setViewing(null);
  }

  async function handleViewMessages(e) {
    e.preventDefault();
    if (!caseId) {
      setError("Pick a case first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await adminViewConversation(viewing.conversationId, caseId);
      setMessages(result.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Conversations"
        subtitle="Every buyer-supplier conversation, available to staff only through a support case assigned to them for that order."
      />
      <Panel>
        <p className="muted" style={{ marginBottom: 14 }}>
          Opening a conversation here is not free browsing. You need a case assigned to you for that order, and every
          read is permanently recorded in the audit log against that case.
        </p>
        <DataTable
          rowKey="conversationId"
          columns={[
            { label: "Order", render: (c) => (<><strong>{c.productSummary}</strong><br /><span className="muted">{c.orderId}</span></>) },
            { label: "Conversation started", key: "createdAt" },
            { label: "", render: (c) => <button className="btn btn-secondary btn-sm" onClick={() => openConversation(c)}>View</button> },
          ]}
          rows={conversations}
        />
      </Panel>

      <Modal
        open={!!viewing}
        onClose={closeModal}
        title={viewing ? `${viewing.productSummary} (${viewing.orderId})` : ""}
        footer={<button className="btn btn-secondary" onClick={closeModal}>Close</button>}
      >
        {!messages ? (
          <>
            {myCasesForOrder === null && <p className="muted">Checking your assigned cases for this order...</p>}
            {myCasesForOrder && myCasesForOrder.length === 0 && (
              <p className="muted">
                You don't have a case assigned to you for this order yet. Take one from the{" "}
                <Link to="/admin/cases">Cases</Link> page first, then come back here.
              </p>
            )}
            {myCasesForOrder && myCasesForOrder.length > 0 && (
              <form onSubmit={handleViewMessages}>
                <div className="form-field">
                  <label>Which of your cases is this for</label>
                  <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                    <option value="">Choose a case</option>
                    {myCasesForOrder.map((c) => (
                      <option key={c.id} value={c.id}>{c.id} · {c.subject}</option>
                    ))}
                  </select>
                </div>
                {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? "Checking..." : "View messages"}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Access recorded against case <strong>{caseId}</strong>.
            </p>
            <div className="chat-list">
              {messages.length === 0 && <div className="empty-state">No messages in this conversation yet.</div>}
              {messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.from}`}>
                  <span className="muted" style={{ display: "block", fontSize: "0.7rem", marginBottom: 2, textTransform: "uppercase" }}>{m.from}</span>
                  {m.text}
                  <span className="chat-time">{m.time}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
