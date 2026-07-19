import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { getSuppliers } from "../../services/api/suppliers.js";
import { getSupplierVerificationQueue, approveSupplier, rejectSupplier } from "../../services/api/verification.js";
import { logAction } from "../../services/api/audit.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

const DOC_LABELS = {
  businessLicense: "Business license",
  taxCertificate: "Tax registration certificate",
  exportLicense: "Export license",
  bankVerification: "Bank account verification",
  certifications: "Product certifications",
};

export default function AdminSupplierVerification() {
  const { profile } = useAuth();
  const [queue, setQueue] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const showToast = useToast();

  function load() {
    getSupplierVerificationQueue().then(setQueue);
  }

  useEffect(() => {
    load();
    getSuppliers().then(setSuppliers);
  }, []);

  const supplierById = (id) => suppliers.find((s) => s.id === id);

  async function handleApprove(record) {
    await approveSupplier(record.id);
    const supplier = supplierById(record.supplierId);
    await logAction(`${profile.name} (Admin)`, `Approved supplier verification for ${supplier?.name}, granting gold status`);
    showToast(`${supplier?.name} is now a gold supplier.`);
    load();
  }

  async function handleReject(record) {
    const supplier = supplierById(record.supplierId);
    await rejectSupplier(record.id);
    await logAction(`${profile.name} (Admin)`, `Turned down the verification request from ${supplier?.name}`);
    showToast(`${supplier?.name}'s verification request was turned down.`);
    load();
  }

  return (
    <>
      <PageHeader title="Supplier verification" subtitle="Check documents and factory evidence before a supplier goes live." />
      {queue.length === 0 && <div className="empty-state">No suppliers are waiting on verification right now.</div>}
      {queue.map((v) => {
        const supplier = supplierById(v.supplierId);
        if (!supplier) return null;
        return (
          <Panel key={v.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>{supplier.name}</h2>
                <p className="muted">{supplier.location} · {supplier.type} · Submitted {v.submitted}</p>
              </div>
              <StatusPill status={v.stage} />
            </div>
            <div className="doc-checklist" style={{ marginTop: 14 }}>
              {Object.entries(v.documents).map(([key, status]) => (
                <li key={key}>
                  {DOC_LABELS[key]} <StatusPill status={status} />
                </li>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleApprove(v)}>Approve</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleReject(v)}>Turn down</button>
            </div>
          </Panel>
        );
      })}
    </>
  );
}
