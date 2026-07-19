import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import { listMyProducts, createProduct, updateProduct } from "../../services/api/products.js";
import { getMyApplication } from "../../services/api/businessApplications.js";
import { useToast } from "../../context/ToastContext.jsx";

const EMPTY_FORM = { name: "", category: "", priceLabel: "", moq: "", productionTime: "" };

export default function SupplierProducts() {
  const [verificationStatus, setVerificationStatus] = useState(undefined); // undefined = loading
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  function load() {
    getMyApplication().then((app) => setVerificationStatus(app?.business.verificationStatus ?? null));
    listMyProducts().then(setProducts);
  }

  useEffect(load, []);

  function openEdit(product) {
    setEditing(product);
    setForm({ name: product.name, category: product.category || "", priceLabel: product.priceLabel || "", moq: product.moq || "", productionTime: product.productionTime || "" });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, form);
        showToast("Your changes are live on the marketplace.");
      } else {
        await createProduct(form);
        showToast("Your new product is live on the marketplace.");
      }
      setEditing(null);
      setCreating(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      showToast(err.message || "Could not save that product.");
    } finally {
      setSaving(false);
    }
  }

  const modalOpen = creating || !!editing;
  const canManageListings = verificationStatus === "SUPPLIER_VERIFIED";

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage your catalog and see how buyers are finding you."
        actions={canManageListings ? <button className="btn btn-primary" onClick={() => setCreating(true)}>Add a product</button> : null}
      />

      {verificationStatus !== undefined && !canManageListings && (
        <Panel>
          <p className="muted">
            {verificationStatus == null
              ? "Apply to become a supplier before listing products."
              : "Your business must be a verified supplier before you can add or edit products. Existing listings are shown below."}
          </p>
        </Panel>
      )}

      <Panel>
        <DataTable
          columns={[
            { label: "Product", key: "name" },
            { label: "Price", key: "priceLabel" },
            { label: "Minimum order", key: "moq" },
            { label: "Views", render: (p) => p.views.toLocaleString() },
            { label: "Inquiries", key: "inquiries" },
            { label: "", render: (p) => canManageListings ? <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button> : null },
          ]}
          rows={products}
        />
      </Panel>

      <Modal
        open={modalOpen}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : "Add a product"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Publish product"}</button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-field">
            <label>Product name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="For example, 500W solar panel" />
          </div>
          <div className="form-field">
            <label>Category</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Energy, Furniture, Automotive..." />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Price range</label>
              <input value={form.priceLabel} onChange={(e) => setForm({ ...form, priceLabel: e.target.value })} placeholder="$60 to $75 per unit" />
            </div>
            <div className="form-field">
              <label>Minimum order</label>
              <input value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} placeholder="50 units" />
            </div>
          </div>
          <div className="form-field">
            <label>Production time</label>
            <input value={form.productionTime} onChange={(e) => setForm({ ...form, productionTime: e.target.value })} placeholder="15 to 20 days" />
          </div>
        </form>
      </Modal>
    </>
  );
}
