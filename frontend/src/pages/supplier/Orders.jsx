import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import OrderDetailModal from "../../components/OrderDetailModal.jsx";
import { getOrders, advanceOrderStage, orderStageLabels } from "../../services/api/orders.js";
import { currency } from "../../utils/format.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function SupplierOrders() {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const showToast = useToast();

  function load() {
    getOrders().then(setOrders);
  }

  useEffect(load, []);

  async function handleAdvance() {
    const updated = await advanceOrderStage(activeOrder.id);
    setActiveOrder(updated);
    showToast(`${updated.id} moved to ${orderStageLabels[updated.stage]}.`);
    load();
  }

  return (
    <>
      <PageHeader title="Orders" subtitle="Move each order forward as production, inspection, and shipping happen." />
      <Panel>
        <DataTable
          columns={[
            { label: "Order", render: (o) => (<><strong>{o.product}</strong><br /><span className="muted">{o.id} · {o.buyerName}</span></>) },
            { label: "Value", render: (o) => currency(o.value, o.currency) },
            { label: "Stage", render: (o) => <StatusPill status={o.stage} /> },
            { label: "Payment", render: (o) => <StatusPill status={o.paymentStatus} /> },
            { label: "", render: (o) => <button className="btn btn-secondary btn-sm" onClick={() => setActiveOrder(o)}>Manage</button> },
          ]}
          rows={orders}
        />
      </Panel>
      <OrderDetailModal
        order={activeOrder}
        open={!!activeOrder}
        onClose={() => setActiveOrder(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setActiveOrder(null)}>Close</button>
            {activeOrder?.stage !== "delivered" && (
              <button className="btn btn-primary" onClick={handleAdvance}>Mark next stage ready</button>
            )}
          </>
        }
      />
    </>
  );
}
