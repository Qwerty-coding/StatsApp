import { describe, it, expect } from "vitest";
import {
  buildConnectionWebHtml,
  capPayload,
  safeJson,
  EXPORT_NODE_CAP,
  EXPORT_LINK_CAP,
  type GraphExportPayload,
} from "../lib/export/graphHtml";

function makePayload(overrides: Partial<GraphExportPayload> = {}): GraphExportPayload {
  return {
    meta: {
      title: "The Squad — Connection Web",
      generatedAt: 1_700_000_000_000,
      rangeLabel: "All-Time",
      messages: 12_345,
      members: 3,
      days: 365,
    },
    communities: [
      { id: 0, name: "The Night Owls", color: "#3b82f6", memberCount: 2 },
      { id: 1, name: "The Meme Lords", color: "#f97316", memberCount: 1 },
    ],
    nodes: [
      { id: "alice", label: "Alice", initials: "A", community: 0, color: "#3b82f6", x: 100, y: 120, r: 18, messages: 7000 },
      { id: "bob", label: "Bob", initials: "B", community: 0, color: "#3b82f6", x: 300, y: 220, r: 14, messages: 4000 },
      { id: "charlie", label: "Charlie", initials: "C", community: 1, color: "#f97316", x: 500, y: 80, r: 11, messages: 1345 },
    ],
    links: [
      { s: 0, t: 1, exchanges: 320, fast: 120, avgMs: 42_000, medianMs: 28_000, aToB: 180, bToA: 140 },
      { s: 1, t: 2, exchanges: 40, fast: 10, avgMs: 300_000, medianMs: 120_000, aToB: 25, bToA: 15 },
    ],
    ...overrides,
  };
}

describe("safeJson", () => {
  it("escapes < so embedded JSON cannot break out of the script tag", () => {
    const evil = { name: "</script><script>alert(1)</script>" };
    const out = safeJson({ data: evil });
    expect(out).not.toContain("</script");
    expect(out).toContain("\\u003c");
  });

  it("escapes line separators that break JS string contexts", () => {
    const out = safeJson({ a: "x\u2028y\u2029z" });
    expect(out).not.toMatch(/[\u2028\u2029]/);
  });

  it("survives a round-trip through JSON.parse", () => {
    const value = { s: "</script>", n: 42, u: "x y" };
    expect(JSON.parse(safeJson(value))).toEqual(value);
  });
});

describe("capPayload", () => {
  it("keeps the strongest nodes by messages and remaps link indices", () => {
    const nodes = Array.from({ length: 80 }, (_, i) => ({
      id: `m${i}`, label: `M${i}`, initials: "M", community: -1, color: "#333",
      x: 0, y: 0, r: 10, messages: i,
    }));
    const links = [
      { s: 79, t: 78, exchanges: 999, fast: 0, avgMs: 1, medianMs: 1, aToB: 600, bToA: 399 },
      { s: 0, t: 1, exchanges: 1, fast: 0, avgMs: 1, medianMs: 1, aToB: 0, bToA: 1 },
    ];
    const capped = capPayload({ ...makePayload(), nodes, links });
    expect(capped.nodes.length).toBe(EXPORT_NODE_CAP);
    // Node 79 (highest count) must be present as index 0 of the sorted array.
    expect(capped.nodes[0].id).toBe("m79");
    expect(capped.links[0].exchanges).toBe(999);
    expect(capped.links[0].s).toBe(0);
    expect(capped.links[0].t).toBe(1);
  });

  it("drops links whose endpoints were pruned", () => {
    const capped = capPayload(makePayload());
    expect(capped.links.every((l) => l.s < capped.nodes.length && l.t < capped.nodes.length)).toBe(true);
  });

  it("enforces the link cap by exchanges", () => {
    const links = Array.from({ length: EXPORT_LINK_CAP + 50 }, (_, i) => ({
      s: 0, t: 1, exchanges: i, fast: 0, avgMs: 1, medianMs: 1, aToB: i, bToA: 0,
    }));
    const capped = capPayload(makePayload({ links }));
    expect(capped.links.length).toBe(EXPORT_LINK_CAP);
    expect(capped.links[0].exchanges).toBe(EXPORT_LINK_CAP + 49);
  });
});

