import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-demo-"));
const dbPath = path.join(tempDir, "cimux.sqlite");
const cliPath = path.join(process.cwd(), "dist", "index.js");

function run(args) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: tempDir,
    encoding: "utf8",
    env: {
      ...process.env,
      CIMUX_DB_PATH: dbPath
    }
  }).trim();
}

function runJson(args) {
  return JSON.parse(run(args));
}

console.log("Cimux local handoff demo");
console.log(`Database: ${dbPath}`);

run(["register", "--mailbox", "codex/backend-auth"]);
run(["register", "--mailbox", "claude/frontend-login"]);

const sent = runJson([
  "send",
  "--from",
  "codex/backend-auth",
  "--to",
  "claude/frontend-login",
  "--title",
  "Auth handoff",
  "--summary",
  "Frontend should handle the new auth error.",
  "--body",
  "validateSession now throws ExpiredSessionError.",
  "--tags",
  "auth,frontend"
]);

console.log(`Sent: ${sent.contextPackage.id}`);
console.log(run(["notify", "--mailbox", "claude/frontend-login"]));

const inbox = runJson(["check", "--mailbox", "claude/frontend-login"]);
console.log(`Preview count: ${inbox.previews.length}`);
console.log(`Preview title: ${inbox.previews[0].title}`);

const read = runJson([
  "read",
  "--mailbox",
  "claude/frontend-login",
  "--id",
  sent.contextPackage.id
]);
console.log(`Read body: ${read.contextPackage.body}`);

const acked = runJson([
  "ack",
  "--mailbox",
  "claude/frontend-login",
  "--id",
  sent.contextPackage.id,
  "--note",
  "Loaded in demo."
]);
console.log(`Ack: ${acked.contextPackage.ack.status}`);

