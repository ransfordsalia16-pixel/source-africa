import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { StatGrid } from "../../components/StatCard.jsx";
import { getMySupplier, getProductsBySupplier } from "../../services/api/suppliers.js";
import { getOrdersBySupplier } from "../../services/api/orders.js";
import { getBuyerRequests } from "../../services/api/buyers.js";
import { currency, trustLabel } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function SupplierOverview() {
  const { profile } = useAuth();
  const [me, setMe] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [incoming, setIncoming] = useState([]);

  useEffect(() => {
    getMySupplier().then((supplier) => {
      setMe(supplier);
      getProductsBySupplier(supplier.id).then(setProducts);
      getOrdersBySupplier(supplier.id).then(setOrders);
    });
    getBuyerRequests().then((rows) => setIncoming(rows.filter((r) => r.status === "searching" || r.status === "quotes_received")));
  }, []);

  if (!me) return null;

  const totalViews = products.reduce((s, p) => s + p.views, 0);
  const totalInquiries = products.reduce((s, p) => s + p.inquiries, 0);
  const revenue = orders.reduce((s, o) => s + o.value, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.name?.split(" ")[0] || "there"}`}
        subtitle={`${me.name} · ${me.location}`}
        actions={<span className="pill pill-warn">{trustLabel(me.trustLevel)}</span>}
      />

      <StatGrid
        cards={[
          { label: "Product views", value: totalViews.toLocaleString(), sublabel: "Last 30 days" },
          { label: "Buyer inquiries", value: totalInquiries, sublabel: "Last 30 days" },
          { label: "Active orders", value: orders.filter((o) => o.stage !== "delivered").length, sublabel: "In fulfillment", tone: "ok" },
          { label: "Revenue this year", value: currency(revenue), sublabel: "Protected payments" },
        ]}
      />

      <div className="panel-grid-2">
        <Panel title="Buyers looking for what you make">
          <DataTable
            empty="No new buyer requests right now."
            columns={[
              { label: "Request", render: (r) => (<><strong>{r.product}</strong><br /><span className="muted">{r.quantity}</span></>) },
              { label: "Budget", key: "budget" },
              { label: "", render: () => <Link to="/supplier/requests" className="btn btn-primary btn-sm">Send a quote</Link> },
            ]}
            rows={incoming}
          />
        </Panel>
        <Panel title="Your trust score">
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <strong style={{ fontSize: "2.4rem", color: "var(--forest)" }}>{me.trustScore}</strong>
            <span className="muted">/100</span>
          </div>
          <div className="doc-checklist">
            {me.verified.map((v) => (
              <li key={v}>
                {v} <span className="pill pill-ok">Verified</span>
              </li>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Your orders">
        <DataTable
          columns={[
            { label: "Order", render: (o) => (<><strong>{o.product}</strong><br /><span className="muted">{o.id} · {o.buyer}</span></>) },
            { label: "Value", render: (o) => currency(o.value, o.currency) },
            { label: "Stage", render: (o) => <StatusPill status={o.stage} /> },
            { label: "Payment", render: (o) => <StatusPill status={o.paymentStatus} /> },
          ]}
          rows={orders}
        />
      </Panel>
    </>
  );
}
