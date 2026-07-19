import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import DevelopmentModeBanner from "../../components/DevelopmentModeBanner.jsx";
import { StatGrid } from "../../components/StatCard.jsx";
import { adminGetTransactions } from "../../services/api/payments.js";
import { getOrders, advanceOrderStage } from "../../services/api/orders.js";
import { logAction } from "../../services/api/audit.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { currency } from "../../utils/format.js";

export default function AdminPayments() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [orderStateById, setOrderStateById] = useState({});
  const showToast = useToast();

  function load() {
    adminGetTransactions().then(setTransactions);
    getOrders().then((orders) => setOrderStateById(Object.fromEntries(orders.map((o) => [o.id, o.state]))));
  }

  useEffect(load, []);

  const held = transactions.filter((t) => t.status === "held").reduce((s, t) => s + t.amount, 0);
  const released = transactions.filter((t) => t.status === "released").reduce((s, t) => s + t.amount, 0);
  const totalFees = transactions.reduce((s, t) => s + t.platformFee, 0);

  async function handleRelease(t) {
    try {
      await advanceOrderStage(t.orderId);
      await logAction(`${profile.name} (Admin)`, `Released ${currency(t.amount, t.currency)} to the supplier for ${t.orderId}`);
      showToast(`${t.id} released.`);
      load();
    } catch (err) {
      showToast(err.message || "Could not release this payment yet.");
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment on SourceBridge passes through here before a supplier sees it." />
      <DevelopmentModeBanner />
      <StatGrid
        cards={[
          { label: "Payment confirmed, awaiting payout", value: currency(held), sublabel: "Waiting on acceptance or dispute resolution", tone: "warn" },
          { label: "Released to suppliers", value: currency(released), sublabel: "Completed payouts", tone: "ok" },
          { label: "Total transactions", value: transactions.length },
          { label: "Platform fees (development)", value: currency(totalFees) },
        ]}
      />
      <Panel>
        <DataTable
          empty="No payments yet."
          columns={[
            { label: "Transaction", key: "id" },
            { label: "Order", key: "orderId" },
            { label: "Amount", render: (t) => currency(t.amount, t.currency) },
            { label: "Platform fee", render: (t) => currency(t.platformFee, t.currency) },
            { label: "Date", render: (t) => t.createdAt },
            { label: "Status", render: (t) => <StatusPill status={t.refundStatus || t.status} /> },
            {
              label: "",
              render: (t) =>
                orderStateById[t.orderId] === "PAYOUT_PENDING" ? (
                  <button className="btn btn-primary btn-sm" onClick={() => handleRelease(t)}>Release</button>
                ) : (
                  <span className="muted">{orderStateById[t.orderId] === "COMPLETED" ? "Done" : "Not yet eligible"}</span>
                ),
            },
          ]}
          rows={transactions}
        />
      </Panel>
    </>
  );
}
