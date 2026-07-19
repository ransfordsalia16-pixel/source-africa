import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import {
  createRequest,
  listMyRequests,
  getRequestForBuyer,
  listOpenRequests,
  submitQuote,
  SourcingRequestNotFoundError,
  NoSupplierBusinessError,
  AlreadyQuotedError,
} from "../domain/sourcingRequests.js";

const router = Router();

function handleDomainError(err, res) {
  if (
    err instanceof SourcingRequestNotFoundError ||
    err instanceof NoSupplierBusinessError ||
    err instanceof AlreadyQuotedError
  ) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

function serializeRequest(row) {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    product: row.product,
    quantity: row.quantity,
    budget: row.budget,
    destination: row.destination,
    requiredBy: row.required_by,
    specs: row.specs,
    status: row.status,
    quotesCount: row.quotesCount,
    myQuote: row.myQuote ? serializeQuote(row.myQuote) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function serializeQuote(row) {
  return {
    id: row.id,
    sourcingRequestId: row.sourcing_request_id,
    supplierBusinessId: row.supplier_business_id,
    supplierName: row.supplierName,
    priceLabel: row.price_label,
    note: row.note,
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  product: z.string().trim().min(1, "Tell us what you're looking for."),
  quantity: z.string().trim().optional(),
  budget: z.string().trim().optional(),
  destination: z.string().trim().optional(),
  requiredBy: z.string().trim().optional(),
  specs: z.string().trim().optional(),
});

router.post("/sourcing-requests", requireAuth, requireRole("buyer"), (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request details." });
  const request = createRequest(req.user, parsed.data);
  res.status(201).json(serializeRequest(request));
});

router.get("/sourcing-requests/mine", requireAuth, requireRole("buyer"), (req, res) => {
  res.json(listMyRequests(req.user).map(serializeRequest));
});

router.get("/sourcing-requests/open", requireAuth, requireRole("supplier"), (req, res) => {
  res.json(listOpenRequests(req.user).map(serializeRequest));
});

router.get("/sourcing-requests/:id", requireAuth, (req, res) => {
  try {
    const { request, quotes } = getRequestForBuyer(req.user, req.params.id);
    res.json({ ...serializeRequest(request), quotes: quotes.map(serializeQuote) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const quoteSchema = z.object({
  priceLabel: z.string().trim().min(1, "A price is required."),
  note: z.string().trim().optional(),
});

router.post("/sourcing-requests/:id/quotes", requireAuth, requireRole("supplier"), (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid quote details." });
  try {
    const request = submitQuote(req.user, req.params.id, parsed.data);
    res.status(201).json(serializeRequest(request));
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
