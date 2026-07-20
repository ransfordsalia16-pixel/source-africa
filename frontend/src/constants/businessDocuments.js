// Matches business_documents.type in the backend schema (see routes/businessApplications.js's
// documentTypeSchema) — the full set of document types a supplier can upload during verification.
export const DOCUMENT_TYPE_LABELS = {
  business_license: "Business license",
  tax_certificate: "Tax certificate",
  export_license: "Export license",
  bank_verification: "Bank verification",
  certification: "Certifications (ISO, CE, IEC)",
  other: "Other",
};
