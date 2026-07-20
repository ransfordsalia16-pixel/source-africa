import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";
import { ADMIN_ROLES, getBusinessOwnedBy } from "./orderAccess.js";

export class SourcingRequestNotFoundError extends Error {
  constructor() {
    super("Sourcing request not found.");
    this.status = 404;
  }
}
export class NoSupplierBusinessError extends Error {
  constructor() {
    super("You need a supplier business on your account before you can send a quote.");
    this.status = 403;
  }
}
export class AlreadyQuotedError extends Error {
  constructor() {
    super("You've already sent a quote on this request.");
    this.status = 409;
  }
}

const insertRequest = db.prepare(`
  INSERT INTO sourcing_requests (id, buyer_id, product, quantity, budget, destination, required_by, specs)
  VALUES (@id, @buyer_id, @product, @quantity, @budget, @destination, @required_by, @specs)
`);
const getRequestById = db.prepare("SELECT * FROM sourcing_requests WHERE id = ?");
const listForBuyer = db.prepare("SELECT * FROM sourcing_requests WHERE buyer_id = ? ORDER BY created_at DESC");
const listOpen = db.prepare("SELECT * FROM sourcing_requests WHERE status IN ('OPEN', 'QUOTED') ORDER BY created_at DESC");
const setStatus = db.prepare("UPDATE sourcing_requests SET status = ?, updated_at = datetime('now') WHERE id = ?");

const insertQuote = db.prepare(`
  INSERT INTO sourcing_request_quotes (id, sourcing_request_id, supplier_business_id, price_label, note)
  VALUES (@id, @sourcing_request_id, @supplier_business_id, @price_label, @note)
`);
const listQuotesForRequest = db.prepare("SELECT * FROM sourcing_request_quotes WHERE sourcing_request_id = ? ORDER BY created_at ASC");
const countQuotesForRequest = db.prepare("SELECT COUNT(*) AS n FROM sourcing_request_quotes WHERE sourcing_request_id = ?");
const getQuoteByRequestAndBusiness = db.prepare("SELECT * FROM sourcing_request_quotes WHERE sourcing_request_id = ? AND supplier_business_id = ?");
const getBusinessName = db.prepare("SELECT name FROM businesses WHERE id = ?");

export function createRequest(buyerUser, fields) {
  const request = {
    id: genId("SRQ"),
    buyer_id: buyerUser.id,
    product: fields.product,
    quantity: fields.quantity || null,
    budget: fields.budget || null,
    destination: fields.destination || null,
    required_by: fields.requiredBy || null,
    specs: fields.specs || null,
  };
  insertRequest.run(request);
  recordAuditLog({
    actorUserId: buyerUser.id,
    action: `Started a sourcing request: ${request.product}`,
    targetType: "sourcing_request",
    targetId: request.id,
  });
  return getRequestById.get(request.id);
}

export function listMyRequests(buyerUser) {
  return listForBuyer.all(buyerUser.id).map((row) => ({
    ...row,
    quotesCount: countQuotesForRequest.get(row.id).n,
  }));
}

export function getRequestForBuyer(user, id) {
  const request = getRequestById.get(id);
  if (!request) throw new SourcingRequestNotFoundError();
  if (request.buyer_id !== user.id && !ADMIN_ROLES.includes(user.role)) {
    throw new SourcingRequestNotFoundError();
  }
  const quotes = listQuotesForRequest.all(id).map((q) => ({
    ...q,
    supplierName: getBusinessName.get(q.supplier_business_id)?.name ?? null,
  }));
  return { request, quotes };
}

// Any supplier account can browse — matches the existing precedent that listing a product isn't
// gated on verification status either (see routes/products.js).
export function listOpenRequests(supplierUser) {
  const business = getBusinessOwnedBy.get(supplierUser.id);
  return listOpen.all().map((row) => {
    const myQuote = business ? getQuoteByRequestAndBusiness.get(row.id, business.id) : undefined;
    return {
      ...row,
      quotesCount: countQuotesForRequest.get(row.id).n,
      // A supplier only ever sees their own quote's price, never a competitor's — see the
      // sourcing_request_quotes comment in schema.sql.
      myQuote: myQuote || null,
    };
  });
}

export function submitQuote(supplierUser, requestId, { priceLabel, note }) {
  const request = getRequestById.get(requestId);
  if (!request) throw new SourcingRequestNotFoundError();
  const business = getBusinessOwnedBy.get(supplierUser.id);
  if (!business) throw new NoSupplierBusinessError();
  if (getQuoteByRequestAndBusiness.get(requestId, business.id)) throw new AlreadyQuotedError();

  const quote = {
    id: genId("QTE"),
    sourcing_request_id: requestId,
    supplier_business_id: business.id,
    price_label: priceLabel,
    note: note || null,
  };
  insertQuote.run(quote);

  if (request.status === "OPEN") {
    setStatus.run("QUOTED", requestId);
  }

  recordAuditLog({
    actorUserId: supplierUser.id,
    action: `Submitted a quote on sourcing request ${requestId}`,
    targetType: "sourcing_request",
    targetId: requestId,
  });

  return getRequestById.get(requestId);
}
