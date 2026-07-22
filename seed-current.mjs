import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const path = "/home/ubuntu/.openclaw/state/live-anchors.json";
const now = new Date().toISOString();
const tomorrow = new Date(Date.now() + 24 * 3600e3).toISOString();
const rows = [
  { text: "Before bedtime tonight, complete the planned /new session handoff and verify Live Anchors survives the reset.", kind: "commitment", priority: "high", expiresAt: tomorrow },
  { text: "Copy monthly Markdown files from /home/ubuntu/.openclaw/dm-archive/ into the encrypted Obsidian vault transcripts area; do not copy export_dm.py.", kind: "open_loop", priority: "high", expiresAt: null },
  { text: "Archive curation remains open: inspect timestamps, rename raw ChatGPT threads safely, check thread 12 duplication, and generate a verified manifest plus filename map.", kind: "open_loop", priority: "normal", expiresAt: null },
  { text: "Waiting on Sunny for remaining thread exports and thread-summary files before final archive organization.", kind: "waiting", priority: "normal", expiresAt: null }
];
const anchors = rows.map((row) => ({ id: randomUUID().split("-")[0], text: row.text, kind: row.kind, status: row.kind === "waiting" ? "waiting" : "active", priority: row.priority, dueAt: null, expiresAt: row.expiresAt, createdAt: now, updatedAt: now }));
await mkdir(dirname(path), { recursive: true });
await writeFile(path, `${JSON.stringify({ version: 1, updatedAt: now, anchors }, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ path, count: anchors.length, ids: anchors.map((a) => a.id) }, null, 2));
