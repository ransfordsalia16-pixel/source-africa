// Demo data only. Nothing here is a real business, order, or transaction.
// Every array is treated like a tiny in-memory database that the api/ layer reads from and writes to,
// so swapping these functions for real network calls later does not touch the pages that use them.

export const buyerProfile = {
  id: "USR-BUY-01",
  name: "Ama Boateng",
  company: "Boateng Hospitality Group",
  role: "Procurement Manager",
  location: "Accra, Ghana",
  avatarInitials: "AB",
  mfaEnabled: true,
  lastLogin: "2026-07-18 08:14",
};

export const supplierProfile = {
  id: "USR-SUP-01",
  name: "Li Wei",
  company: "Shenzhen Solar Technology Ltd",
  role: "Export Manager",
  location: "Shenzhen, China",
  avatarInitials: "LW",
  trustLevel: "gold",
  trustScore: 94,
  mfaEnabled: true,
  lastLogin: "2026-07-18 06:02",
};

export const adminProfile = {
  id: "USR-ADM-01",
  name: "Kwame Asante",
  company: "SourceBridge Africa",
  role: "Verification Administrator",
  location: "Accra, Ghana",
  avatarInitials: "KA",
  mfaEnabled: true,
  lastLogin: "2026-07-18 07:40",
};

export let suppliers = [
  { id: "SUP-001", name: "Shenzhen Solar Technology Ltd", location: "Shenzhen, China", type: "Manufacturer", established: 2014, employees: "150+", trustLevel: "gold", trustScore: 94, category: "Energy", verified: ["Business License", "Factory", "Export History", "Certifications"] },
  { id: "SUP-002", name: "Guangzhou Furniture Works", location: "Guangzhou, China", type: "Manufacturer", established: 2010, employees: "300+", trustLevel: "platinum", trustScore: 98, category: "Furniture", verified: ["Business License", "Factory", "Export History", "Certifications"] },
  { id: "SUP-003", name: "Ningbo EV Components Co.", location: "Ningbo, China", type: "Manufacturer", established: 2018, employees: "80+", trustLevel: "verified", trustScore: 76, category: "Automotive", verified: ["Business License", "Export History"] },
  { id: "SUP-004", name: "Yiwu Trading International", location: "Yiwu, China", type: "Trading Company", established: 2016, employees: "40+", trustLevel: "verified", trustScore: 71, category: "Electronics", verified: ["Business License"] },
  { id: "SUP-005", name: "Foshan Industrial Machinery", location: "Foshan, China", type: "Manufacturer", established: 2009, employees: "220+", trustLevel: "gold", trustScore: 89, category: "Industrial", verified: ["Business License", "Factory", "Export History"] },
  { id: "SUP-006", name: "Qingdao Beauty Equipment Ltd", location: "Qingdao, China", type: "Manufacturer", established: 2020, employees: "35+", trustLevel: "unverified", trustScore: 40, category: "Beauty", verified: [] },
];

export let products = [
  { id: "PRD-101", name: "450W Monocrystalline Solar Panel", supplierId: "SUP-001", category: "Energy", price: "$62 to $78 per unit", moq: "50 units", productionTime: "15 to 20 days", views: 1284, inquiries: 37 },
  { id: "PRD-102", name: "Stackable Hotel Dining Chair", supplierId: "SUP-002", category: "Furniture", price: "$18 to $24 per unit", moq: "200 units", productionTime: "20 to 25 days", views: 902, inquiries: 22 },
  { id: "PRD-103", name: "EV Charging Cable, Type 2, 7kW", supplierId: "SUP-003", category: "Automotive", price: "$34 to $41 per unit", moq: "100 units", productionTime: "10 to 15 days", views: 611, inquiries: 14 },
  { id: "PRD-104", name: "Bluetooth Smart Door Lock", supplierId: "SUP-004", category: "Electronics", price: "$21 to $29 per unit", moq: "150 units", productionTime: "12 to 18 days", views: 445, inquiries: 9 },
  { id: "PRD-105", name: "Industrial Rock Crusher, 5T per hour", supplierId: "SUP-005", category: "Industrial", price: "$4,200 to $5,600 per unit", moq: "1 unit", productionTime: "35 to 40 days", views: 213, inquiries: 6 },
];

