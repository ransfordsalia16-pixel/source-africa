import { Router } from "express";
import { z } from "zod";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import {
  applyTransition,
  toUiStage,
  derivePaymentStatus,
  InvalidTransitionError,
  ForbiddenTransitionError,
  OrderNotFoundError,
} from "../domain/orderStateMachine.js";
import { ADMIN_ROLES, canAccessOrder, resolveSupplierBusiness, getOrderRow, getBusinessOwnedBy } from "../domain/orderAccess.js";
import { createOrder, SupplierNotFoundError, SupplierNotVerifiedError } from "../domain/orders.js";

const router = Router();

const getOrdersForBuyer = db.prepare("SELECT * FROM orders WHERE buyer_id = ? ORDER BY updated_at DESC");
const getOrdersForSupplierBusiness = db.prepare("SELECT * FROM orders WHERE supplier_business_id = ? ORDER BY updated_at DESC");
const getAllOrders = db.prepare("SELECT * FROM orders ORDER BY updated_at DESC");
const getBuyerName = db.prepare("SELECT name FROM users WHERE id = ?");
const getSupplierName = db.prepare("SELECT name FROM businesses WHERE id = ?");

function serializeOrder(row) {
  return {
    id: row.id,
    product: row.product_summary,
    buyerId: row.buyer_id,
    buyerName: getBuyerName.get(row.buyer_id)?.name ?? null,
    supplierId: row.supplier_business_id,
    supplierName: getSupplierName.get(row.supplier_business_id)?.name ?? null,
    value: row.value_cents / 100,
    currency: row.currency,
    state: row.state,
    protectionModel: row.protection_model,
    stage: toUiStage(row.state),
    paymentStatus: derivePaymentStatus(row.state),
    eta: row.eta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", requireAuth, (req, res) => {
  let rows;
  if (req.user.role === "buyer") {
    rows = getOrdersForBuyer.all(req.user.id);
  } else if (req.user.role === "supplier") {
    const business = getBusinessOwnedBy.get(req.user.id);
    rows = business ? getOrdersForSupplierBusiness.all(business.id) : [];
  } else if (ADMIN_ROLES.includes(req.user.role)) {
    rows = getAllOrders.all();
  } else {
    rows = [];
  }
  res.json(rows.map(serializeOrder));
});

router.get("/:id", requireAuth, (req, res) => {
  const order = getOrderRow.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const supplierBusiness = resolveSupplierBusiness(req.user, order);
  if (!canAccessOrder(req.user, order, supplierBusiness)) {
    // 404, not 403: confirming an order id exists for someone who has no business seeing it
    // is itself an information leak (this is the IDOR protection).
    return res.status(404).json({ error: "Order not found." });
  }
  res.json(serializeOrder(order));
});

const createOrderSchema = z.object({
  supplierBusinessId: z.string().trim().min(1, "A supplier is required."),
  productSummary: z.string().trim().min(1, "A product summary is required."),
  valueCents: z.coerce.number().int().positive("Order value must be a positive amount."),
  currency: z.string().trim().length(3).default("USD"),
});

router.post("/", requireAuth, (req, res) => {
  if (req.user.role !== "buyer") {
    return res.status(403).json({ error: "Only a buyer can create an order." });
  }
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid order details." });

  try {
    const order = createOrder(req.user, parsed.data);
    res.status(201).json(serializeOrder(order));
  } catch (err) {
    if (err instanceof SupplierNotFoundError || err instanceof SupplierNotVerifiedError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

const transitionSchema = z.object({
  toState: z.string().min(1),
  reason: z.string().optional(),
});

router.post("/:id/transition", requireAuth, (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "toState is required." });

  const order = getOrderRow.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const supplierBusiness = resolveSupplierBusiness(req.user, order);
  if (!canAccessOrder(req.user, order, supplierBusiness)) {
    return res.status(404).json({ error: "Order not found." });
  }

  try {
    const updated = applyTransition(order.id, parsed.data.toState, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      reason: parsed.data.reason,
    });
    res.json(serializeOrder(updated));
  } catch (err) {
    if (err instanceof InvalidTransitionError || err instanceof ForbiddenTransitionError || err instanceof OrderNotFoundError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
