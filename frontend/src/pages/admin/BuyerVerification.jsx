import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { getBuyerVerificationQueue, approveBuyer } from "../../services/api/buyers.js";
import { logAction } from "../../services/api/audit.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export default function AdminBuyerVerification() {
  const { profile } = useAuth();
  const [queue, setQueue] = useState([]);
  const showToast = useToast();

  function load() {
    getBuyerVerificationQueue().then(setQueue);
  }

  useEffect(load, []);

  async function handleApprove(b) {
    await approveBuyer(b.id);
    await logAction(`${profile.name} (Admin)`, `Approved buyer verification for ${b.name}`);
    showToast(`${b.name} can now trade on SourceBridge.`);
    load();
  }

  return (
    <>
      <PageHeader title="Buyer verification" subtitle="Confirm a buyer's business is real before they get full marketplace access." />
      <Panel>
        <DataTable
          columns={[
            { label: "Business", render: (b) => (<><strong>{b.name}</strong><br /><span className="muted">{b.location}</span></>) },
            { label: "Type", key: "type" },
            { label: "Submitted", key: "submitted" },
            { label: "Status", render: (b) => <StatusPill status={b.status} /> },
            { label: "", render: (b) => (b.status === "pending" ? <button className="btn btn-primary btn-sm" onClick={() => handleApprove(b)}>Approve</button> : <span className="muted">Nothing to do</span>) },
          ]}
          rows={queue}
        />
      </Panel>
    </>
  );
}
