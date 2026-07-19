import { randomUUID } from "node:crypto";

export function genId(prefix) {
  return `${prefix}-${randomUUID().split("-")[0]}`;
}
