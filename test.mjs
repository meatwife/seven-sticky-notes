import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "./index.js";

const dir = await mkdtemp(join(tmpdir(), "live-anchors-"));
const captured = {};
const api = {
  pluginConfig: { dataPath: join(dir, "anchors.json"), boardTitle: "Household Corkboard", maxActive: 2, maxInjected: 1, allowedSessionKeys: ["allowed"] },
  logger: { info() {}, error() {} },
  registerTool(tool) {
    captured.toolFactory = tool;
    captured.tool = typeof tool === "function" ? tool({ sessionKey: "allowed" }) : tool;
  },
  registerCommand(command) { captured.command = command; },
  on(name, handler) { captured[name] = handler; }
};
plugin.register(api);
assert(captured.tool && captured.before_prompt_build && captured.command);

const exec = (params) => captured.tool.execute("test", params);
await exec({ action: "create", text: "Start a new session before bed", kind: "commitment", priority: "high", expires: "1d" });
await exec({ action: "create", text: "Copy DM archive into Obsidian", kind: "open_loop", priority: "normal" });
const listed = await exec({ action: "list" });
assert.match(listed.content[0].text, /new session before bed/);
assert.match(listed.content[0].text, /DM archive/);
await assert.rejects(() => exec({ action: "create", text: "Third active item" }), /cap reached/);
await assert.rejects(() => exec({ action: "create", text: "password: hunter2" }), /secret/);

assert.equal(captured.toolFactory({ sessionKey: "forbidden" }), null);
const prompt = await captured.before_prompt_build({}, { sessionKey: "allowed" });
assert.match(prompt.prependContext, /Temporary operational state/);
assert.match(prompt.prependContext, /new session before bed/);
assert.match(prompt.prependContext, /1 more active/);

const board = JSON.parse(await readFile(join(dir, "anchors.json"), "utf8"));
await exec({ action: "close", id: board.anchors[0].id });
const hidden = await captured.before_prompt_build({}, { sessionKey: "forbidden" });
assert.equal(hidden, undefined);
const command = await captured.command.handler({ sessionKey: "allowed" });
assert.doesNotMatch(command.text, /new session before bed/);
assert.match(command.text, /DM archive/);
assert.match(command.text, /Household Corkboard \(1\/2\)/);
console.log("PASS: create, list, cap, secret guard, injection, close, atomic persistence");

const defaultCaptured = {};
plugin.register({
  pluginConfig: { dataPath: join(dir, "default-anchors.json") },
  logger: { info() {}, error() {} },
  registerTool() {},
  registerCommand(command) { defaultCaptured.command = command; },
  on() {}
});
const defaultCommand = await defaultCaptured.command.handler({ sessionKey: "any" });
assert.match(defaultCommand.text, /📌 \*\*Seven Sticky Notes\*\*/);
assert.match(defaultCommand.text, /corkboard is empty/);
console.log("PASS: configurable and default board titles");
