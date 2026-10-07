import { describe, it, expect, beforeEach } from "vitest";
import { buildConnectionWebHtml, type GraphExportPayload } from "../lib/export/graphHtml";

/**
 * Runtime test: the exported HTML's inline script must execute clean in a real
 * DOM (jsdom) and build the SVG web — nodes, edges, view transform — without
 * throwing. This catches broken generated JS that string-level tests can't.
 *
 * The project has no jsdom dependency; instead we hand-execute the page's
 * script against a minimal but faithful DOM shim (the script uses a tiny,
 * well-behaved DOM subset: getElementById, createElementNS, appendChild,
 * setAttribute, classList, addEventListener). We then assert the SVG graph
 * structure. If the shim ever misses an API the page needs, this test fails
 * loudly — that's the point.
 */

interface FakeEl {
  tag: string;
  attrs: Map<string, string>;
  children: FakeEl[];
  dataset: Record<string, string>;
  textContent: string;
  style: Record<string, string>;
  classList: { add(...c: string[]): void; remove(...c: string[]): void };
  listeners: Map<string, (() => void)[]>;
  owner?: FakeDoc;
  appendChild(c: FakeEl): FakeEl;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  addEventListener(type: string, fn: () => void): void;
}

interface FakeDoc {
  els: Map<string, FakeEl>;
  createElementNS(ns: string, tag: string): FakeEl;
  getElementById(id: string): FakeEl | null;
}

function makeEl(doc: FakeDoc, tag: string): FakeEl {
  const el: FakeEl = {
    tag,
    attrs: new Map(),
    children: [],
    dataset: {},
    textContent: "",
    style: {},
    listeners: new Map(),
    owner: doc,
    classList: {
      add(...c: string[]) { void c; },
      remove(...c: string[]) { void c; },
    },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.get(k) ?? null; },
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); },
  };
  return el;
}

function makeDoc(): FakeDoc {
  const doc: FakeDoc = {
    els: new Map(),
    createElementNS: (_ns: string, tag: string) => makeEl(doc, tag),
    getElementById(id: string) { return doc.els.get(id) ?? null; },
  };
  doc.els.set("web", makeEl(doc, "svg"));
  doc.els.set("tip", makeEl(doc, "div"));
  doc.els.set("png", makeEl(doc, "button"));
  doc.els.set("graph-data", makeEl(doc, "script"));
  return doc;
}

function runPageScript(html: string, doc: FakeDoc): void {
  const match = html.match(/<script>\n([\s\S]*?)<\/script>/);
  expect(match).toBeTruthy();
  const src = match![1];
  const dataEl = doc.els.get("graph-data")!;
  const dataMatch = html.match(/id="graph-data">([\s\S]*?)<\/script>/);
  dataEl.textContent = dataMatch![1];

  const windowShim = {
    addEventListener: () => {},
    innerWidth: 1280,
  };
  const svg = doc.els.get("web")!;

  // The script is an IIFE over `document` and `window`; evaluate it.
  // new Function keeps it out of this module's strict scope.
  const fn = new Function("document", "window", src);
  fn(doc as unknown as Document, windowShim, svg as unknown as SVGSVGElement);
}

function payload(): GraphExportPayload {
  return {
    meta: { title: "Smoke Test", generatedAt: 1_700_000_000_000, rangeLabel: "All-Time", messages: 100, members: 2, days: 30 },
    communities: [{ id: 0, name: "The Loudest", color: "#3b82f6", memberCount: 2 }],
    nodes: [
      { id: "A", label: "Alice", initials: "A", community: 0, color: "#3b82f6", x: 100, y: 100, r: 16, messages: 60 },
      { id: "B", label: "Bob", initials: "B", community: 0, color: "#3b82f6", x: 300, y: 300, r: 12, messages: 40 },
    ],
    links: [{ s: 0, t: 1, exchanges: 50, fast: 20, avgMs: 42_000, medianMs: 28_000, aToB: 30, bToA: 20 }],
  };
}

describe("exported HTML page script (runtime)", () => {
  let doc: FakeDoc;

  beforeEach(() => { doc = makeDoc(); });

  it("executes and builds the web: 2 node groups, 1 edge, applied transform", () => {
    const html = buildConnectionWebHtml(payload());
    runPageScript(html, doc);

    const svg = doc.els.get("web")!;
    // The script appends one root <g> (center) with two child groups.
    expect(svg.children.length).toBeGreaterThan(0);
    const center = svg.children[0];
    expect(center.tag).toBe("g");
    expect(center.getAttribute("transform")).toMatch(/scale\(1\)/);
    // edgeG + nodeG under center — nodes under nodeG.
    const nodeLayer = center.children[1];
    expect(nodeLayer.children.length).toBe(2);
    expect(nodeLayer.children[0].tag).toBe("g");
    expect(nodeLayer.children[0].getAttribute("transform")).toMatch(/translate\(/);
    const edgeLayer = center.children[0];
    expect(edgeLayer.children.length).toBe(1);
    expect(edgeLayer.children[0].tag).toBe("line");
  });

  it("survives a member named </script> — page still builds the graph", () => {
    const p = payload();
    p.nodes = [
      { id: "</script>", label: "</script>", initials: "<", community: -1, color: "#fff", x: 0, y: 0, r: 10, messages: 5 },
      { id: "B", label: "Bob", initials: "B", community: -1, color: "#fff", x: 100, y: 100, r: 10, messages: 5 },
    ];
    const html = buildConnectionWebHtml(p);
    expect(() => runPageScript(html, doc)).not.toThrow();

    const svg = doc.els.get("web")!;
    const nodeLayer = svg.children[0].children[1];
    expect(nodeLayer.children.length).toBe(2);
    // The label text was set via textContent, so it is inert by construction.
    const evil = nodeLayer.children[0];
    expect(JSON.stringify(evil.textContent)).not.toContain("<script");
  });

  it("attaches pan/zoom/wheel listeners without throwing", () => {
    const html = buildConnectionWebHtml(payload());
    runPageScript(html, doc);
    const svg = doc.els.get("web")!;
    expect(svg.listeners.get("wheel")?.length).toBe(1);
    expect(svg.listeners.get("pointermove")?.length).toBe(1);
    expect(svg.listeners.get("pointerdown")?.length).toBe(1);
  });
});
