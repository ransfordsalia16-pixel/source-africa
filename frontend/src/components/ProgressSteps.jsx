export default function ProgressSteps({ stages, labels, current }) {
  const currentIdx = stages.indexOf(current);
  return (
    <div className="progress-steps">
      {stages.map((stage, i) => (
        <span key={stage} style={{ display: "contents" }}>
          <div className={`pstep ${i < currentIdx ? "done" : ""} ${i === currentIdx ? "active" : ""}`}>
            <span className="pstep-dot">{i < currentIdx ? "✓" : i + 1}</span>
            <span className="pstep-label">{labels[stage]}</span>
          </div>
          {i < stages.length - 1 && <span className="pstep-line"></span>}
        </span>
      ))}
    </div>
  );
}
