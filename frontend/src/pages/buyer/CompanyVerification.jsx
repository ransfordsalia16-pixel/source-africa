import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import Panel from "../../components/Panel.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import { getMyProfile, saveMyProfile } from "../../services/api/buyerProfile.js";
import { useToast } from "../../context/ToastContext.jsx";

const EMPTY_FORM = { companyName: "", location: "", businessType: "" };
const EDITABLE_STATES = new Set([null, "BUYER_REJECTED"]);

export default function BuyerCompanyVerification() {
  const [profile, setProfile] = useState(undefined); // undefined = loading
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  function load() {
    getMyProfile().then((p) => {
      setProfile(p);
      if (p) setForm({ companyName: p.companyName, location: p.location || "", businessType: p.businessType || "" });
    });
  }

  useEffect(load, []);

  if (profile === undefined) return null;

  const status = profile?.verificationStatus ?? null;
  const editable = EDITABLE_STATES.has(status);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveMyProfile(form);
      showToast(status === "BUYER_REJECTED" ? "Your company was resubmitted for verification." : "Your company was submitted for verification.");
      load();
    } catch (err) {
      showToast(err.message || "Could not save your company details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Verify my company"
        subtitle="Confirming your company is real helps suppliers trust who they're dealing with. This doesn't limit anything you can already do."
      />

      {profile && (
        <Panel>
          <StatusPill status={status} />
          <h2 style={{ marginTop: 10 }}>{profile.companyName}</h2>
          {status === "BUYER_REJECTED" && profile.reviewNotes && (
            <p style={{ color: "var(--danger)", marginTop: 10 }}>Reason: {profile.reviewNotes}. Update your details below and resubmit.</p>
          )}
          {status === "BUYER_VERIFICATION_PENDING" && (
            <p className="muted" style={{ marginTop: 10 }}>We're reviewing your company details.</p>
          )}
        </Panel>
      )}

      {editable && (
        <Panel title="Company details">
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Company name</label>
              <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Your company name" />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, country" />
              </div>
              <div className="form-field">
                <label>Business type</label>
                <input value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} placeholder="Retailer, hospitality, construction..." />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Submitting..." : status === "BUYER_REJECTED" ? "Resubmit for verification" : "Submit for verification"}
            </button>
          </form>
        </Panel>
      )}
    </>
  );
}
