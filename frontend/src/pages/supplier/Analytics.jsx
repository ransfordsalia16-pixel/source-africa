import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import { StatGrid } from "../../components/StatCard.jsx";
import { listMyProducts } from "../../services/api/products.js";

export default function SupplierAnalytics() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    listMyProducts().then(setProducts);
  }, []);

  const totalViews = products.reduce((s, p) => s + p.views, 0);
  const totalInquiries = products.reduce((s, p) => s + p.inquiries, 0);
  const max = Math.max(1, ...products.map((p) => p.views));

  return (
    <>
      <PageHeader title="Analytics" subtitle="How buyers are discovering and engaging with what you sell." />
      <StatGrid
        cards={[
          { label: "Total views", value: totalViews.toLocaleString() },
          { label: "Total inquiries", value: totalInquiries },
          { label: "Inquiry to order rate", value: "3.1%", tone: "ok" },
          { label: "Average response time", value: "2.4 hours", sublabel: "Faster than most suppliers", tone: "ok" },
        ]}
      />
      <Panel title="Product views over the last 30 days">
        <div className="mini-bar-chart">
          {products.map((p) => (
            <div key={p.id} className="bar" style={{ height: `${Math.max(10, (p.views / max) * 100)}%` }}>
              <span>{p.name.split(" ").slice(0, 2).join(" ")}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
