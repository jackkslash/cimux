# Cimux

[![npm version](https://img.shields.io/npm/v/cimux-mcp)](https://www.npmjs.com/package/cimux-mcp)
[![CI](https://github.com/jackkslash/cimux/actions/workflows/ci.yml/badge.svg)](https://github.com/jackkslash/cimux/actions/workflows/ci.yml)

Local-first mailboxes for intentional AI agent context handoffs.

Cimux gives concurrent coding agents a simple way to pass context without dumping every detail into every session. A sender creates a structured Context Package, addressed to a mailbox such as `codex/backend-auth` or `claude/frontend-login`. The receiver can preview the inbox cheaply, read the full package only when it matters, and ack it after loading.

## What it looks like

One agent finishes a piece of work and hands off:

```text
Codex session                          Claude Code session
─────────────────                      ────────────────────
send_context ──────────────────────▶   (user types anything)
  to: claude/frontend-login              hook: "Cimux: 1 unread context
  title: Login bug root cause             package(s) for claude/frontend-login
  summary: Session cookie dropped         from codex/backend-auth. Call
           on redirect                    check_inbox to preview."
  artifacts: 2 files, 1 commit
                                        check_inbox   → preview (~40 tokens)
                                        read_context  → full body + artifacts
                                        ack_context   → sender can see it landed
```

The receiver's context stays clean until the moment the handoff actually matters. Empty inboxes cost zero tokens — the hook prints nothing.

## Why not just a shared notes file?

- **Token discipline.** A shared markdown file gets pasted into sessions whole. Cimux previews keep each unread handoff to a ~40-token summary until an agent decides to read it — bodies, code snippets, and payloads never enter context uninvited.
- **Delivery state.** Files can't tell you whether the other agent ever saw the note. Every Context Package tracks read and acknowledged state (first write wins, safe across concurrent processes), so a handoff is a receipt, not a hope.
- **Addressing.** Mailboxes are per harness and workstream (`codex/backend-auth`), inferred automatically from the git branch — parallel agents don't trample one shared document.
- **Cross-harness, repo-clean.** Works between Claude Code and Codex (app or CLI) through one local SQLite database in `~/.cimux/` — nothing gets committed to your repo.

The product idea is intentionally small:

- anyone can send to an existing mailbox
- only the addressed mailbox should read or ack a package
- `check_inbox` returns token-aware previews, not full bodies
- hook notifications emit nothing when the inbox is empty
- storage is local SQLite
- the main agent integration is MCP

## Current MVP

Included now:

- Context Package schema
- SQLite storage (WAL, safe for concurrent sessions)
- mailbox registration and name inference
- MCP server with mailbox tools
- zero-token notification hook and session-start briefing
- agent norms installed to `CLAUDE.md`/`AGENTS.md` so agents hand off without prompting
- safe installer for Codex and Claude config targets
- local CLI commands for debugging and demos
- prototype read-only mail viewer (`node scripts/mail-viewer.mjs`)

Not included yet:

- message or mailbox deletion
- hosted SaaS mode
- vector search or embeddings
- automatic routing
- remote auth
- polished inspector UI (`cimux ui`)

## Install

Requires Node >= 22.13 (Cimux uses the built-in `node:sqlite` — no native dependencies).

From npm (package `cimux-mcp`, command `cimux`):

```bash
npm install -g cimux-mcp
cimux install --dry-run
cimux install
```

`cimux install` writes, for each harness it supports:

| | Claude Code | Codex (app or CLI) |
| --- | --- | --- |
| MCP server | `~/.claude.json` | `~/.codex/config.toml` |
| Hooks (notify + session brief) | `~/.claude/settings.json` | `~/.codex/hooks.json` |
| Agent norms | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` |

Codex asks you to trust the hooks once (and again after any change to them) — that's Codex's own safety prompt, expected behavior.

## Install Locally

From the repo:

```bash
npm install
npm run build
npm link
cimux install --dry-run
cimux install
```

`--dry-run` prints the config snippets first. `cimux install` writes the supported config files and creates `.cimux.bak` backups before changing existing files.

After installing, restart the agent harness so it reloads MCP and hook config.

## Mailbox Names

Cimux uses `harness/name` format:

- `codex/backend-auth`
- `claude/frontend-login`
- `cursor/fix-checkout`

For hook checks, users should not have to remember a name. `cimux notify --harness codex` infers the mailbox from the current git branch, falling back to the folder name.

## MCP Tools

Cimux exposes:

- `register_session`
- `list_mailboxes`
- `send_context`
- `check_inbox`
- `read_context`
- `ack_context`

Typical flow:

1. A session starts; the `SessionStart` hook briefs the agent on its mailbox and unread count.
2. Another session finds the recipient with `list_mailboxes` and sends a Context Package.
3. The receiver sees a hook notification on the next user prompt if unread mail exists.
4. The receiver calls `check_inbox` to preview.
5. The receiver calls `read_context` for the full package.
6. The receiver calls `ack_context` after loading it.

## Local CLI

The CLI mirrors the mailbox flow for local proof/debugging:

```bash
cimux register --mailbox codex/backend-auth
cimux register --mailbox claude/frontend-login

cimux send \
  --from codex/backend-auth \
  --to claude/frontend-login \
  --title "Auth handoff" \
  --summary "Frontend should handle the new auth error." \
  --body "validateSession now throws ExpiredSessionError." \
  --tags auth,frontend \
  --artifacts-json '{"files":[{"path":"src/auth/session.ts"}]}'

cimux notify --mailbox claude/frontend-login
cimux check --mailbox claude/frontend-login --limit 5
cimux read --mailbox claude/frontend-login --id <context-id>
cimux ack --mailbox claude/frontend-login --id <context-id> --note "Loaded."
```

Run the full demo:

```bash
npm run demo:local
```

## Development

```bash
npm test
npm run typecheck
npm run build
npm run demo:local
npm pack --dry-run
```
