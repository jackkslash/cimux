# Cimux

Local-first mailbox for intentional AI agent context handoffs.

This repository is being rebuilt around the stripped-back MVP trunk:

- named local mailboxes
- structured Context Packages
- SQLite storage
- token-aware previews in later work
- MCP tools in later work
- zero-token hook notice in later work

## Current Work

Project scaffold.

This first slice is deliberately small. It exists to create a clean GitHub starting point before adding the actual mailbox implementation.

Included:

- npm package metadata
- TypeScript config
- build, typecheck, and test scripts
- minimal source entrypoint
- minimal test

Not included yet:

- Context Package schema
- SQLite storage
- MCP tools
- installer
- hook-check
- inspector

```bash
npm test
npm run typecheck
npm run build
```