export let buyerRequests = [
  { id: "RFQ-3391", product: "Restaurant chairs", quantity: "500 units", budget: "$9,000 to $11,000", destination: "Accra, Ghana", requiredBy: "2026-09-05", status: "quotes_received", quotesCount: 4, createdAt: "2026-07-02" },
  { id: "RFQ-3388", product: "Solar panels for a school project", quantity: "120 units", budget: "$8,500 to $10,000", destination: "Kumasi, Ghana", requiredBy: "2026-08-20", status: "negotiation", quotesCount: 3, createdAt: "2026-06-28" },
  { id: "RFQ-3379", product: "EV spare parts assortment", quantity: "1 container", budget: "$18,000 to $22,000", destination: "Tema, Ghana", requiredBy: "2026-09-30", status: "searching", quotesCount: 0, createdAt: "2026-07-10" },
  { id: "RFQ-3350", product: "Hotel dining chairs", quantity: "1,000 units", budget: "$25,000 to $30,000", destination: "Accra, Ghana", requiredBy: "2026-08-01", status: "order_confirmed", quotesCount: 5, createdAt: "2026-06-01" },
];

export let orders = [
  { id: "ORD-8842", product: "Hotel Dining Chairs (1,000 units)", buyer: "Boateng Hospitality Group", supplierId: "SUP-002", value: 27500, currency: "USD", stage: "shipping", paymentStatus: "secured", createdAt: "2026-06-05", eta: "2026-08-02" },
  { id: "ORD-8830", product: "450W Solar Panels (120 units)", buyer: "Kumasi STEM Academy", supplierId: "SUP-001", value: 9200, currency: "USD", stage: "production", paymentStatus: "secured", createdAt: "2026-06-20", eta: "2026-08-18" },
  { id: "ORD-8811", product: "EV Charging Cables (300 units)", buyer: "Tema Auto Imports", supplierId: "SUP-003", value: 11400, currency: "USD", stage: "inspection", paymentStatus: "secured", createdAt: "2026-06-25", eta: "2026-08-10" },
  { id: "ORD-8790", product: "Smart Door Locks (150 units)", buyer: "Accra Living Estates", supplierId: "SUP-004", value: 3900, currency: "USD", stage: "delivered", paymentStatus: "released", createdAt: "2026-05-10", eta: "2026-06-30" },
  { id: "ORD-8776", product: "Rock Crusher Unit", buyer: "Volta Quarry Ltd", supplierId: "SUP-005", value: 4900, currency: "USD", stage: "customs", paymentStatus: "secured", createdAt: "2026-05-28", eta: "2026-07-25" },
];

export const orderStages = ["order_confirmed", "production", "inspection", "shipping", "customs", "delivered"];
export const orderStageLabels = {
  order_confirmed: "Order confirmed",
  production: "Production",
  inspection: "Quality inspection",
  shipping: "Shipping",
  customs: "Customs clearance",
  delivered: "Delivered",
};

export let transactions = [
  { id: "TXN-5510", orderId: "ORD-8842", type: "Escrow deposit", amount: 27500, status: "held", date: "2026-06-05" },
  { id: "TXN-5498", orderId: "ORD-8790", type: "Escrow deposit", amount: 3900, status: "released", date: "2026-05-10" },
  { id: "TXN-5499", orderId: "ORD-8790", type: "Supplier payout", amount: 3705, status: "released", date: "2026-06-30" },
  { id: "TXN-5505", orderId: "ORD-8830", type: "Escrow deposit", amount: 9200, status: "held", date: "2026-06-20" },
  { id: "TXN-5507", orderId: "ORD-8811", type: "Escrow deposit", amount: 11400, status: "held", date: "2026-06-25" },
  { id: "TXN-5501", orderId: "ORD-8776", type: "Milestone 1 (20 percent)", amount: 980, status: "released", date: "2026-05-28" },
  { id: "TXN-5502", orderId: "ORD-8776", type: "Milestone 2 (40 percent)", amount: 1960, status: "held", date: "2026-07-01" },
];

export let disputes = [
  { id: "DSP-221", orderId: "ORD-8776", buyer: "Volta Quarry Ltd", supplierId: "SUP-005", reason: "Late delivery", status: "investigating", opened: "2026-07-12" },
  { id: "DSP-219", orderId: "ORD-8811", buyer: "Tema Auto Imports", supplierId: "SUP-003", reason: "Quantity mismatch on inspection", status: "awaiting_supplier", opened: "2026-07-08" },
  { id: "DSP-205", orderId: "ORD-8790", buyer: "Accra Living Estates", supplierId: "SUP-004", reason: "Minor packaging damage", status: "resolved", opened: "2026-06-15", resolution: "Partial refund issued ($120)" },
];

