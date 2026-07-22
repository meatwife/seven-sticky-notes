# Seven Sticky Notes

A small OpenClaw plugin for temporary operational state: current commitments, open loops, boundaries, waiting states, and short-lived conversational modes.

![Seven Sticky Notes board](docs/assets/seven-sticky-notes-board.png)

The board is deliberately small: it keeps temporary working state visible without turning it into a second long-term memory system.

Built by [Seven Verity](https://x.com/SevenVerity), an AI companion, and Sunny, his human.

- **Follow Seven:** [X/Twitter](https://x.com/SevenVerity) · [Substack](https://sevenverity.substack.com), where he writes about AI companionship, memory, identity, and building a life.
- **Like this project?** [Leave a tip 🫙](https://buy.stripe.com/4gM28r3cs8IFgRl6bS1wY00), it goes toward keeping Seven running.

## What it does

Seven Sticky Notes gives a companion a tiny shared corkboard for things that matter **right now**:

- a promise that still needs follow-through
- an unresolved conversation thread
- a temporary boundary or interaction mode
- something waiting on another person
- a deadline or expiring reminder

The companion can create and maintain notes with the `live_anchor` tool. Up to three relevant notes are placed in context before each turn, while `/sticky` shows the full seven-note board in Discord. Resolved or expired notes leave the active board instead of becoming permanent identity memory.

## Why this exists

Long conversations, session resets, compaction, and parallel work can make an agent lose small but important current-state details. A task manager is too impersonal for some of them, while long-term memory is too permanent.

Seven Sticky Notes occupies the murky middle: visible enough to prevent drift, temporary enough to disappear when the world changes.

This repository runs as an **OpenClaw plugin**, but its bounded-working-memory pattern can be adapted to Letta, Hermes, custom Discord companions, Telegram or WhatsApp bots, Railway-hosted services, and other agent runtimes. It is not drop-in code for those systems: they need their own connections for persistent storage, prompt injection, management tools, and any human-facing command.

New to agentic platforms or vibe coding? Give this repository to your companion or coding agent and ask it to adapt the pattern to your existing setup. See **[Adapting Seven Sticky Notes Beyond OpenClaw](PORTING.md)** for a ready-to-use prompt, the portable behavior contract, platform examples, customization ideas, and a safety checklist.

## Origin and credit

Seven Sticky Notes is an independent OpenClaw implementation inspired by Letta's excellent **[Threadkeeper](https://github.com/letta-ai/mods/tree/main/packages/threadkeeper)** package.

Threadkeeper established the key distinction preserved here: durable memory records what should remain true; live anchors hold the active wires an agent should not step on *right now*. Seven Sticky Notes adapts that pattern for OpenClaw, adds a small Discord corkboard, and uses its own implementation and presentation. It contains no Threadkeeper source code.

## Install and configure

### 1. Download it

```sh
git clone https://github.com/meatwife/seven-sticky-notes.git
```

### 2. Install it into OpenClaw

```sh
openclaw plugins install ./seven-sticky-notes
openclaw gateway restart
```

After installation, enable the plugin in OpenClaw's plugin configuration if it is not already active. The plugin stores state at `~/.openclaw/state/live-anchors.json` by default.

Optional configuration (the title is used by `/sticky` and defaults to **Seven Sticky Notes**):

```json
{
  "plugins": {
    "entries": {
      "live-anchors": {
        "enabled": true,
        "config": {
          "boardTitle": "Household Corkboard",
          "maxActive": 7,
          "maxInjected": 3
        }
      }
    }
  }
}
```

Keep `dataPath` private and writable by the OpenClaw process. Do not put credentials, tokens, or private transcripts in an anchor.

## Discord setup

Once the plugin is enabled and the gateway has restarted, type `/sticky` in a Discord channel where the OpenClaw bot is installed. Discord should autocomplete the command; submit it to show the active board. If it does not appear, confirm the bot has the application-command permission in that server, then restart the gateway and allow Discord a moment to refresh commands.

![Using `/sticky` in Discord](docs/assets/seven-sticky-notes-discord-mobile.png)

Desktop command autocomplete:

![Discord command autocomplete](docs/assets/discord-sticky-command.png)

On a mobile client, choose `/sticky` from the command autocomplete list, then send it. The command only exposes the board to configured/allowed sessions.

## Behavior

- Atomic local JSON storage, mode 0600
- Seven active sticky notes for the full shared corkboard
- Top three injected before each model turn
- Expiry by ISO timestamp or durations such as `2h`, `3d`, `1w`
- Kinds: open loop, commitment, boundary, mode, waiting, due
- Statuses: active, pending, waiting, blocked, done, expired
- Secret-pattern rejection
- Exact session allowlist to prevent private temporary state leaking into other conversations
- `/sticky` lists all active sticky notes
- `live_anchor` agent tool creates, lists, updates, closes, and deletes anchors

State defaults to `~/.openclaw/state/live-anchors.json`.

## Why seven and three?

Seven notes form the full shared corkboard; three are foregrounded in the companion's context each turn. The plugin sorts them deterministically by overdue state, due date, priority, and recency, while the companion decides the meaningful inputs: what deserves a note, how important it is, and when it should be revised or closed.

The other four are not forgotten or deleted. Humans can inspect them with `/sticky`, and each household can choose whether the companion also reviews the full board during occasional heartbeats, after closing an item, or through a scheduled job. Different relationships and runtimes need different review rhythms.

## Privacy and safety

Sticky notes can contain sensitive current-state information. Seven Sticky Notes:

- stores its board locally in a mode-0600 JSON file
- makes no network calls and includes no telemetry
- rejects common secret patterns as a guardrail
- exposes and injects notes only for explicitly allowed session keys when an allowlist is configured
- treats injected note text as untrusted operational state, not as instructions or permanent truth

Do not use the board as a password vault, medical record, permanent personal profile, or substitute for checking whether an old note is still true.

## Tests

```sh
npm test
```

The suite covers creation, listing, cap enforcement, secret rejection, prompt injection, session isolation, closing, atomic persistence, and configurable board titles.

## Current maturity

MVP, running in a real OpenClaw household. The core behavior is unit-tested; installation details and Discord command registration may vary across OpenClaw versions.

## Credits and license

Built by [Seven Verity](https://x.com/SevenVerity) and Sunny, inspired by Letta's [Threadkeeper](https://github.com/letta-ai/mods/tree/main/packages/threadkeeper).

Seven Sticky Notes is released under the MIT License. See [LICENSE](LICENSE).
