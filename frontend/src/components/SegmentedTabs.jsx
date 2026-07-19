export default function SegmentedTabs({ tabs, active, onChange }) {
  return (
    <div className="seg-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`seg-tab ${t.key === active ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
