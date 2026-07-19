import { Router } from "express";
import { z } from "zod";
import {
  getOrCreateConversationForOrder,
  listConversationsForUser,
  requireParticipant,
  getMessages,
  sendMessage,
  hideForUser,
  unhideForUser,
  getConversation,
  listAllConversations,
  OrderAccessDeniedError,
  ConversationNotFoundError,
  NotAParticipantError,
} from "../domain/conversations.js";
import { getOrderRow, ADMIN_ROLES } from "../domain/orderAccess.js";
import { caseGrantsConversationAccess } from "../domain/cases.js";
import { requireAuth } from "../middleware/auth.js";
import { recordAuditLog } from "../audit/log.js";

const router = Router();

function handleDomainError(err, res) {
  if (err instanceof OrderAccessDeniedError || err instanceof ConversationNotFoundError || err instanceof NotAParticipantError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

// Sender is always either the order's buyer or the owning side of its supplier business, so
// "buyer" / "supplier" can be derived from the order instead of needing a join to users on
// every message.
function serializeMessage(row, order) {
  return {
    id: row.id,
    from: row.sender_id === order.buyer_id ? "buyer" : "supplier",
    text: row.body,
    time: row.created_at,
  };
}

router.get("/conversations", requireAuth, (req, res) => {
  res.json(listConversationsForUser(req.user.id));
});

router.get("/orders/:id/conversation", requireAuth, (req, res) => {
  try {
    const conversation = getOrCreateConversationForOrder(req.params.id, req.user);
    const order = getOrderRow.get(req.params.id);
    const messages = getMessages(conversation.id).map((m) => serializeMessage(m, order));
    res.json({ conversationId: conversation.id, orderId: req.params.id, messages });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const sendSchema = z.object({ text: z.string().min(1) });

router.post("/orders/:id/conversation/messages", requireAuth, (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message text is required." });

  try {
    const conversation = getOrCreateConversationForOrder(req.params.id, req.user);
    const order = getOrderRow.get(req.params.id);
    const message = sendMessage(conversation.id, req.user.id, parsed.data.text, req.params.id);
    // Replying to a conversation you'd previously hidden brings it back into your own inbox —
    // otherwise you could message someone and then be unable to find your own sent message.
    unhideForUser(conversation.id, req.user.id);
    res.status(201).json(serializeMessage(message, order));
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/conversations/:id/hide", requireAuth, (req, res) => {
  try {
    requireParticipant(req.params.id, req.user.id);
    hideForUser(req.params.id, req.user.id);
    res.json({ hidden: true });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/conversations/:id/unhide", requireAuth, (req, res) => {
  try {
    requireParticipant(req.params.id, req.user.id);
    unhideForUser(req.params.id, req.user.id);
    res.json({ hidden: false });
  } catch (err) {
    handleDomainError(err, res);
  }
});

// Convenience wrappers so the frontend, which only ever tracks an orderId, doesn't need to
// separately look up a conversationId just to hide or unhide it.
router.post("/orders/:id/conversation/hide", requireAuth, (req, res) => {
  try {
    const conversation = getOrCreateConversationForOrder(req.params.id, req.user);
    hideForUser(conversation.id, req.user.id);
    res.json({ hidden: true });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/orders/:id/conversation/unhide", requireAuth, (req, res) => {
  try {
    const conversation = getOrCreateConversationForOrder(req.params.id, req.user);
    unhideForUser(conversation.id, req.user.id);
    res.json({ hidden: false });
  } catch (err) {
    handleDomainError(err, res);
  }
});

function requireAdminRole(req, res, next) {
  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "Your role does not have access to conversation records." });
  }
  next();
}

router.get("/admin/conversations", requireAuth, requireAdminRole, (_req, res) => {
  res.json(listAllConversations());
});

// The one endpoint in the app that reads private message content on someone else's behalf.
// Stage 2 originally gated this on any non-blank "reason" string. Stage 5 tightens it: the
// caller now has to name a real support case, that case has to be linked to this exact order,
// and it has to be assigned to them (or they're super_admin) — "access only to conversations
// relevant to assigned or authorized support cases," enforced here rather than just logged.
router.get("/admin/conversations/:id", requireAuth, requireAdminRole, (req, res) => {
  const caseId = typeof req.query.caseId === "string" ? req.query.caseId.trim() : "";
  if (!caseId) {
    return res.status(400).json({ error: "A case is required to view a conversation's messages." });
  }

  const conversation = getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });

  if (!caseGrantsConversationAccess(caseId, req.user, conversation.order_id)) {
    return res.status(404).json({ error: "That case doesn't give you access to this conversation. Take the case first, or use one already assigned to you for this order." });
  }

  const order = getOrderRow.get(conversation.order_id);
  const messages = getMessages(conversation.id).map((m) => serializeMessage(m, order));

  recordAuditLog({
    actorUserId: req.user.id,
    action: `Viewed conversation ${conversation.id} for order ${conversation.order_id}`,
    targetType: "conversation",
    targetId: conversation.id,
    caseReference: caseId,
  });

  res.json({ conversationId: conversation.id, orderId: conversation.order_id, messages });
});

export default router;
