import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import OrderDetailModal from "../../components/OrderDetailModal.jsx";
import { getOrders } from "../../services/api/orders.js";
import { currency } from "../../utils/format.js";

export default function BuyerOrders() {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    getOrders().then(setOrders);
  }, []);

  return (
    <>
      <PageHeader title="My orders" subtitle="Track everything from production through delivery." />
      <Panel>
        <DataTable
          columns={[
            { label: "Order", render: (o) => (<><strong>{o.product}</strong><br /><span className="muted">{o.id}</span></>) },
            { label: "Supplier", key: "supplierName" },
            { label: "Value", render: (o) => currency(o.value, o.currency) },
            { label: "Expected by", key: "eta" },
            { label: "Stage", render: (o) => <StatusPill status={o.stage} /> },
            { label: "Payment", render: (o) => <StatusPill status={o.paymentStatus} /> },
            { label: "", render: (o) => <button className="btn btn-secondary btn-sm" onClick={() => setActiveOrder(o)}>Track shipment</button> },
          ]}
          rows={orders}
        />
      </Panel>
      <OrderDetailModal order={activeOrder} open={!!activeOrder} onClose={() => setActiveOrder(null)} />
    </>
  );
}
