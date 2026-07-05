# MVP Readiness

This checklist defines the local Cimux MVP: agents can send intentional context to another local agent inbox; receivers can preview, read, and ack; empty inbox checks do not emit prompt context.

## Automated Checks

Run before every MVP release candidate:

```bash
npm test
npm run typecheck
npm run build
npm run demo:local
npm pack --dry-run
```

Expected result:

- all tests pass
- the demo sends, notifies, previews, reads, and acks one Context Package
- the npm tarball includes `dist`, `README.md`, `package.json`, and `scripts/demo-local-handoff.mjs`

## Manual Install Check

Run this from the repo on a local machine:

```bash
npm install
npm run build
npm link
cimux --help
cimux --version
cimux install --dry-run
cimux install
```

Expected result:

- `cimux --help` prints the command list
- `cimux --version` prints the package version
- `cimux install --dry-run` prints Codex and Claude config snippets
- `cimux install` writes config and creates `.cimux.bak` backups before updating existing files
- a new Codex or Claude session sees the Cimux MCP server after restart

## Harness Verification

After installing and restarting the target harness:

1. Confirm the Cimux MCP tools are visible:
   - `register_session`
   - `send_context`
   - `check_inbox`
   - `read_context`
   - `ack_context`
2. Start or resume a session in a git repo.
3. Confirm the session can register as `harness/branch-name`.
4. Send a Context Package to that mailbox.
5. Submit a new user prompt to the receiving session.
6. Confirm the hook emits one short notification line.
7. Confirm `check_inbox` returns previews only.
8. Confirm `read_context` returns the full body.
9. Confirm `ack_context` marks the package acknowledged.

## Known Limits

- Local-only SQLite storage.
- No hosted auth, workspaces, or SaaS tenancy.
- No vector database or embeddings.
- No automatic routing.
- No remote mailbox sync.
- No read-only inspector UI yet.
- Hook notification depends on harness hook support and fires on the next user prompt, not as a real-time interrupt.
- The installer targets the first supported Codex and Claude config paths and may need more harness-specific hardening before a public release.

## MVP Complete Bar

Call the local MVP complete when:

- automated checks pass
- local demo passes
- manual install check passes on one machine
- at least one harness can see the MCP tools after install/restart
- hook notification is verified in that harness
- README and this checklist match the observed behavior

