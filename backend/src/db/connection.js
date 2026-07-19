import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Resolved relative to this file, not process.cwd() — the app is sometimes launched as
// `node <full path>/src/index.js` from a different working directory, which would otherwise
// silently miss .env and write the database to the wrong place.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(projectRoot, ".env") });

const configuredPath = process.env.DATABASE_PATH || "./data/sourcebridge.sqlite";
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.join(projectRoot, configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");
