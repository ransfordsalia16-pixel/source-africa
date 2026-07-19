export const NAV = {
  buyer: [
    { to: "/buyer", label: "Overview", icon: "🏠", end: true },
    { to: "/buyer/requests", label: "My requests", icon: "📝" },
    { to: "/buyer/orders", label: "My orders", icon: "📦" },
    { to: "/buyer/marketplace", label: "Marketplace", icon: "🛒" },
    { to: "/buyer/messages", label: "Messages", icon: "💬" },
    { to: "/buyer/disputes", label: "Disputes", icon: "⚖️" },
    { to: "/buyer/payments", label: "Payments", icon: "💳" },
    { to: "/buyer/become-supplier", label: "Become a supplier", icon: "🏭" },
    { to: "/buyer/verify-company", label: "Verify my company", icon: "🪪" },
  ],
  supplier: [
    { to: "/supplier", label: "Overview", icon: "🏠", end: true },
    { to: "/supplier/products", label: "Products", icon: "📦" },
    { to: "/supplier/requests", label: "Buyer requests", icon: "📥" },
    { to: "/supplier/orders", label: "Orders", icon: "🧾" },
    { to: "/supplier/messages", label: "Messages", icon: "💬" },
    { to: "/supplier/disputes", label: "Disputes", icon: "⚖️" },
    { to: "/supplier/analytics", label: "Analytics", icon: "📊" },
    { to: "/supplier/profile", label: "Company profile", icon: "🏭" },
  ],
  admin: [
    { to: "/admin", label: "Overview", icon: "🏠", end: true },
    { to: "/admin/suppliers", label: "Supplier verification", icon: "✅" },
    { to: "/admin/supplier-applications", label: "Supplier applications", icon: "🧾" },
    { to: "/admin/buyers", label: "Buyer verification", icon: "🪪" },
    { to: "/admin/buyer-profiles", label: "Buyer profiles", icon: "🏢" },
    { to: "/admin/payments", label: "Payments and escrow", icon: "💰" },
    { to: "/admin/disputes", label: "Disputes", icon: "⚖️" },
    { to: "/admin/cases", label: "Support cases", icon: "🗂️" },
    { to: "/admin/logistics", label: "Logistics", icon: "🚢" },
    { to: "/admin/conversations", label: "Conversations", icon: "💬" },
    { to: "/admin/security", label: "Security and access", icon: "🔐" },
  ],
};

export const ROLE_LABELS = {
  buyer: "Buyer",
  supplier: "Supplier",
  admin: "Admin",
};
