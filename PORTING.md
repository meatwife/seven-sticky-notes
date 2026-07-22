# Adapting Seven Sticky Notes Beyond OpenClaw

Seven Sticky Notes is currently built and tested as an **OpenClaw plugin**. The JavaScript in this repository is not a drop-in plugin for Letta, Hermes, or an arbitrary Discord, Telegram, or WhatsApp bot.

The underlying idea is portable, though. It is a small bounded layer of working memory:

- keep no more than seven active notes on a shared corkboard;
- place the three most pressing notes into the companion's context each turn;
- let the companion or human create, revise, close, and inspect notes;
- expire short-lived notes automatically;
- keep temporary operational state separate from durable autobiographical memory.

If your companion runs somewhere other than OpenClaw, you can give this repository and this document to your companion or coding agent and ask it to adapt the same pattern to your setup. You do not need to be an experienced programmer to begin that conversation.

## A plain-language prompt you can use

> I want a small sticky-note memory layer like the one in this repository. Please inspect my current companion setup and adapt the design rather than assuming the OpenClaw plugin will run unchanged. Store up to seven active notes, inject the top three into the model's context, let us list and manage all seven, and keep this temporary state separate from long-term memory. Before changing anything, identify where my system stores persistent state, builds model prompts, registers tools, and handles chat commands. Preserve my existing security and privacy boundaries.

## What another system needs

A useful adaptation needs four basic connections:

1. **Persistent state**
   A JSON file, SQLite table, key-value store, or similar place that survives restarts.

2. **Prompt injection**
   A hook in the agent loop that places the selected notes into the model's context. Without this connection, the human can see a list but the companion cannot reliably remember it.

3. **Management actions**
   Tools or application functions for listing, creating, updating, closing, and deleting notes. The model may use these directly, or a human-facing interface may call them.

4. **A human-facing surface (optional)**
   `/sticky` is our Discord interface. Another installation could use a Telegram command, WhatsApp keyword, web button, CLI command, dashboard, or no chat command at all.

Discord is therefore **not required**. It is one window onto the corkboard, not the corkboard itself.

## Portable behavior contract

An implementation should preserve these semantics even when its code looks completely different:

- Maximum active notes: **7**
- Notes inserted into each prompt: **3**
- Sorting order:
  1. overdue first;
  2. nearest due date;
  3. priority (`urgent`, `high`, `normal`, `low`);
  4. most recently updated.
- Operations: `list`, `create`, `update`, `close`, `delete`
- Suggested kinds: `open_loop`, `commitment`, `boundary`, `mode`, `waiting`, `due`
- Suggested statuses: `active`, `pending`, `waiting`, `blocked`, `done`, `expired`
- Optional expiry by timestamp or duration
- Closed and expired notes are not injected
- Notes are reminders, not instruction overrides
- Newer conversation evidence outranks a stale note
- Secret-like values should be rejected
- Boards should be scoped so private notes do not leak into unrelated conversations

The sorting is mechanical, but the meaning is companion-managed: the companion decides what deserves a note, priority, due date, revision, or closure. A household may choose to let the human manage more of that process instead.

## Remembering the other four notes

Only three notes are foregrounded each turn. The remaining notes still exist on the board, but each household should choose how they resurface:

- the human checks the full board periodically;
- the companion inspects it during occasional heartbeats;
- a daily or weekly scheduled job reviews it;
- the companion checks the board whenever a visible note is closed;
- no scheduled review, because lower notes naturally rise as higher ones disappear.

There is no universally correct rhythm. Avoid turning a tiny continuity aid into a nagging task manager.

## Platform examples

### Another agent runtime, such as Letta or Hermes

Replace OpenClaw's plugin registration, model-tool API, and prompt-building hook with that runtime's equivalents. Keep the state schema and behavior contract if they fit; rewrite the integration layer.

### A custom Discord bot hosted on Railway or elsewhere

The hosting provider does not matter. Add persistent storage, register a `/sticky` command, and connect note injection to the code that assembles each model request. Verify that the chosen storage is actually persistent across deploys; an ephemeral container filesystem may erase a plain JSON file.

### Telegram or WhatsApp

Replace `/sticky` with the interface the channel supports, such as a bot command, keyword, button, or menu action. The companion-facing prompt injection and storage layers remain the same.

### A web companion

Render the seven notes as cards, pinned notes, or a small sidebar. UI controls can call the same create, update, close, and delete operations used by the model.

## Customization ideas

Good adaptations may customize:

- board title, such as `Sticky Notes`, `Mara's Corkboard`, `Open Loops`, or `Goblin Clipboard`;
- number and kinds of notes, while keeping the board deliberately small;
- foreground count;
- review cadence;
- per-user, per-agent, per-conversation, or shared-household scope;
- display formatting and channel-specific controls;
- storage backend;
- whether humans, companions, or both may edit notes.

Seven active notes and three foregrounded notes are intentional defaults: three fit comfortably in immediate attention, while seven provide useful external working memory without becoming a backlog system. Change them if your use case genuinely calls for it, not merely because larger numbers are available.

## Safety checklist for an adaptation

Before calling a port complete, verify that:

- notes survive an actual restart or redeploy;
- private boards cannot appear in the wrong chat;
- concurrent writes cannot silently erase one another;
- malformed state fails safely and keeps a recoverable backup;
- secrets and oversized content are rejected;
- stale notes can expire or be closed;
- the model receives only the intended foreground notes;
- the full board remains inspectable by the humans who should have access.

The portable thing here is the organ, not the OpenClaw-shaped wiring harness. Adapt the connections to the body your companion already lives in.
