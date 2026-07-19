import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { canAccessOrder, resolveSupplierBusiness, getOrderRow, getBusinessById } from "./orderAccess.js";

export class OrderAccessDeniedError extends Error {
  constructor() {
    super("Order not found.");
    this.status = 404;
  }
}
export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found.");
    this.status = 404;
  }
}
export class NotAParticipantError extends Error {
  constructor() {
    super("You are not part of this conversation.");
    this.status = 404;
  }
}

const getConversationByOrder = db.prepare("SELECT * FROM conversations WHERE order_id = ?");
const getConversationById = db.prepare("SELECT * FROM conversations WHERE id = ?");
const insertConversation = db.prepare("INSERT INTO conversations (id, order_id) VALUES (?, ?)");
const insertParticipant = db.prepare(
  "INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)"
);
const getParticipant = db.prepare(
  "SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?"
);
const setHidden = db.prepare(
  "UPDATE conversation_participants SET hidden_at = datetime('now') WHERE conversation_id = ? AND user_id = ?"
);
const setUnhidden = db.prepare(
  "UPDATE conversation_participants SET hidden_at = NULL WHERE conversation_id = ? AND user_id = ?"
);

const listForUser = db.prepare(`
  SELECT c.id AS conversationId, c.order_id AS orderId, c.created_at AS createdAt
  FROM conversations c
  JOIN conversation_participants cp ON cp.conversation_id = c.id
  WHERE cp.user_id = ? AND cp.hidden_at IS NULL
  ORDER BY c.created_at DESC
`);

const getMessagesStmt = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC");
const insertMessage = db.prepare(`
  INSERT INTO messages (id, conversation_id, sender_id, body, related_order_id)
  VALUES (@id, @conversation_id, @sender_id, @body, @related_order_id)
`);

// The order this conversation belongs to determines who is allowed to be in it: the buyer, and
// whoever owns the supplier business (if that business has a login at all — several seeded
// suppliers don't, same as in the real world before every factory has signed up). Creating a
// conversation and adding participants both reuse the exact same order access check every other
// order-scoped endpoint uses, so nobody who couldn't see the order can see its messages.
export function getOrCreateConversationForOrder(orderId, user) {
  const order = getOrderRow.get(orderId);
  if (!order) throw new OrderAccessDeniedError();
  const supplierBusiness = resolveSupplierBusiness(user, order);
  if (!canAccessOrder(user, order, supplierBusiness)) throw new OrderAccessDeniedError();

  let conversation = getConversationByOrder.get(orderId);
  if (!conversation) {
    const id = genId("CONV");
    insertConversation.run(id, orderId);
    conversation = getConversationById.get(id);
  }

  insertParticipant.run(conversation.id, order.buyer_id);
  const supplierBusinessRecord = getBusinessById.get(order.supplier_business_id);
  if (supplierBusinessRecord?.owner_user_id) {
    insertParticipant.run(conversation.id, supplierBusinessRecord.owner_user_id);
  }

  return conversation;
}

export function listConversationsForUser(userId) {
  return listForUser.all(userId);
}

export function getConversation(id) {
  return getConversationById.get(id);
}

// Metadata only, across every conversation. Deliberately does not return message bodies —
// browsing which conversations exist is lower sensitivity than reading their contents, so this
// one isn't behind the reason-and-audit-log gate the full read is.
const listAllForAdmin = db.prepare(`
  SELECT c.id AS conversationId, c.order_id AS orderId, c.created_at AS createdAt, o.product_summary AS productSummary
  FROM conversations c
  JOIN orders o ON o.id = c.order_id
  ORDER BY c.created_at DESC
`);
export function listAllConversations() {
  return listAllForAdmin.all();
}

export function requireParticipant(conversationId, userId) {
  const conversation = getConversationById.get(conversationId);
  if (!conversation) throw new ConversationNotFoundError();
  const participant = getParticipant.get(conversationId, userId);
  if (!participant) throw new NotAParticipantError();
  return conversation;
}

export function getMessages(conversationId) {
  return getMessagesStmt.all(conversationId);
}

export function sendMessage(conversationId, senderId, body, relatedOrderId) {
  const message = {
    id: genId("MSG"),
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    related_order_id: relatedOrderId || null,
  };
  insertMessage.run(message);
  return message;
}

// Hides the conversation from this user's own inbox only. The conversation row, every message
// in it, and the other participant's ability to see it are all untouched — this is exactly the
// "hide, don't destroy" retention rule from the spec.
export function hideForUser(conversationId, userId) {
  setHidden.run(conversationId, userId);
}
export function unhideForUser(conversationId, userId) {
  setUnhidden.run(conversationId, userId);
}
