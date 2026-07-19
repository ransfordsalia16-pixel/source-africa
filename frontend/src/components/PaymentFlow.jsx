import DevelopmentModeBanner from "./DevelopmentModeBanner.jsx";

// Describes what actually happens in this codebase: a signed, backend-verified payment event
// (see backend/src/routes/webhooks.js) drives the order through a server-enforced state
// machine (backend/src/domain/orderStateMachine.js). In development that event comes from
// MockPaymentProvider, not a real bank or card network — nothing here should be read as "your
// money is currently held by SourceBridge," because today, it isn't.
const STEPS_BY_MODEL = {
  standard: [
    { title: "You place the order", body: "You agree quantity and price with a verified supplier, then pay through SourceBridge's payment flow instead of paying the supplier directly." },
    { title: "Payment is confirmed", body: "The payment provider confirms your payment to SourceBridge's server through a signed, verifiable event — never just a message from your browser." },
    { title: "The supplier is authorized to begin", body: "Only once that confirmation is verified does the supplier see the order as funded and start production." },
    { title: "Delivery is confirmed", body: "The order moves through shipping to delivery, tracked at every stage." },
    { title: "You have an acceptance window", body: "After delivery, you have a window to confirm everything matches what you ordered, or open a dispute if it doesn't." },
    { title: "Payout becomes eligible", body: "Only after your acceptance (or a resolved dispute) does the order become eligible for payout to the supplier." },
  ],
  high_value: [
    { title: "You place the order", body: "This order's value puts it on SourceBridge's high-value protection path, which adds a required inspection step before shipment." },
    { title: "Payment is confirmed", body: "The payment provider confirms your payment to SourceBridge's server through a signed, verifiable event." },
    { title: "The supplier is authorized to begin", body: "The supplier starts production once payment is verified." },
    { title: "An independent inspection is required", body: "Before shipment, this order requires an inspection step — quantity, quality, and packaging are checked and recorded." },
    { title: "Delivery and acceptance", body: "After delivery, you review the inspection record and the goods themselves before accepting or disputing." },
    { title: "Payout becomes eligible", body: "Only after acceptance (or a resolved dispute) does the order become eligible for payout to the supplier." },
  ],
};

export default function PaymentFlow({ activeStep = 0, protectionModel = "standard" }) {
  const steps = STEPS_BY_MODEL[protectionModel] || STEPS_BY_MODEL.standard;
  return (
    <div>
      <DevelopmentModeBanner />
      <div className="payment-flow-list" style={{ marginTop: 14 }}>
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="list-item-row"
            style={{ alignItems: "flex-start", gap: 16 }}
          >
            <div
              className="pstep-dot"
              style={{
                flexShrink: 0,
                background: i <= activeStep ? "var(--forest)" : "var(--sand-dark)",
                color: i <= activeStep ? "#fff" : "var(--ink-soft)",
              }}
            >
              {i < activeStep ? "✓" : i + 1}
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>{step.title}</strong>
              <span className="muted" style={{ fontSize: "0.86rem" }}>{step.body}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
