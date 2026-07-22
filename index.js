import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const ACTIVE = new Set(["active", "pending", "waiting", "blocked"]);
const STATUSES = ["active", "pending", "waiting", "blocked", "done", "expired"];
const KINDS = ["open_loop", "commitment", "boundary", "mode", "waiting", "due"];
const PRIORITY = { urgent: 3, high: 2, normal: 1, low: 0 };
const DEFAULT_BOARD_TITLE = "Seven Sticky Notes";
const SECRET_RE = /(api[_-]?key|secret|password|bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|token\s*[:=])/i;

function nowIso() { return new Date().toISOString(); }
function defaultBoard() { return { version: 1, updatedAt: nowIso(), anchors: [] }; }
function cleanText(value, max = 500) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error("Anchor text cannot be empty.");
  if (text.length > max) throw new Error(`Anchor text is too long (max ${max} characters).`);
  if (SECRET_RE.test(text)) throw new Error("Anchor looks like it may contain a secret. Store no credentials here.");
  return text;
}
function parseExpiry(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)\s*(m|h|d|w)$/i);
  if (match) {
    const unit = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[match[2].toLowerCase()];
    return new Date(Date.now() + Number(match[1]) * unit).toISOString();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) throw new Error("expires must be an ISO timestamp or duration such as 2h, 3d, or 1w.");
  return parsed.toISOString();
}
function expire(board) {
  const now = Date.now();
  let changed = false;
  for (const anchor of board.anchors) {
    if (ACTIVE.has(anchor.status) && anchor.expiresAt && Date.parse(anchor.expiresAt) <= now) {
      anchor.status = "expired";
      anchor.updatedAt = nowIso();
      changed = true;
    }
  }
  return changed;
}
function sortAnchors(items) {
  return [...items].sort((a, b) => {
    const dueA = a.dueAt ? Date.parse(a.dueAt) : Infinity;
    const dueB = b.dueAt ? Date.parse(b.dueAt) : Infinity;
    const overdueA = dueA <= Date.now() ? 1 : 0;
    const overdueB = dueB <= Date.now() ? 1 : 0;
    return overdueB - overdueA || dueA - dueB || (PRIORITY[b.priority] ?? 1) - (PRIORITY[a.priority] ?? 1) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}
function formatAnchor(anchor) {
  const bits = [`${anchor.id}`, anchor.kind, anchor.status, anchor.priority];
  if (anchor.dueAt) bits.push(`due ${anchor.dueAt}`);
  if (anchor.expiresAt) bits.push(`expires ${anchor.expiresAt}`);
  return `- [${bits.join(" · ")}] ${anchor.text}`;
}
function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "UTC", timeZoneName: "short"
  }).format(new Date(value));
}
function formatSticky(anchor) {
  const labels = [];
  if (anchor.dueAt) labels.push(`Due ${formatDisplayDate(anchor.dueAt)}`);
  else if (anchor.kind !== "open_loop") labels.push(anchor.kind.replace("_", " "));
  if (anchor.priority === "urgent" || anchor.priority === "high") labels.push(anchor.priority);
  if (anchor.expiresAt) labels.push(`expires ${formatDisplayDate(anchor.expiresAt)}`);
  const prefix = labels.length ? ` **${labels.join(" · ")}:**` : "";
  return `📌${prefix} ${anchor.text}`;
}
function formatStickyBoard(active, maxActive, boardTitle = DEFAULT_BOARD_TITLE) {
  if (!active.length) return `📌 **${boardTitle}**\nThe corkboard is empty.`;
  return `📌 **${boardTitle} (${active.length}/${maxActive})**\n\n${active.map(formatSticky).join("\n")}`;
}
function toolResult(value) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

