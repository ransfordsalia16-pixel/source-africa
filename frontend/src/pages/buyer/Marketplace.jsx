import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import Modal from "../../components/Modal.jsx";
import DevelopmentModeBanner from "../../components/DevelopmentModeBanner.jsx";
import { listProducts } from "../../services/api/products.js";
import { createOrder, payOrder } from "../../services/api/payments.js";
import { categories } from "../../services/mock/data.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function BuyerMarketplace() {
  const [products, setProducts] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [order, setOrder] = useState(null); // the order once created
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  useEffect(() => {
    listProducts().then(setProducts);
  }, []);

  function openProduct(p) {
    setViewing(p);
    setQuantity("");
    setTotalValue("");
    setOrder(null);
    setPaid(false);
    setError("");
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    const valueCents = Math.round(Number(totalValue) * 100);
    if (!quantity.trim() || !valueCents || valueCents <= 0) {
      setError("Enter a quantity and a total order value.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createOrder({
        supplierBusinessId: viewing.businessId,
        productSummary: `${viewing.name} (${quantity.trim()})`,
        valueCents,
        currency: "USD",
      });
      setOrder(created);
    } catch (err) {
      setError(err.message || "Could not place this order.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    setBusy(true);
    setError("");
    try {
      const result = await payOrder(order.id);
      setOrder(result.order);
      setPaid(true);
      showToast("Payment confirmed (development mode).");
    } catch (err) {
      setError(err.message || "Could not process payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Marketplace" subtitle="Browse products from suppliers SourceBridge has already checked out." />
      <div style={{ marginBottom: 22 }}>
        {categories.map((c, i) => (
          <span key={c} className={`pill ${i === 0 ? "pill-info" : "pill-neutral"}`} style={{ marginRight: 8, marginBottom: 6, display: "inline-block" }}>
            {c}
          </span>
        ))}
      </div>
      <Panel>
        <DataTable
          empty="No products are listed yet."
          columns={[
            { label: "Product", render: (p) => (<><strong>{p.name}</strong><br /><span className="muted">{p.category}</span></>) },
            {
              label: "Supplier",
              render: (p) => (p.business ? (<>{p.business.name}<br /><StatusPill status={p.business.trustLevel} /></>) : "Unknown"),
            },
            { label: "Price", key: "priceLabel" },
            { label: "Minimum order", key: "moq" },
            { label: "Production time", key: "productionTime" },
            { label: "", render: (p) => <button className="btn btn-secondary btn-sm" onClick={() => openProduct(p)}>View</button> },
          ]}
          rows={products}
        />
      </Panel>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        footer={
          paid ? (
            <>
              <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
              <Link to="/buyer/orders" className="btn btn-primary">View my orders</Link>
            </>
          ) : order ? (
            <>
              <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
              <button className="btn btn-primary" onClick={handlePay} disabled={busy}>
                {busy ? "Processing..." : "Pay now (development mode)"}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
              <button className="btn btn-primary" onClick={handlePlaceOrder} disabled={busy}>
                {busy ? "Placing order..." : "Place order"}
              </button>
            </>
          )
        }
      >
        {viewing && (
          <>
            <p className="muted" style={{ marginBottom: 14 }}>
              {viewing.business?.name} · {viewing.business?.location} <StatusPill status={viewing.business?.trustLevel} />
            </p>
            <div className="doc-checklist" style={{ marginBottom: 16 }}>
              <li>Price range <strong>{viewing.priceLabel}</strong></li>
              <li>Minimum order <strong>{viewing.moq}</strong></li>
              <li>Production time <strong>{viewing.productionTime}</strong></li>
              <li>Trust score <strong>{viewing.business?.trustScore} out of 100</strong></li>
            </div>

            {paid ? (
              <>
                <DevelopmentModeBanner />
                <p style={{ marginTop: 14 }}>
                  Order <strong>{order.id}</strong> is now <StatusPill status={order.state === "PAYMENT_PENDING" ? "pending" : "secured"} />.
                  Track its progress from My orders.
                </p>
              </>
            ) : order ? (
              <>
                <DevelopmentModeBanner />
                <p style={{ marginTop: 14 }}>
                  Order <strong>{order.id}</strong> created — protection model: <strong>{order.protectionModel === "high_value" ? "High value (required inspection)" : "Standard"}</strong>.
                  Pay now to confirm it with the supplier.
                </p>
              </>
            ) : (
              <form onSubmit={handlePlaceOrder}>
                <div className="form-row">
                  <div className="form-field">
                    <label>Quantity</label>
                    <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 100 units" />
                  </div>
                  <div className="form-field">
                    <label>Total order value (USD)</label>
                    <input type="number" min="0" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="9200" />
                  </div>
                </div>
              </form>
            )}
            {error && <p style={{ color: "var(--danger)", fontSize: "0.86rem", marginTop: 10 }}>{error}</p>}
          </>
        )}
      </Modal>
    </>
  );
}
