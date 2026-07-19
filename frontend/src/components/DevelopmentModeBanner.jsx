// Shown on every screen that touches payments. This is a disclosure, not decoration — the
// backend really is running MockPaymentProvider (see backend/src/payments/MockPaymentProvider.js),
// so nothing on these screens should ever be allowed to imply real money is moving.
export default function DevelopmentModeBanner() {
  return (
    <div className="callout-banner" role="status">
      <span>🧪 <strong>DEVELOPMENT MODE</strong> — no real money is being processed. Payments here are simulated end to end.</span>
    </div>
  );
}
