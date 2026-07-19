import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { StatGrid } from "../../components/StatCard.jsx";
import { getMyApplication } from "../../services/api/businessApplications.js";
import { listMyProducts } from "../../services/api/products.js";
import { getOrdersBySupplier } from "../../services/api/orders.js";
import { getOpenRequests } from "../../services/api/sourcingRequests.js";
import { currency, trustLabel } from "../../utils/format.js";
import { DOCUMENT_TYPE_LABELS } from "../../constants/businessDocuments.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function SupplierOverview() {
  const { profile } = useAuth();
  const [me, setMe] = useState(undefined); // undefined = loading, null = no business yet
  const [documents, setDocuments] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [incoming, setIncoming] = useState([]);

  useEffect(() => {
    getMyApplication().then((app) => {
      const business = app?.business ?? null;
      setMe(business);
      setDocuments(app?.documents ?? []);
      if (business) {
        listMyProducts().then(setProducts);
        getOrdersBySupplier(business.id).then(setOrders);
      }
    });
    getOpenRequests().then((rows) => setIncoming(rows.filter((r) => !r.myQuote)));
  }, []);

  if (me === undefined) return null;

  if (!me) {
    return (
      <>
        <PageHeader title={`Welcome back, ${profile?.name?.split(" ")[0] || "there"}`} />
        <Panel title="No company profile found">
          <p className="muted">
            Your account doesn't have a linked business record yet. Contact support if this looks wrong.
          </p>
        </Panel>
      </>
    );
  }

  const totalViews = products.reduce((s, p) => s + p.views, 0);
  const totalInquiries = products.reduce((s, p) => s + p.inquiries, 0);
  const revenue = orders.reduce((s, o) => s + o.value, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.name?.split(" ")[0] || "there"}`}
        subtitle={`${me.name} · ${me.location || "Location not set"}`}
        actions={<StatusPill status={me.verificationStatus} />}
      />

      <StatGrid
        cards={[
          { label: "Product views", value: totalViews.toLocaleString(), sublabel: "All time" },
          { label: "Buyer inquiries", value: totalInquiries, sublabel: "All time" },
          { label: "Active orders", value: orders.filter((o) => o.stage !== "delivered").length, sublabel: "In fulfillment", tone: "ok" },
          { label: "Order value this year", value: currency(revenue), sublabel: "Across all orders" },
        ]}
      />

      <div className="panel-grid-2">
        <Panel title="Buyers looking for what you make">
          <DataTable
            empty="No new buyer requests right now."
            columns={[
              { label: "Request", render: (r) => (<><strong>{r.product}</strong><br /><span className="muted">{r.quantity || "Quantity not specified"}</span></>) },
              { label: "Budget", render: (r) => r.budget || "Not specified" },
              { label: "", render: () => <Link to="/supplier/requests" className="btn btn-primary btn-sm">Send a quote</Link> },
            ]}
            rows={incoming.slice(0, 4)}
          />
        </Panel>
        <Panel title="Your trust score">
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <strong style={{ fontSize: "2.4rem", color: "var(--forest)" }}>{me.trustScore}</strong>
            <span className="muted">/100</span>
            <div style={{ marginTop: 6 }}>{trustLabel(me.trustLevel)}</div>
          </div>
          <div className="doc-checklist">
            {Object.entries(DOCUMENT_TYPE_LABELS).filter(([type]) => type !== "other").map(([type, label]) => {
              const uploaded = documents.some((d) => d.type === type);
              return (
                <li key={type}>
                  {label} <span className={`pill ${uploaded ? "pill-ok" : "pill-danger"}`}>{uploaded ? "On file" : "Not uploaded"}</span>
                </li>
              );
            })}
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
