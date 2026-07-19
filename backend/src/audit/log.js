import { db } from "../db/connection.js";
import { genId } from "../util/id.js";

const insert = db.prepare(`
  INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, reason, case_reference)
  VALUES (@id, @actor_user_id, @action, @target_type, @target_id, @reason, @case_reference)
`);

// The one place that writes to audit_logs. Every sensitive action funnels through here so the
// log can't be forgotten in one code path and remembered in another.
export function recordAuditLog({ actorUserId = null, action, targetType = null, targetId = null, reason = null, caseReference = null }) {
  insert.run({
    id: genId("LOG"),
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason,
    case_reference: caseReference,
  });
}
