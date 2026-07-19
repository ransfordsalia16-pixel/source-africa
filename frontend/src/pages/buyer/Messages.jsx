import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import { getOrders } from "../../services/api/orders.js";
import { getThreadIds, getThread, sendMessage, hideThread } from "../../services/api/messages.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function BuyerMessages() {
  const [threadIds, setThreadIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState([]);
  const [orders, setOrders] = useState([]);
  const [draft, setDraft] = useState("");
  const showToast = useToast();

  function loadThreadIds() {
    return getThreadIds().then((ids) => {
      setThreadIds(ids);
      setActiveId((current) => (current && ids.includes(current) ? current : ids[0] || null));
      return ids;
    });
  }

  useEffect(() => {
    loadThreadIds();
    getOrders().then(setOrders);
  }, []);

  useEffect(() => {
    if (!activeId) {
      setThread([]);
      return;
    }
    getThread(activeId).then(setThread);
  }, [activeId]);

  const activeOrder = orders.find((o) => o.id === activeId);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    await sendMessage(activeId, draft.trim());
    setDraft("");
    getThread(activeId).then(setThread);
  }

  async function handleHide(e, orderId) {
    e.stopPropagation();
    await hideThread(orderId);
    showToast("Conversation hidden from your inbox. It isn't deleted, and the supplier can still see it.");
    loadThreadIds();
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Chat with suppliers about orders that are already underway." />
      <div className="panel-grid-2">
        <Panel title="Conversations">
          {threadIds.length === 0 && <div className="empty-state">No conversations to show.</div>}
          {threadIds.map((id) => {
            const order = orders.find((o) => o.id === id);
            if (!order) return null;
            return (
              <div key={id} className="list-item-row" style={{ cursor: "pointer" }} onClick={() => setActiveId(id)}>
                <div>
                  <strong>{order.supplierName}</strong>
                  <br />
                  <span className="muted">{order.product}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {id === activeId && <span className="pill pill-info">Open</span>}
                  <button className="btn btn-secondary btn-sm" onClick={(e) => handleHide(e, id)}>Hide</button>
                </div>
              </div>
            );
          })}
        </Panel>
        <Panel title={activeOrder ? activeOrder.supplierName : "Pick a conversation"}>
          <div className="chat-list">
            {thread.map((m, i) => (
              <div key={m.id || i} className={`chat-bubble ${m.from}`}>
                {m.text}
                <span className="chat-time">{m.time}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              style={{ flex: 1, background: "var(--sand)", border: "1px solid var(--line)", borderRadius: 9, padding: "10px 12px" }}
              placeholder="Type a message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!activeId}
            />
            <button className="btn btn-primary" type="submit" disabled={!activeId}>Send</button>
          </form>
        </Panel>
      </div>
    </>
  );
}
