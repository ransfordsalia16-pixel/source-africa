import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  createProduct,
  updateProduct,
  listMyProducts,
  listPublicProducts,
  getPublicProductById,
  ProductNotFoundError,
  NotAVerifiedSupplierError,
} from "../domain/products.js";

const router = Router();

function handleDomainError(err, res) {
  if (err instanceof ProductNotFoundError || err instanceof NotAVerifiedSupplierError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

function serializeProduct(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    category: row.category,
    priceLabel: row.price_label,
    moq: row.moq,
    productionTime: row.production_time,
    views: row.views,
    inquiries: row.inquiries,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Only present on the joined public-listing queries; undefined (omitted from JSON) on
    // plain product rows from listMyProducts/createProduct/updateProduct.
    business: row.business_name
      ? { name: row.business_name, location: row.business_location, trustLevel: row.business_trust_level, trustScore: row.business_trust_score }
      : undefined,
  };
}

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required."),
  category: z.string().trim().optional(),
  priceLabel: z.string().trim().optional(),
  moq: z.string().trim().optional(),
  productionTime: z.string().trim().optional(),
});

router.get("/products", requireAuth, (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  res.json(listPublicProducts({ category }).map(serializeProduct));
});

router.get("/products/mine", requireAuth, (req, res) => {
  res.json(listMyProducts(req.user).map(serializeProduct));
});

router.get("/products/:id", requireAuth, (req, res) => {
  try {
    res.json(serializeProduct(getPublicProductById(req.params.id)));
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/products/mine", requireAuth, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid product details." });

  const { priceLabel, productionTime, ...rest } = parsed.data;
  try {
    const product = createProduct(req.user, { ...rest, price_label: priceLabel, production_time: productionTime });
    res.status(201).json(serializeProduct(product));
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.patch("/products/mine/:id", requireAuth, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid product details." });

  const { priceLabel, productionTime, ...rest } = parsed.data;
  try {
    const product = updateProduct(req.user, req.params.id, { ...rest, price_label: priceLabel, production_time: productionTime });
    res.json(serializeProduct(product));
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
