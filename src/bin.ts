#!/usr/bin/env node

// Check the runtime before importing anything: node:sqlite (used by the
// storage layer) is only available unflagged from Node 22.13, and importing
// it on older versions crashes with an unhelpful builtin-module error.
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    `cimux requires Node >= 22.13 (for node:sqlite). You are running ${process.versions.node}.`
  );
  process.exit(1);
}

const { runCimuxCli } = await import("./cli/cimux-cli.js");
process.exitCode = await runCimuxCli(process.argv.slice(2));
