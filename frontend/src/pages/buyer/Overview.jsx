import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { StatGrid } from "../../components/StatCard.jsx";
import OrderDetailModal from "../../components/OrderDetailModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getBuyerRequests } from "../../services/api/buyers.js";
import { getOrders } from "../../services/api/orders.js";
import { currency } from "../../utils/format.js";

export default function BuyerOverview() {
  const { profile, session } = useAuth();
  const wantsToSell = session?.onboardingIntent === "sell" || session?.onboardingIntent === "both";
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    getBuyerRequests().then(setRequests);
    getOrders().then(setOrders);
  }, []);

  const activeRequests = requests.filter((r) => r.status !== "order_confirmed").length;
  const activeOrders = orders.filter((o) => o.stage !== "delivered").length;
  const paymentsConfirmed = orders.filter((o) => o.paymentStatus === "secured").length;
  const totalSpend = orders.reduce((sum, o) => sum + o.value, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.name?.split(" ")[0] || "there"}`}
        subtitle={`${profile?.company || ""} · ${profile?.location || ""}`}
        actions={<Link to="/buyer/requests" className="btn btn-primary">Start a new sourcing request</Link>}
      />

      {wantsToSell && (
        <div className="callout-banner">
          <span>🏭 Interested in selling on SourceBridge? Supplier applications are coming soon — we'll let you know when they open.</span>
        </div>
      )}

      <StatGrid
        cards={[
          { label: "Active requests", value: activeRequests, sublabel: "Still in progress" },
          { label: "Active orders", value: activeOrders, sublabel: "Being fulfilled" },
          { label: "Payments confirmed", value: paymentsConfirmed, sublabel: "Not yet released to supplier", tone: "ok" },
          { label: "Total spend this year", value: currency(totalSpend), sublabel: "Across every order" },
        ]}
      />

      <div className="panel-grid-2">
        <Panel title="Your most recent requests">
          <DataTable
            columns={[
              { label: "Request", render: (r) => (<><strong>{r.product}</strong><br /><span className="muted">{r.id}</span></>) },
              { label: "Quantity", key: "quantity" },
              { label: "Status", render: (r) => <StatusPill status={r.status} /> },
            ]}
            rows={requests.slice(0, 4)}
          />
        </Panel>
        <Panel title="Every order is protected">
          <p className="muted" style={{ marginBottom: 14 }}>
            When you order through SourceBridge, the supplier isn't paid out until you personally approve the inspected goods (or a dispute is resolved in your favor).
          </p>
          <div className="doc-checklist">
            <li>Verified supplier <span className="pill pill-ok">Confirmed</span></li>
            <li>Secure payment <span className="pill pill-ok">Confirmed</span></li>
            <li>Quality inspection <span className="pill pill-ok">Included</span></li>
            <li>Shipment tracking <span className="pill pill-ok">Live</span></li>
            <li>Support if something goes wrong <span className="pill pill-ok">Available</span></li>
          </div>
        </Panel>
      </div>

      <Panel title="Your most recent orders">
        <DataTable
          columns={[
            { label: "Order", render: (o) => (<><strong>{o.product}</strong><br /><span className="muted">{o.id}</span></>) },
            { label: "Value", render: (o) => currency(o.value, o.currency) },
            { label: "Stage", render: (o) => <StatusPill status={o.stage} /> },
            { label: "Payment", render: (o) => <StatusPill status={o.paymentStatus} /> },
            { label: "", render: (o) => <button className="btn btn-secondary btn-sm" onClick={() => setActiveOrder(o)}>Track</button> },
          ]}
          rows={orders.slice(0, 4)}
        />
      </Panel>

      <OrderDetailModal order={activeOrder} open={!!activeOrder} onClose={() => setActiveOrder(null)} />
    </>
  );
}
