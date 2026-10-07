/**
 * Flagship export: builds a single self-contained HTML file of the Connection
 * Web that anyone can open offline and explore — pan, zoom, drag nodes, hover
 * for exact reply stats. Zero dependencies: no CDN, no bundler gymnastics,
 * nothing leaves the machine.
 *
 * Design decisions:
 * - Embed the *settled* node positions from the live d3 simulation, then run a
 *   gentle vanilla spring relaxation so the file looks like what the user saw.
 * - Physics lives in ~4KB of inline vanilla JS — no framework, no d3.
 * - All chat-derived strings are JSON-serialized with `<` escaped to \u003c so
 *   a member named `</script>` can't break out of the data tag (tested).
 * - The generated page keeps all chat strings as text via SVG textContent /
 *   dataset and escapes them before any innerHTML use.
 * - The builder is pure and deterministic: same payload in, byte-identical
 *   file out. `generatedAt` travels inside the payload, never captured here.
 */

export interface GraphExportNode {
  id: string;
  label: string;
  initials: string;
  /** Community id (index into communities[]), or -1 for no community. */
  community: number;
  /** Hex color (community color or avatar fallback). */
  color: string;
  /** Settled canvas coordinates from the live d3 simulation. */
  x: number;
  y: number;
  r: number;
  messages: number;
}

export interface GraphExportLink {
  /** Index into nodes[]. */
  s: number;
  t: number;
  exchanges: number;
  fast: number;
  avgMs: number;
  medianMs: number;
  /** Per-direction reply counts: a → b and b → a. */
  aToB: number;
  bToA: number;
}

export interface GraphExportCommunity {
  id: number;
  name: string;
  color: string;
  memberCount: number;
}

export interface GraphExportPayload {
  meta: {
    title: string;
    generatedAt: number;
    rangeLabel: string;
    messages: number;
    members: number;
    days: number;
  };
  communities: GraphExportCommunity[];
  nodes: GraphExportNode[];
  links: GraphExportLink[];
}

export const EXPORT_NODE_CAP = 60;
export const EXPORT_LINK_CAP = 200;

/**
 * JSON.stringify with `<` escaped so embedded JSON cannot terminate a
 * <script> tag. Also escapes U+2028/U+2029 line separators.
 */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Caps the payload to keep exported files ~50–100KB regardless of chat size:
 * top 60 nodes by message count, top 200 links by exchanges, with node
 * indices remapped to the pruned array.
 */
export function capPayload(payload: GraphExportPayload): GraphExportPayload {
  const kept = [...payload.nodes].sort((a, b) => b.messages - a.messages).slice(0, EXPORT_NODE_CAP);
  const remap = new Map(kept.map((n, i) => [payload.nodes.indexOf(n), i]));

  const links = payload.links
    .filter((l) => remap.has(l.s) && remap.has(l.t))
    .map((l) => ({ ...l, s: remap.get(l.s)!, t: remap.get(l.t)! }))
    .sort((a, b) => b.exchanges - a.exchanges)
    .slice(0, EXPORT_LINK_CAP);

  const keptNodes = kept.map((n) => ({ ...n }));
  return { ...payload, nodes: keptNodes, links };
}

/** Escapes dynamic strings used in generated HTML structure. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The builder. Everything chat-derived flows through either safeJson (inside
 * the data tag) or esc (in HTML attributes/headers).
 */
