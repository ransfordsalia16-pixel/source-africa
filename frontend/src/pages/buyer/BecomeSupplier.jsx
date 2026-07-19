import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  getMyApplication,
  saveMyApplication,
  submitMyApplication,
  uploadMyDocument,
  uploadMyImage,
  openMyDocumentFile,
  openMyImageFile,
} from "../../services/api/businessApplications.js";

const DOCUMENT_TYPES = [
  { value: "business_license", label: "Business license" },
  { value: "tax_certificate", label: "Tax registration certificate" },
  { value: "export_license", label: "Export license" },
  { value: "bank_verification", label: "Bank account verification" },
  { value: "certification", label: "Product certification" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  name: "", type: "", location: "", establishedYear: "", employees: "", category: "",
  description: "", contactEmail: "", contactPhone: "", website: "", productsSummary: "",
};

const EDITABLE_STATES = new Set(["SUPPLIER_APPLICATION_STARTED", "SUPPLIER_REJECTED"]);

export default function BecomeSupplier() {
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();

  const [application, setApplication] = useState(undefined); // undefined = loading, null = no application yet
  const [form, setForm] = useState(EMPTY_FORM);
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].value);
  const [docFile, setDocFile] = useState(null);
  const [imageCaption, setImageCaption] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  function load() {
    getMyApplication().then((app) => {
      setApplication(app);
      if (app?.business) {
        const b = app.business;
        setForm({
          name: b.name || "", type: b.type || "", location: b.location || "",
          establishedYear: b.establishedYear || "", employees: b.employees || "", category: b.category || "",
          description: b.description || "", contactEmail: b.contactEmail || "", contactPhone: b.contactPhone || "",
          website: b.website || "", productsSummary: b.productsSummary || "",
        });
      }
    });
  }

  useEffect(load, []);

  if (application === undefined) return null;

  const business = application?.business;
  const status = business?.verificationStatus;
  const editable = !business || EDITABLE_STATES.has(status);
  const latestReason = application?.transitions?.[application.transitions.length - 1]?.reason;

  async function handleSaveDraft(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveMyApplication(form);
      showToast("Your business profile has been saved.");
      load();
    } catch (err) {
      showToast(err.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadDocument() {
    if (!docFile) return;
    try {
      await uploadMyDocument(docType, docFile);
      showToast("Document uploaded.");
      setDocFile(null);
      load();
    } catch (err) {
      showToast(err.message || "Could not upload that document.");
    }
  }

  async function handleUploadImage() {
    if (!imageFile) return;
    try {
      await uploadMyImage(imageCaption, imageFile);
      showToast("Photo uploaded.");
      setImageCaption("");
      setImageFile(null);
      load();
    } catch (err) {
      showToast(err.message || "Could not upload that photo.");
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await submitMyApplication();
      showToast("Your application has been submitted for review.");
      load();
    } catch (err) {
      showToast(err.message || "Could not submit your application.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckStatus() {
    setChecking(true);
    try {
      const session = await refreshSession();
      if (session.role === "supplier") {
        showToast("You're verified! Taking you to your supplier dashboard.");
        navigate("/supplier", { replace: true });
        return;
      }
      showToast("No change yet — we'll keep reviewing your application.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Become a supplier"
        subtitle="Tell us about your business. An admin reviews every application before you can sell on SourceBridge."
      />

      {business && (
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <StatusPill status={status} />
              <h2 style={{ marginTop: 10 }}>{business.name}</h2>
            </div>
            {!editable && (
              <button className="btn btn-secondary btn-sm" disabled={checking} onClick={handleCheckStatus}>
                {checking ? "Checking..." : "Check my application status"}
              </button>
            )}
          </div>
          {status === "SUPPLIER_REJECTED" && latestReason && (
            <p style={{ color: "var(--danger)", marginTop: 10 }}>Reason: {latestReason}. Update your profile below and resubmit.</p>
          )}
          {(status === "SUPPLIER_RESTRICTED" || status === "SUPPLIER_SUSPENDED") && latestReason && (
            <p style={{ color: "var(--danger)", marginTop: 10 }}>Reason: {latestReason}. Contact support if you believe this is a mistake.</p>
          )}
          {status === "SUPPLIER_VERIFICATION_PENDING" && (
            <p className="muted" style={{ marginTop: 10 }}>Your application is with our verification team. This usually takes a few business days.</p>
          )}
        </Panel>
      )}

      {editable && (
        <>
          <Panel title="Business profile">
            <form onSubmit={handleSaveDraft}>
              <div className="form-row">
                <div className="form-field">
                  <label>Business name</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your company name" />
                </div>
                <div className="form-field">
                  <label>Business type</label>
                  <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Manufacturer, trading company..." />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, country" />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Electronics, furniture..." />
                </div>
              </div>
              <div className="form-field">
                <label>Company description</label>
                <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does your business do?" />
              </div>
              <div className="form-field">
                <label>Products and services</label>
                <textarea rows="2" value={form.productsSummary} onChange={(e) => setForm({ ...form, productsSummary: e.target.value })} placeholder="What do you plan to sell on SourceBridge?" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Established year</label>
                  <input type="number" value={form.establishedYear} onChange={(e) => setForm({ ...form, establishedYear: e.target.value })} placeholder="2018" />
                </div>
                <div className="form-field">
                  <label>Employees</label>
                  <input value={form.employees} onChange={(e) => setForm({ ...form, employees: e.target.value })} placeholder="1-10, 50+..." />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Contact email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="sales@yourcompany.com" />
                </div>
                <div className="form-field">
                  <label>Contact phone</label>
                  <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+233..." />
                </div>
              </div>
              <div className="form-field">
                <label>Website or social link</label>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </Panel>

          {business && (
            <Panel title="Business documents">
              <p className="muted">Upload at least one document (business license, tax certificate, etc.) before submitting.</p>
              <div className="doc-checklist" style={{ marginBottom: 14 }}>
                {application.documents.length === 0 && <li>No documents uploaded yet.</li>}
                {application.documents.map((d) => (
                  <li key={d.id}>
                    {DOCUMENT_TYPES.find((t) => t.value === d.type)?.label || d.type}
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }} onClick={() => openMyDocumentFile(d.id)}>View</button>
                  </li>
                ))}
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Document type</label>
                  <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>File (JPG, PNG, WEBP, or PDF)</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setDocFile(e.target.files[0] || null)} />
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!docFile} onClick={handleUploadDocument}>Upload document</button>
            </Panel>
          )}

          {business && (
            <Panel title="Business photos">
              <div className="media-grid" style={{ marginBottom: 14 }}>
                {application.images.length === 0 && <div className="muted">No photos uploaded yet.</div>}
                {application.images.map((img) => (
                  <div key={img.id} style={{ cursor: "pointer" }} onClick={() => openMyImageFile(img.id)}>
                    {img.caption || "Photo"}
                  </div>
                ))}
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Caption</label>
                  <input value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} placeholder="Factory entrance, production line..." />
                </div>
                <div className="form-field">
                  <label>Photo (JPG, PNG, or WEBP)</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setImageFile(e.target.files[0] || null)} />
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!imageFile} onClick={handleUploadImage}>Upload photo</button>
            </Panel>
          )}

          {business && (
            <Panel>
              <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>
                {status === "SUPPLIER_REJECTED" ? "Resubmit for review" : "Submit for review"}
              </button>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
