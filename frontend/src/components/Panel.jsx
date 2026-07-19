export default function Panel({ title, children, className = "" }) {
  return (
    <div className={`panel-card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