describe("buildConnectionWebHtml", () => {
  it("is a complete HTML document with JSON data and an app script", () => {
    const html = buildConnectionWebHtml(makePayload());
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('id="graph-data"');
    expect(html).toContain('type="application/json"');
    expect(html).toContain('<script>');
  });

  it("is deterministic — same payload, byte-identical output", () => {
    const a = buildConnectionWebHtml(makePayload());
    const b = buildConnectionWebHtml(makePayload());
    expect(a).toBe(b);
  });

  it("escapes malicious member names in the data tag", () => {
    const html = buildConnectionWebHtml(
      makePayload({
        nodes: [
          { id: "</script>", label: "</script>", initials: "<", community: -1, color: "#fff", x: 0, y: 0, r: 10, messages: 5 },
        ],
        links: [],
      })
    );
    // The JSON blob must not contain a literal </script> sequence…
    const dataMatch = html.match(/id="graph-data">([\s\S]*?)<\/script>/);
    expect(dataMatch).toBeTruthy();
    expect(dataMatch![1]).not.toContain("</script>");
    // …and must parse back to the original payload object.
    const parsed = JSON.parse(dataMatch![1]);
    expect(parsed.nodes[0].id).toBe("</script>");
  });

  it("escapes chat-derived strings in generated HTML attributes", () => {
    const html = buildConnectionWebHtml(
      makePayload({
        meta: {
          title: '<img src=x onerror=alert(1)> "quotes" & co',
          generatedAt: 1_700_000_000_000,
          rangeLabel: "2024 · <b>bold</b>",
          messages: 5,
          members: 1,
          days: 10,
        },
        communities: [{ id: 0, name: 'C<script>"', color: "#fff", memberCount: 1 }],
      })
    );
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).not.toContain('C<script>');
  });

  it("notes the caps in the footer when content is trimmed", () => {
    // Large payload → builder will trim; expect the showing-top-of-N note.
    const nodes = Array.from({ length: EXPORT_NODE_CAP + 5 }, (_, i) => ({
      id: `m${i}`, label: `M${i}`, initials: "M", community: -1, color: "#333",
      x: 0, y: 0, r: 10, messages: i,
    }));
    const html = buildConnectionWebHtml(makePayload({ nodes, links: [] }));
    expect(html).toContain(`showing top ${EXPORT_NODE_CAP} of ${EXPORT_NODE_CAP + 5} members`);

    // Small payload → nothing trimmed, no note.
    const small = buildConnectionWebHtml(makePayload());
    expect(small).not.toContain("showing top");
  });

  it("keeps every link within the remapped node bounds", () => {
    const html = buildConnectionWebHtml(makePayload());
    const data = JSON.parse(html.match(/id="graph-data">([\s\S]*?)<\/script>/)![1]);
    expect(data.links.every((l: { s: number; t: number }) => l.s < data.nodes.length && l.t < data.nodes.length)).toBe(true);
    expect(data.nodes.length).toBe(3);
    expect(data.meta.messages).toBe(12_345);
    expect(data.links[0].aToB).toBe(180);
  });

  it("respects capping inside the builder itself", () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      id: `n${i}`, label: `N${i}`, initials: "N", community: -1, color: "#333",
      x: 0, y: 0, r: 10, messages: i,
    }));
    const html = buildConnectionWebHtml(makePayload({ nodes, links: [] }));
    const data = JSON.parse(html.match(/id="graph-data">([\s\S]*?)<\/script>/)![1]);
    expect(data.nodes.length).toBe(EXPORT_NODE_CAP);
  });
});
