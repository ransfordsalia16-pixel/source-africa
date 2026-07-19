import { useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV, ROLE_LABELS } from "../constants/nav.js";
import { useAuth } from "../context/AuthContext.jsx";
import SupportRequestModal from "./SupportRequestModal.jsx";

const SUPPORT_ROLES = new Set(["buyer", "supplier"]);

export default function Sidebar({ open, onNavigate }) {
  const { role, signOut } = useAuth();
  const items = NAV[role] || [];
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand">
        <span className="mark">SB</span> SourceBridge
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        {SUPPORT_ROLES.has(role) && (
          <button onClick={() => setSupportOpen(true)}>Contact support</button>
        )}
        <span style={{ padding: "6px 12px", fontSize: "0.72rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Signed in as {ROLE_LABELS[role]}
        </span>
        <button onClick={signOut}>Sign out</button>
      </div>
      {SUPPORT_ROLES.has(role) && (
        <SupportRequestModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      )}
    </aside>
  );
}