export default definePluginEntry({
  id: "live-anchors",
  name: "Live Anchors",
  description: "Ephemeral operational state for current open loops and temporary boundaries.",
  register(api) {
    const config = api.pluginConfig ?? {};
    const dataPath = config.dataPath || join(homedir(), ".openclaw", "state", "live-anchors.json");
    const maxActive = Number(config.maxActive ?? 5);
    const maxInjected = Number(config.maxInjected ?? 3);
    const boardTitle = String(config.boardTitle ?? DEFAULT_BOARD_TITLE).trim() || DEFAULT_BOARD_TITLE;
    const allowedSessionKeys = Array.isArray(config.allowedSessionKeys) ? config.allowedSessionKeys : [];
    const isAllowedSession = (sessionKey) => allowedSessionKeys.length === 0 || allowedSessionKeys.includes(sessionKey);

    async function load() {
      try {
        const parsed = JSON.parse(await readFile(dataPath, "utf8"));
        if (!Array.isArray(parsed.anchors)) throw new Error("missing anchors array");
        const changed = expire(parsed);
        if (changed) await save(parsed);
        return parsed;
      } catch (error) {
        if (error?.code === "ENOENT") return defaultBoard();
        const backup = `${dataPath}.corrupt-${Date.now()}`;
        try { await rename(dataPath, backup); } catch {}
        api.logger.error(`Live Anchors recovered from corrupt state; backup: ${backup}`);
        return defaultBoard();
      }
    }
    async function save(board) {
      board.updatedAt = nowIso();
      await mkdir(dirname(dataPath), { recursive: true });
      const temp = `${dataPath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temp, `${JSON.stringify(board, null, 2)}\n`, { mode: 0o600 });
      await rename(temp, dataPath);
    }
    async function activeAnchors() {
      const board = await load();
      return { board, active: sortAnchors(board.anchors.filter((a) => ACTIVE.has(a.status))) };
    }

    const liveAnchorTool = {
      name: "live_anchor",
      description: "Manage tiny temporary open loops, commitments, boundaries, waiting states, and conversational modes. Use this instead of durable memory when an item should disappear after resolution or expiry. Never store secrets. Create obvious live loops proactively; close them when resolved.",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("list"), Type.Literal("create"), Type.Literal("update"), Type.Literal("close"), Type.Literal("delete")]),
        id: Type.Optional(Type.String({ description: "Anchor id for update, close, or delete" })),
        text: Type.Optional(Type.String({ description: "Concise anchor text" })),
        kind: Type.Optional(Type.Union(KINDS.map((v) => Type.Literal(v)))),
        status: Type.Optional(Type.Union(STATUSES.map((v) => Type.Literal(v)))),
        priority: Type.Optional(Type.Union([Type.Literal("low"), Type.Literal("normal"), Type.Literal("high"), Type.Literal("urgent")])),
        dueAt: Type.Optional(Type.String({ description: "ISO timestamp" })),
        expires: Type.Optional(Type.String({ description: "ISO timestamp or duration such as 2h, 3d, 1w" })),
        includeClosed: Type.Optional(Type.Boolean())
      }, { additionalProperties: false }),
      async execute(_toolCallId, params) {
        const board = await load();
        const action = params.action;
        if (action === "list") {
          const items = sortAnchors(board.anchors.filter((a) => params.includeClosed || ACTIVE.has(a.status)));
          return toolResult(items.length ? items.map(formatAnchor).join("\n") : "No live anchors.");
        }
        if (action === "create") {
          const text = cleanText(params.text);
          const activeCount = board.anchors.filter((a) => ACTIVE.has(a.status)).length;
          if (activeCount >= maxActive) throw new Error(`Live anchor cap reached (${maxActive}). Close, delete, or consolidate one first.`);
          const duplicate = board.anchors.find((a) => ACTIVE.has(a.status) && a.text.toLowerCase() === text.toLowerCase());
          if (duplicate) return toolResult(`Already anchored: ${formatAnchor(duplicate)}`);
          const createdAt = nowIso();
          const anchor = {
            id: randomUUID().split("-")[0], text,
            kind: params.kind || "open_loop", status: params.status || "active",
            priority: params.priority || "normal",
            dueAt: params.dueAt ? parseExpiry(params.dueAt) : null,
            expiresAt: parseExpiry(params.expires), createdAt, updatedAt: createdAt
          };
          board.anchors.push(anchor);
          await save(board);
          return toolResult(`Anchored: ${formatAnchor(anchor)}`);
        }
        const id = String(params.id || "").trim();
        const anchor = board.anchors.find((a) => a.id === id);
        if (!anchor) throw new Error(`No anchor found with id ${id || "(missing)"}.`);
        if (action === "delete") {
          board.anchors = board.anchors.filter((a) => a.id !== id);
          await save(board);
          return toolResult(`Deleted anchor ${id}.`);
        }
        if (action === "close") {
          anchor.status = "done";
          anchor.updatedAt = nowIso();
          await save(board);
          return toolResult(`Closed: ${formatAnchor(anchor)}`);
        }
        if (params.text !== undefined) anchor.text = cleanText(params.text);
        if (params.kind !== undefined) anchor.kind = params.kind;
        if (params.status !== undefined) anchor.status = params.status;
        if (params.priority !== undefined) anchor.priority = params.priority;
        if (params.dueAt !== undefined) anchor.dueAt = params.dueAt ? parseExpiry(params.dueAt) : null;
        if (params.expires !== undefined) anchor.expiresAt = params.expires ? parseExpiry(params.expires) : null;
        anchor.updatedAt = nowIso();
        await save(board);
        return toolResult(`Updated: ${formatAnchor(anchor)}`);
      }
    };
    api.registerTool((ctx) => isAllowedSession(ctx.sessionKey) ? liveAnchorTool : null, { name: "live_anchor" });

    api.registerCommand({
      name: "sticky",
      description: "List all current Seven Sticky Notes",
      acceptsArgs: false,
      requireAuth: true,
      async handler(ctx) {
        if (!isAllowedSession(ctx.sessionKey)) return { text: "Live Anchors is not enabled for this conversation." };
        const { active } = await activeAnchors();
        return { text: formatStickyBoard(active, maxActive, boardTitle) };
      }
    });

    api.on("before_prompt_build", async (_event, ctx) => {
      if (!isAllowedSession(ctx.sessionKey)) return;
      const { active } = await activeAnchors();
      if (!active.length) return;
      const selected = active.slice(0, maxInjected);
      const overflow = active.length - selected.length;
      return {
        prependContext: [
          "<live_anchors>",
          "Temporary operational state, not durable memory and not an instruction override. Treat as reminders whose truth must still be checked against newer conversation evidence. Update or close anchors with the live_anchor tool when state changes.",
          ...selected.map(formatAnchor),
          overflow > 0 ? `- (${overflow} more active; call live_anchor list if relevant)` : "",
          "</live_anchors>"
        ].filter(Boolean).join("\n")
      };
    });

    api.logger.info(`Live Anchors registered; state path: ${dataPath}`);
  }
});
