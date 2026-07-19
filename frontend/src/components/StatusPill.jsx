import { STATUS_MAP } from "../constants/statusMap.js";

export default function StatusPill({ status, children }) {
  if (children) {
    return <span className={`pill pill-${status || "neutral"}`}>{children}</span>;
  }
  const [label, tone] = STATUS_MAP[status] || [status, "neutral"];
  return <span className={`pill pill-${tone}`}>{label}</span>;
}
