import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import DevelopmentModeBanner from "../../components/DevelopmentModeBanner.jsx";
import PaymentFlow from "../../components/PaymentFlow.jsx";
import { getMyTransactions } from "../../services/api/payments.js";
import { currency } from "../../utils/format.js";

export default function BuyerPayments() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    getMyTransactions().then(setTransactions);
  }, []);

  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment you make goes through SourceBridge's payment flow, not directly to the supplier." />
      <DevelopmentModeBanner />
      <div className="panel-grid-2" style={{ marginTop: 18 }}>
        <Panel title="Your transactions">
          <DataTable
            empty="No payments yet."
            columns={[
              { label: "Transaction", key: "id" },
              { label: "Order", key: "orderId" },
              { label: "Amount", render: (t) => currency(t.amount, t.currency) },
              { label: "Platform fee", render: (t) => currency(t.platformFee, t.currency) },
              { label: "Date", render: (t) => t.createdAt },
              { label: "Status", render: (t) => <StatusPill status={t.refundStatus || t.status} /> },
            ]}
            rows={transactions}
          />
        </Panel>
        <Panel title="How payment protection works">
          <PaymentFlow activeStep={-1} />
        </Panel>
      </div>
    </>
  );
}