export let verificationQueue = [
  { id: "VER-441", supplierId: "SUP-006", stage: "document_review", submitted: "2026-07-14", documents: { businessLicense: "pending", taxCertificate: "pending", exportLicense: "not_submitted", bankVerification: "pending", certifications: "not_submitted" } },
  { id: "VER-438", supplierId: "SUP-004", stage: "remote_factory_check", submitted: "2026-07-09", documents: { businessLicense: "approved", taxCertificate: "approved", exportLicense: "approved", bankVerification: "approved", certifications: "pending" } },
  { id: "VER-430", supplierId: "SUP-003", stage: "background_check", submitted: "2026-06-30", documents: { businessLicense: "approved", taxCertificate: "approved", exportLicense: "pending", bankVerification: "approved", certifications: "not_submitted" } },
];

export let buyerVerificationQueue = [
  { id: "BVER-118", name: "Volta Quarry Ltd", location: "Ho, Ghana", type: "Construction and industrial", submitted: "2026-07-11", status: "pending" },
  { id: "BVER-115", name: "Kumasi STEM Academy", location: "Kumasi, Ghana", type: "Education and NGO", submitted: "2026-07-06", status: "approved" },
  { id: "BVER-112", name: "Tema Auto Imports", location: "Tema, Ghana", type: "Retailer and importer", submitted: "2026-06-29", status: "approved" },
];

export const shipments = [
  { id: "SHP-770", orderId: "ORD-8842", stage: "shipping", carrier: "OceanLink Freight", origin: "Guangzhou, CN", destination: "Tema, GH", eta: "2026-08-02" },
  { id: "SHP-766", orderId: "ORD-8811", stage: "customs", carrier: "Pacific Star Logistics", origin: "Ningbo, CN", destination: "Tema, GH", eta: "2026-08-10" },
  { id: "SHP-761", orderId: "ORD-8776", stage: "customs", carrier: "Continental Cargo", origin: "Foshan, CN", destination: "Ho, GH", eta: "2026-07-25" },
  { id: "SHP-750", orderId: "ORD-8790", stage: "delivered", carrier: "SwiftHaul Africa", origin: "Yiwu, CN", destination: "Accra, GH", eta: "2026-06-30" },
];

export let auditLog = [
  { id: "LOG-9001", actor: "Kwame Asante (Admin)", action: "Approved supplier verification VER-425", time: "2026-07-17 14:22" },
  { id: "LOG-9000", actor: "System", action: "Escrow released for ORD-8790, $3,705 to SUP-004", time: "2026-06-30 09:03" },
  { id: "LOG-8998", actor: "Finance Admin", action: "Reviewed milestone payment for ORD-8776", time: "2026-07-01 11:47" },
  { id: "LOG-8991", actor: "Security system", action: "Flagged an unusual login for SUP-006 from a new device in Lagos", time: "2026-07-15 03:12" },
  { id: "LOG-8985", actor: "Kwame Asante (Admin)", action: "Opened dispute investigation DSP-221", time: "2026-07-12 16:40" },
];

export let messages = {
  "ORD-8842": [
    { from: "supplier", text: "Production is 80 percent complete, chairs are on schedule for next week.", time: "09:12" },
    { from: "buyer", text: "Great, please send inspection photos once ready.", time: "09:20" },
    { from: "supplier", text: "Will do. Inspection is booked for the 24th.", time: "09:22" },
  ],
  "ORD-8830": [
    { from: "supplier", text: "Panels have passed initial quality checks, packaging begins tomorrow.", time: "16:05" },
    { from: "buyer", text: "Thank you, please confirm the shipping date once available.", time: "16:40" },
  ],
};

export const categories = ["Electronics", "Automotive", "Construction", "Furniture", "Agriculture", "Energy", "Beauty", "Industrial"];

export const rolePermissions = [
  { role: "Founder / Owner", verification: true, payments: true, disputes: true, settings: true, support: true },
  { role: "Security administrator", verification: false, payments: false, disputes: false, settings: true, support: false },
  { role: "Finance administrator", verification: false, payments: true, disputes: false, settings: false, support: false },
  { role: "Verification team", verification: true, payments: false, disputes: false, settings: false, support: false },
  { role: "Customer support", verification: false, payments: false, disputes: true, settings: false, support: true },
  { role: "Technical team", verification: false, payments: false, disputes: false, settings: true, support: false },
];
