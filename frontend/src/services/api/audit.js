// STAGE 1: still mocked for the admin-facing views (Security page, verification actions).
// The real audit_logs table exists on the backend and is genuinely written to by every order
// state transition and every login — see sourcebridge-server/src/audit/log.js — this file is
// just a separate, still-mock trail for the parts of the UI that haven't moved yet.
import { delay } from "./client.js";
import * as db from "../mock/data.js";

export async function getAuditLog() {
  return delay([...db.auditLog]);
}

export async function logAction(actor, action) {
  const entry = {
    id: `LOG-${Math.floor(Math.random() * 9000 + 1000)}`,
    actor,
    action,
    time: "just now",
  };
  db.auditLog.unshift(entry);
  return delay(entry);
}

export async function getRolePermissions() {
  return delay([...db.rolePermissions]);
}
