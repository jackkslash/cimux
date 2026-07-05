# Cimux

Local-first mailboxes for intentional AI agent context handoffs.

Cimux gives concurrent coding agents a simple way to pass context without dumping every detail into every session. A sender creates a structured Context Package, addressed to a mailbox such as `codex/backend-auth` or `claude/frontend-login`. The receiver can preview the inbox cheaply, read the full package only when it matters, and ack it after loading.

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
- SQLite storage
- mailbox registration and name inference
- MCP server with mailbox tools
- zero-token notification command
- safe installer for Codex and Claude config targets
- local CLI commands for debugging and demos

Not included yet:

- hosted SaaS mode
- vector search or embeddings
- automatic routing
- remote auth
- read-only inspector UI

See [docs/mvp-readiness.md](docs/mvp-readiness.md) for the release checklist and known limits.

## Install

From npm (package `cimux-mcp`, command `cimux`):

```bash
npm install -g cimux-mcp
cimux install --dry-run
cimux install
```

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
- `send_context`
- `check_inbox`
- `read_context`
- `ack_context`

Typical flow:

1. A session registers or infers its mailbox.
2. Another session sends a Context Package to that mailbox.
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
  --tags auth,frontend

cimux notify --mailbox claude/frontend-login
cimux check --mailbox claude/frontend-login
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

## MVP Readiness

Before calling a build MVP-complete, run the automated checks and manual harness verification in [docs/mvp-readiness.md](docs/mvp-readiness.md).
