import { NAV } from "../constants/nav.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Topbar({ pathname, onToggleSidebar }) {
  const { role, profile } = useAuth();
  const items = NAV[role] || [];
  const current = items.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button id="mobile-nav-toggle" className="btn btn-secondary btn-sm" style={{ display: "none" }} onClick={onToggleSidebar}>
          ☰
        </button>
        <div className="topbar-title">{current ? current.label : "Dashboard"}</div>
      </div>
      <div className="topbar-right">
        <input className="topbar-search" placeholder="Search (demo only)" disabled />
        <div className="topbar-bell">
          🔔<span className="dot"></span>
        </div>
        <div className="topbar-user">
          <div className="avatar">{profile?.avatarInitials}</div>
          <div className="topbar-user-info">
            <strong>{profile?.name}</strong>
            <span>{profile?.company}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
