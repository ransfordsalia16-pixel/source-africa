import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { StatGrid } from "../../components/StatCard.jsx";
import { getOrders } from "../../services/api/orders.js";
import { getSuppliers } from "../../services/api/suppliers.js";
import { getSupplierVerificationQueue } from "../../services/api/verification.js";
import { getBuyerVerificationQueue } from "../../services/api/buyers.js";
import { adminGetDisputes } from "../../services/api/disputes.js";
import { getAuditLog } from "../../services/api/audit.js";
import { currency } from "../../utils/format.js";

export default function AdminOverview() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [buyerQueue, setBuyerQueue] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    getOrders().then(setOrders);
    getSuppliers().then(setSuppliers);
    getSupplierVerificationQueue().then(setVerificationQueue);
    getBuyerVerificationQueue().then(setBuyerQueue);
    adminGetDisputes().then(setDisputes);
    getAuditLog().then(setAuditLog);
  }, []);

  const supplierById = (id) => suppliers.find((s) => s.id === id);
  const gmv = orders.reduce((s, o) => s + o.value, 0);
  const activeSuppliers = suppliers.filter((s) => s.trustLevel !== "unverified").length;
  const pendingVerifications = verificationQueue.length + buyerQueue.filter((b) => b.status === "pending").length;
  const openDisputes = disputes.filter((d) => d.status !== "resolved").length;

  return (
    <>
      <PageHeader title="How the network is doing" subtitle="A quick look at trade, trust, and safety across SourceBridge Africa." />
      <StatGrid
        cards={[
          { label: "Total trade value", value: currency(gmv), sublabel: "Every order to date" },
          { label: "Active suppliers", value: activeSuppliers, sublabel: `out of ${suppliers.length} registered`, tone: "ok" },
          { label: "Waiting on verification", value: pendingVerifications, tone: "warn" },
          { label: "Open disputes", value: openDisputes, tone: openDisputes ? "warn" : "ok" },
        ]}
      />
      <div className="panel-grid-2">
        <Panel title="Suppliers waiting on you">
          <DataTable
            columns={[
              { label: "Supplier", render: (v) => supplierById(v.supplierId)?.name || v.supplierId },
              { label: "Stage", render: (v) => <StatusPill status={v.stage} /> },
              { label: "", render: () => <Link to="/admin/suppliers" className="btn btn-secondary btn-sm">Review</Link> },
            ]}
            rows={verificationQueue}
          />
        </Panel>
        <Panel title="Recently logged activity">
          {auditLog.slice(0, 4).map((l) => (
            <div key={l.id} className="list-item-row">
              <div>
                <strong>{l.action}</strong>
                <br />
                <span className="muted">{l.actor} · {l.time}</span>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