export function buildConnectionWebHtml(payload: GraphExportPayload): string {
  const P = capPayload({
    ...payload,
    nodes: payload.nodes.map((n) => ({ ...n })),
    links: payload.links.map((l) => ({ ...l })),
  });

  // Honest caps note: shown only when something was actually trimmed.
  const trimmedMembers = payload.nodes.length - P.nodes.length;
  const trimmedLinks = payload.links.length - P.links.length;
  const capsNote =
    trimmedMembers > 0 || trimmedLinks > 0
      ? ` · showing top ${P.nodes.length} of ${payload.nodes.length} members and strongest ${P.links.length} of ${payload.links.length} links`
      : "";

  const dataScript = safeJson(P);
  const day = safeJson(new Date(P.meta.generatedAt).toISOString().slice(0, 10)).slice(1, -1); // strip quotes

  const legendItems = P.communities
    .map(
      (c) =>
        `<span class="li"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)} <em>${c.memberCount}</em></span>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(P.meta.title)}</title>
<style>
:root{color-scheme:dark}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#09090b;color:#e4e4e7;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
header{position:fixed;top:0;left:0;right:0;z-index:20;display:flex;align-items:baseline;gap:14px;padding:16px 22px;background:linear-gradient(180deg,rgba(9,9,11,.94),rgba(9,9,11,0));user-select:none}
header h1{font-size:17px;font-weight:700}
header .sub{font-size:12px;color:#71717a}
#legend{position:fixed;top:54px;left:22px;z-index:20;display:flex;flex-direction:column;gap:6px;user-select:none}
#legend .li{display:flex;align-items:center;gap:7px;font-size:12px;color:#a1a1aa}
#legend .dot{width:10px;height:10px;border-radius:99px;display:inline-block}
#legend em{font-style:normal;color:#52525b}
#tip{position:fixed;z-index:30;pointer-events:none;max-width:340px;padding:10px 14px;border-radius:12px;background:rgba(18,18,20,.97);border:1px solid rgba(255,255,255,.1);font-size:12.5px;line-height:1.5;opacity:0;transition:opacity .12s}
#tip b{display:block;margin-bottom:3px;color:#fff}
#tip span{color:#a1a1aa}
svg{display:block;width:100vw;height:100vh;cursor:grab}
svg.grabbing{cursor:grabbing}
footer{position:fixed;bottom:14px;left:0;right:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-size:11.5px;color:#52525b;user-select:none}
footer a{color:#3b82f6;text-decoration:none}
#png{position:fixed;bottom:14px;right:22px;z-index:25;padding:7px 16px;border-radius:99px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#d4d4d8;font:600 12px ui-sans-serif,system-ui,sans-serif;cursor:pointer}
#png:hover{background:rgba(255,255,255,.12)}
@media print{header,#legend,footer,#png{display:none}}
</style>
</head>
<body>
<header>
<h1>${esc(P.meta.title)}</h1>
<span class="sub">${esc(P.meta.rangeLabel)} &middot; ${P.meta.messages} messages &middot; ${P.meta.members} members &middot; exported ${esc(day)}</span>
</header>
<div id="legend">${legendItems}</div>
<div id="tip"></div>
<svg id="web" role="img" aria-label="Connection web: ${P.nodes.length} members, ${P.links.length} reply links"></svg>
<button id="png">Download PNG</button>
<footer>
<span>Drag nodes &middot; scroll to zoom &middot; hover for exact reply stats &middot; works fully offline, nothing is uploaded${capsNote}</span>
<a href="https://github.com/Qwerty-coding/StatsApp">Made with VibeCheck</a>
</footer>
<script type="application/json" id="graph-data">${dataScript}</script>
<script>
"use strict";
var P = JSON.parse(document.getElementById("graph-data").textContent);
var svg = document.getElementById("web");
var tip = document.getElementById("tip");
var NS = "http://www.w3.org/2000/svg";
var nodes = P.nodes, links = P.links;

function fmtMs(ms) {
  if (!isFinite(ms) || ms <= 0) return "—";
  if (ms < 60000) return Math.round(ms / 1000) + "s";
  if (ms < 3600000) return Math.round(ms / 60000) + "m";
  return (ms / 3600000).toFixed(1) + "h";
}

// Gentle spring relaxation toward the embedded settled layout + light
// repulsion, so the file resembles the in-app graph without a real engine.
(function relax() {
  var K = 0.012, REP = 180;
  for (var i = 0; i < 60; i++) {
    links.forEach(function (l) {
      var a = nodes[l.s], b = nodes[l.t]; if (!a || !b) return;
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var f = ((d - 190) / d) * K;
      a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
    });
    for (var p = 0; p < nodes.length; p++) for (var q = p + 1; q < nodes.length; q++) {
      var A = nodes[p], B = nodes[q];
      var rx = B.x - A.x, ry = B.y - A.y, d2 = rx * rx + ry * ry; if (d2 < 36) d2 = 36;
      var fr = REP / d2, dd = Math.sqrt(d2) || 1;
      A.x -= (rx / dd) * fr; A.y -= (ry / dd) * fr; B.x += (rx / dd) * fr; B.y += (ry / dd) * fr;
    }
  }
})();

var center = document.createElementNS(NS, "g");
var edgeG = document.createElementNS(NS, "g");
var nodeG = document.createElementNS(NS, "g");
center.appendChild(edgeG); center.appendChild(nodeG); svg.appendChild(center);

var maxEx = 1;
links.forEach(function (l) { if (l.exchanges > maxEx) maxEx = l.exchanges; });

var edgeEls = [];
links.forEach(function (l) {
  var s = nodes[l.s], t = nodes[l.t]; if (!s || !t) { edgeEls.push(null); return; }
  var line = document.createElementNS(NS, "line");
  line.setAttribute("stroke", "#ffffff");
  line.setAttribute("stroke-opacity", 0.14 + (l.exchanges / maxEx) * 0.5);
  line.setAttribute("stroke-width", 0.75 + (l.exchanges / maxEx) * 3.25);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("data-label", s.label + " ⇄ " + t.label + " — " + l.exchanges + " exchanges (" + l.fast + " rapid) · avg reply " + fmtMs(l.avgMs) + " · median " + fmtMs(l.medianMs) + "||" + s.label + " → " + t.label + ": " + l.aToB + " replies · " + s.label + " ← " + t.label + ": " + l.bToA + " replies");
  edgeG.appendChild(line);
  edgeEls.push(line);
});

var nodeEls = [];
nodes.forEach(function (n, idx) {
  var g = document.createElementNS(NS, "g");
  var ring = document.createElementNS(NS, "circle");
  ring.setAttribute("r", n.r + 4); ring.setAttribute("fill", n.color); ring.setAttribute("fill-opacity", 0.22);
  var body = document.createElementNS(NS, "circle");
  body.setAttribute("r", n.r); body.setAttribute("fill", "#121214");
  body.setAttribute("stroke", n.color); body.setAttribute("stroke-width", 2);
  var ini = document.createElementNS(NS, "text");
  ini.setAttribute("text-anchor", "middle"); ini.setAttribute("dy", 4);
  ini.setAttribute("font-size", Math.max(9, n.r * 0.62)); ini.setAttribute("font-weight", 600);
  ini.setAttribute("fill", "#e4e4e7"); ini.textContent = n.initials;
  var label = document.createElementNS(NS, "text");
  label.setAttribute("y", n.r + 15); label.setAttribute("text-anchor", "middle");
  label.setAttribute("font-size", 11); label.setAttribute("fill", "rgba(228,228,231,0.72)");
  label.textContent = n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label;
  g.appendChild(ring); g.appendChild(body); g.appendChild(ini); g.appendChild(label);
  g.setAttribute("data-idx", idx);
  var comm = n.community >= 0 && P.communities[n.community] ? " · " + P.communities[n.community].name : "";
  g.setAttribute("data-h", n.label + " — " + n.messages + " messages" + comm);
  nodeG.appendChild(g);
  nodeEls.push(g);
});

function layout() {
  links.forEach(function (l, i) {
    var s = nodes[l.s], t = nodes[l.t], el = edgeEls[i];
    if (!s || !t || !el) return;
    el.setAttribute("x1", s.x); el.setAttribute("y1", s.y);
    el.setAttribute("x2", t.x); el.setAttribute("y2", t.y);
  });
  nodes.forEach(function (n, i) {
    if (nodeEls[i]) nodeEls[i].setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
  });
}
layout();

// Cursor-anchored pan + zoom
var view = { k: 1, x: 0, y: 0 };
function applyView() { center.setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.k + ")"); }
applyView();
svg.addEventListener("wheel", function (e) {
  e.preventDefault();
  var rect = svg.getBoundingClientRect();
  var mx = e.clientX - rect.left - rect.width / 2, my = e.clientY - rect.top - rect.height / 2;
  var wx = (mx - view.x) / view.k, wy = (my - view.y) / view.k;
  var k2 = Math.max(0.3, Math.min(5, view.k * (e.deltaY > 0 ? 0.9 : 1.1)));
  view = { k: k2, x: mx - k2 * wx, y: my - k2 * wy };
  applyView();
}, { passive: false });

var dragNode = null, panning = false, lastX = 0, lastY = 0;
function localPt(e) {
  var rect = svg.getBoundingClientRect();
  return { x: (e.clientX - rect.left - rect.width / 2 - view.x) / view.k, y: (e.clientY - rect.top - rect.height / 2 - view.y) / view.k };
}
svg.addEventListener("pointerdown", function (e) {
  var g = e.target.closest ? e.target.closest("g[data-idx]") : null;
  if (g) { dragNode = nodes[+g.getAttribute("data-idx")]; e.preventDefault(); }
  else { panning = true; svg.classList.add("grabbing"); }
  lastX = e.clientX; lastY = e.clientY;
  if (svg.setPointerCapture) try { svg.setPointerCapture(e.pointerId); } catch (err) {}
});
svg.addEventListener("pointermove", function (e) {
  if (dragNode) { var p = localPt(e); dragNode.x = p.x; dragNode.y = p.y; layout(); return; }
  if (panning) { view.x += e.clientX - lastX; view.y += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; applyView(); return; }
  var el = e.target.closest ? e.target.closest("[data-label],[data-h]") : null;
  if (el) {
    var raw = el.getAttribute("data-label") || el.getAttribute("data-h") || "";
    var parts = raw.split("||");
    var html = "<b>" + parts[0].replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</b>";
    if (parts[1]) html += "<span>" + parts[1].replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>";
    tip.innerHTML = html;
    tip.style.opacity = 1;
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 350) + "px";
    tip.style.top = Math.max(10, e.clientY - 12) + "px";
  } else tip.style.opacity = 0;
});
window.addEventListener("pointerup", function () { dragNode = null; panning = false; svg.classList.remove("grabbing"); });
svg.addEventListener("pointerleave", function () { tip.style.opacity = 0; });

document.getElementById("png").addEventListener("click", function () {
  var rect = svg.getBoundingClientRect();
  var c = document.createElement("canvas");
  c.width = rect.width * 2; c.height = rect.height * 2;
  var ctx = c.getContext("2d");
  var xml = new XMLSerializer().serializeToString(svg);
  var img = new Image();
  img.onload = function () {
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    var a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "vibecheck-connections.png";
    a.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
});
</script>
</body>
</html>`;
}
