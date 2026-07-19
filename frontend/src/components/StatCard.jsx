export function StatCard({ label, value, sublabel, tone = "neutral" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sublabel && <span className="stat-sub">{sublabel}</span>}
    </div>
  );
}

export function StatGrid({ cards }) {
  return (
    <div className="stat-grid">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}
