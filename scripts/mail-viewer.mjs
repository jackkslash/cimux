#!/usr/bin/env node
// Read-only web viewer for the local cimux database.
// Usage: node cimux-viewer.mjs [port] [dbPath]
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

const port = Number(process.argv[2] ?? 4767);
const dbPath =
  process.argv[3] ?? path.join(os.homedir(), ".cimux", "cimux.sqlite");

function readState() {
  // Open read-only per request: never blocks writers, never marks mail read.
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const mailboxes = db
      .prepare("select name, created_at, last_seen_at from mailboxes order by name")
      .all();
    const packages = db
      .prepare(
        `select id, from_mailbox, to_mailbox, title, summary, body, tags_json,
                artifacts_json, payload_json, created_at, read_at, ack_json
         from context_packages order by created_at desc limit 200`
      )
      .all()
      .map((row) => ({
        id: row.id,
        from: row.from_mailbox,
        to: row.to_mailbox,
        title: row.title,
        summary: row.summary,
        body: row.body,
        tags: JSON.parse(row.tags_json),
        artifacts: JSON.parse(row.artifacts_json),
        payload: JSON.parse(row.payload_json),
        createdAt: row.created_at,
        readAt: row.read_at,
        ack: JSON.parse(row.ack_json)
      }));
    return { dbPath, mailboxes, packages };
  } finally {
    db.close();
  }
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cimux mail</title>
<style>
  :root {
    --ground:#eef1ef; --pane:#f7f9f7; --surface:#ffffff; --ink:#1f262a;
    --muted:#5c6771; --faint:#8a949c; --line:#dce2e0; --line-soft:#e7ebe9;
    --accent:#196e63; --accent-soft:#e0eeea; --sel:#d5e8e3;
    --unread:#1d7fd1; --green:#3d7a46; --green-soft:#e6f0e7;
    --tag:#eceff0; --code:#f0f2f1;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground:#101416; --pane:#171c1f; --surface:#1d2327; --ink:#dbe2e5;
      --muted:#8d99a1; --faint:#68737b; --line:#2b3438; --line-soft:#232b2f;
      --accent:#4fb8a8; --accent-soft:#1c302c; --sel:#22423c;
      --unread:#4da3e8; --green:#82bd8b; --green-soft:#1e2c20;
      --tag:#252d31; --code:#20272b;
    }
  }
  * { box-sizing:border-box; }
  html, body { height:100%; }
  body { margin:0; background:var(--ground); color:var(--ink);
    font:13.5px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing:antialiased; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  .app { display:grid; grid-template-columns: 200px 340px 1fr;
    grid-template-rows: 44px 1fr; height:100vh; }
  @media (max-width: 900px) { .app { grid-template-columns: 170px 1fr; }
    .reader { display:none; } }

  /* toolbar */
  .toolbar { grid-column: 1 / -1; display:flex; align-items:center; gap:0.75rem;
    padding:0 1rem; background:var(--pane); border-bottom:1px solid var(--line); }
  .toolbar .brand { font-weight:700; font-size:0.85rem; letter-spacing:0.02em; }
  .toolbar .brand span { color:var(--accent); }
  .toolbar .db { color:var(--faint); font-size:0.68rem; }
  .toolbar .live { margin-left:auto; color:var(--muted); font-size:0.72rem; }
  .toolbar .live::before { content:""; display:inline-block; width:7px; height:7px;
    border-radius:50%; background:var(--green); margin-right:0.4rem; }

  /* folders */
  .folders { background:var(--pane); border-right:1px solid var(--line);
    padding:0.75rem 0.5rem; overflow-y:auto; }
  .folders h2 { font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em;
    color:var(--faint); margin:0.25rem 0 0.4rem 0.6rem; font-weight:700; }
  .folder { display:flex; align-items:center; gap:0.5rem; width:100%;
    background:none; border:none; color:var(--ink); font:inherit; font-size:0.8rem;
    padding:0.38rem 0.6rem; border-radius:6px; cursor:pointer; }
  .folder:hover { background:var(--line-soft); }
  .folder.active { background:var(--sel); color:var(--accent); font-weight:600; }
  .folder .icon { width:0.95rem; text-align:center; opacity:0.75; }
  .folder .count { margin-left:auto; font-size:0.68rem; font-weight:700;
    font-variant-numeric:tabular-nums; color:var(--muted); }
  .folder.active .count { color:var(--accent); }
  .folder:focus-visible, .row:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }

  /* message list */
  .list { background:var(--surface); border-right:1px solid var(--line);
    overflow-y:auto; }
  .listhead { position:sticky; top:0; background:var(--surface); z-index:1;
    padding:0.55rem 1rem; border-bottom:1px solid var(--line);
    font-size:0.72rem; color:var(--muted); display:flex; }
  .listhead b { color:var(--ink); margin-right:0.35rem; }
  .listhead .n { margin-left:auto; font-variant-numeric:tabular-nums; }
  .row { display:grid; grid-template-columns: 14px 1fr auto; column-gap:0.5rem;
    width:100%; text-align:left; background:none; border:none; color:inherit;
    font:inherit; padding:0.6rem 0.9rem 0.6rem 0.6rem; cursor:pointer;
    border-bottom:1px solid var(--line-soft); align-items:baseline; }
  .row:hover { background:var(--line-soft); }
  .row.selected { background:var(--sel); }
  .dot { width:8px; height:8px; border-radius:50%; margin-top:0.32rem; justify-self:center; }
  .row[data-unread="true"] .dot { background:var(--unread); }
  .row .from { font-size:0.78rem; color:var(--muted); }
  .row[data-unread="true"] .from, .row[data-unread="true"] .subj { font-weight:650; color:var(--ink); }
  .row .time { grid-column:3; font-size:0.7rem; color:var(--faint);
    font-variant-numeric:tabular-nums; white-space:nowrap; }
  .row .subj { grid-column:2 / 4; font-size:0.82rem; margin-top:0.1rem;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .row .snip { grid-column:2 / 4; font-size:0.75rem; color:var(--faint); margin-top:0.1rem;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .row .flags { grid-column:2 / 4; margin-top:0.25rem; display:flex; gap:0.3rem; }
  .empty { color:var(--faint); text-align:center; padding:3rem 1rem; font-size:0.8rem; }

  /* reading pane */
  .reader { background:var(--surface); overflow-y:auto; }
  .reader .placeholder { height:100%; display:flex; align-items:center;
    justify-content:center; color:var(--faint); font-size:0.85rem; }
  .mail { max-width:720px; padding:1.4rem 1.75rem 3rem; }
  .mail h1 { font-size:1.15rem; font-weight:650; margin:0 0 0.75rem; line-height:1.3; }
  .envelope { border:1px solid var(--line); border-radius:8px; padding:0.7rem 0.9rem;
    font-size:0.78rem; display:grid; grid-template-columns:auto 1fr; gap:0.2rem 0.75rem; }
  .envelope dt { color:var(--faint); }
  .envelope dd { margin:0; }
  .pill { display:inline-block; font-size:0.68rem; font-weight:700; border-radius:99px;
    padding:0.12rem 0.55rem; }
  .p-unread { background:color-mix(in srgb, var(--unread) 14%, transparent); color:var(--unread); }
  .p-read { background:var(--tag); color:var(--muted); }
  .p-ack { background:var(--green-soft); color:var(--green); }
  .p-tag { background:var(--tag); color:var(--muted); font-weight:600; }
  .mail .bodytext { white-space:pre-wrap; overflow-wrap:break-word;
    font-size:0.85rem; line-height:1.6; margin:1.25rem 0; }
  .mail h3 { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.1em;
    color:var(--faint); margin:1.5rem 0 0.5rem; }
  .att { border:1px solid var(--line); border-radius:6px; padding:0.5rem 0.75rem;
    margin-bottom:0.4rem; font-size:0.78rem; display:flex; gap:0.5rem; align-items:baseline; }
  .att .kind { font-size:0.65rem; font-weight:700; text-transform:uppercase;
    letter-spacing:0.05em; color:var(--accent); }
  .att .note { color:var(--faint); }
  .meta { color:var(--faint); font-size:0.72rem; }
</style>
</head>
<body>
<div class="app">
  <div class="toolbar">
    <span class="brand"><span>cimux</span> mail</span>
    <span class="db mono" id="db"></span>
    <span class="live" id="live">live</span>
  </div>
  <nav class="folders">
    <h2>Mailboxes</h2>
    <div id="folders"></div>
  </nav>
  <section class="list" aria-label="Messages">
    <div class="listhead" id="listhead"></div>
    <div id="rows"></div>
  </section>
  <section class="reader" id="reader" aria-label="Message">
    <div class="placeholder">Select a message</div>
  </section>
</div>
<script>
let state = null;
let folder = "__all__";
let selectedId = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function fmtShort(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
}
function fmtLong(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined,
    {weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function shown() {
  return state.packages.filter((p) => folder === "__all__" || p.to === folder);
}

function render() {
  if (!state) return;
  document.getElementById("db").textContent = state.dbPath;

  const unreadBy = {};
  for (const p of state.packages) if (!p.readAt) unreadBy[p.to] = (unreadBy[p.to] ?? 0) + 1;
  const allUnread = state.packages.filter((p) => !p.readAt).length;

  document.getElementById("folders").innerHTML =
    folderBtn("__all__", "📥", "All mail", allUnread) +
    state.mailboxes.map((m) =>
      folderBtn(m.name, "🗂", m.name, unreadBy[m.name] ?? 0)).join("");
  for (const b of document.querySelectorAll(".folder"))
    b.onclick = () => { folder = b.dataset.box; render(); };

  const msgs = shown();
  document.getElementById("listhead").innerHTML =
    "<b>" + esc(folder === "__all__" ? "All mail" : folder) + "</b>" +
    '<span class="n">' + msgs.length + " message" + (msgs.length === 1 ? "" : "s") + "</span>";

  document.getElementById("rows").innerHTML = msgs.length
    ? msgs.map(row).join("")
    : '<p class="empty">No mail here yet.</p>';
  for (const r of document.querySelectorAll(".row"))
    r.onclick = () => { selectedId = r.dataset.id; render(); };

  const current = state.packages.find((p) => p.id === selectedId);
  document.getElementById("reader").innerHTML = current
    ? mail(current)
    : '<div class="placeholder">Select a message</div>';
}

function folderBtn(id, icon, label, count) {
  return '<button class="folder' + (folder === id ? " active" : "") +
    '" data-box="' + esc(id) + '"><span class="icon">' + icon + "</span>" +
    '<span class="mono">' + esc(label) + "</span>" +
    (count ? '<span class="count">' + count + "</span>" : "") + "</button>";
}

function row(p) {
  const acked = p.ack.status === "acknowledged";
  return '<button class="row' + (p.id === selectedId ? " selected" : "") +
    '" data-id="' + esc(p.id) + '" data-unread="' + !p.readAt + '">' +
    '<span class="dot"></span>' +
    '<span class="from mono">' + esc(p.from) + "</span>" +
    '<span class="time">' + fmtShort(p.createdAt) + "</span>" +
    '<span class="subj">' + esc(p.title) + "</span>" +
    '<span class="snip">' + esc(p.summary) + "</span>" +
    (acked ? '<span class="flags"><span class="pill p-ack">✓ acked</span></span>' : "") +
    "</button>";
}

function mail(p) {
  const acked = p.ack.status === "acknowledged";
  const atts = Object.entries(p.artifacts)
    .flatMap(([kind, items]) => (Array.isArray(items) ? items : []).map((a) =>
      '<div class="att"><span class="kind">' + esc(kind.replace(/s$/, "")) + "</span>" +
      '<span class="mono">' +
      esc(a.path ?? a.url ?? a.sha ?? a.name ?? a.label ?? JSON.stringify(a)) + "</span>" +
      (a.note ? '<span class="note">' + esc(a.note) + "</span>" : "") + "</div>"))
    .join("");
  return '<article class="mail">' +
    "<h1>" + esc(p.title) + "</h1>" +
    '<dl class="envelope">' +
      "<dt>From</dt><dd class=\\"mono\\">" + esc(p.from) + "</dd>" +
      "<dt>To</dt><dd class=\\"mono\\">" + esc(p.to) + "</dd>" +
      "<dt>Date</dt><dd>" + fmtLong(p.createdAt) + "</dd>" +
      "<dt>Status</dt><dd>" +
        (!p.readAt ? '<span class="pill p-unread">unread</span>'
          : '<span class="pill p-read">read ' + fmtLong(p.readAt) + "</span>") +
        (acked ? ' <span class="pill p-ack">acked by ' + esc(p.ack.ackBy) + "</span>" : "") +
      "</dd>" +
      (p.tags.length ? "<dt>Tags</dt><dd>" +
        p.tags.map((t) => '<span class="pill p-tag">' + esc(t) + "</span>").join(" ") +
        "</dd>" : "") +
    "</dl>" +
    '<div class="bodytext">' + esc(p.body) + "</div>" +
    (atts ? "<h3>Artifacts</h3>" + atts : "") +
    (acked && p.ack.note ? '<h3>Ack note</h3><p class="meta">' + esc(p.ack.note) + "</p>" : "") +
    '<h3>Package id</h3><p class="meta mono">' + esc(p.id) + "</p>" +
  "</article>";
}

async function tick() {
  try {
    const res = await fetch("/api/state");
    state = await res.json();
    if (!selectedId && state.packages.length) selectedId = state.packages[0].id;
    document.getElementById("live").textContent = "live";
    render();
  } catch {
    document.getElementById("live").textContent = "reconnecting…";
  }
}
tick();
setInterval(tick, 2000);
</script>
</body>
</html>`;

const server = createServer((req, res) => {
  try {
    if (req.url === "/api/state") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(readState()));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`cimux mail viewer (read-only) on http://localhost:${port}`);
  console.log(`database: ${dbPath}`);
});
