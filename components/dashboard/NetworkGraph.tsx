"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter,
  type SimulationNodeDatum, type SimulationLinkDatum,
} from "d3-force";
import { ImageDown, Share2, Waypoints } from "lucide-react";
import { cardClasses } from "./Cards";
import type { PairStat, MemberProfile } from "../../lib/analytics/pairStats";
import { detectCommunities, type Community } from "../../lib/analytics/communities";
import { avatarColor, initials } from "../../lib/analytics/text-utils";
import { buildConnectionWebHtml, type GraphExportPayload } from "../../lib/export/graphHtml";

/**
 * Connection Web: people as nodes, replies as edges. Force-directed physics
 * (d3-force) rendered on canvas; Louvain communities color the clusters.
 * Hover an edge for exact stats; drag nodes; pinch/scroll to zoom; export PNG.
 */

interface NetworkGraphProps {
  members: MemberProfile[];
  pairs: PairStat[];
  isDark: boolean;
  minStrength: number; // 0..1 — filter weak edges
  onNodeClick?: (sender: string) => void;
  /** Label of the analyzed window, shown in the exported header. */
  rangeLabel?: string;
  /** Bounds of the analyzed chat, for the exported range note. */
  firstMs?: number;
  lastMs?: number;
}

interface NetNode extends SimulationNodeDatum {
  id: string;
  messageCount: number;
  community: Community | undefined;
  color: string;
}
interface NetLink extends SimulationLinkDatum<NetNode> {
  source: string | NetNode;
  target: string | NetNode;
  pair: PairStat;
}

const EDGE_ALPHA_BASE = 0.18;

export default function NetworkGraph({
  members,
  pairs,
  isDark,
  minStrength,
  onNodeClick,
  rangeLabel = "All-Time",
  firstMs = 0,
  lastMs = 0,
}: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<NetNode>> | null>(null);
  const nodesRef = useRef<NetNode[]>([]);
  const linksRef = useRef<NetLink[]>([]);
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const hoverRef = useRef<{ node: NetNode | null; link: NetLink | null }>({ node: null, link: null });
  const dragRef = useRef<{ node: NetNode | null; panning: boolean; lastX: number; lastY: number }>({
    node: null, panning: false, lastX: 0, lastY: 0,
  });
  const [hoverInfo, setHoverInfo] = useState<{ kind: "node" | "link"; title: string; lines: string[]; color?: string } | null>(null);

  const { communities, assignment } = useMemo(
    () => detectCommunities(members, pairs),
    [members, pairs]
  );
  const communityById = useMemo(() => new Map(communities.map((c) => [c.id, c])), [communities]);

  const maxExchanges = useMemo(() => pairs.reduce((m, p) => Math.max(m, p.exchanges), 1), [pairs]);

  // Links visible under the current strength filter — derived for both the
  // simulation effect and render-time a11y labels (refs can't be read during render).
  const visibleLinks = useMemo(
    () => pairs.filter((p) => p.exchanges >= minStrength * maxExchanges * 0.15),
    [pairs, minStrength, maxExchanges]
  );

  // Build graph + simulation when data or filter changes
  useEffect(() => {
    if (members.length === 0) return;

    const nodes: NetNode[] = members.map((m) => ({
      id: m.sender,
      messageCount: m.messageCount,
      community: communityById.get(assignment[m.sender] ?? -1),
      color: communityById.get(assignment[m.sender] ?? -1)?.color ?? avatarColor(m.sender),
    }));
    const links: NetLink[] = visibleLinks.map((p) => ({ source: p.a, target: p.b, pair: p }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation<NetNode>(nodes)
      .force("link", forceLink<NetNode, NetLink>(links).id((d) => d.id)
        .distance((l) => 220 - (l.pair.exchanges / maxExchanges) * 140)
        .strength((l) => 0.25 + (l.pair.exchanges / maxExchanges) * 0.55))
      .force("charge", forceManyBody<NetNode>().strength(-700))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<NetNode>((d) => 16 + Math.sqrt(d.messageCount) * 1.6))
      .stop();

    // Pre-warm synchronously so the first frame is already spread out
    const W = wrapRef.current?.clientWidth ?? 800;
    const H = wrapRef.current?.clientHeight ?? 480;
    nodes.forEach((n, i) => {
      n.x = W / 2 + Math.cos(i * 2.4) * (120 + (i % 3) * 40);
      n.y = H / 2 + Math.sin(i * 2.4) * (120 + (i % 3) * 40);
    });
    sim.tick(120).on("tick", () => { /* render loop handles drawing */ });
    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [members, pairs, visibleLinks, maxExchanges, communityById, assignment]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || members.length === 0) return;
    let raf = 0;
    let lastSettleCheck = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const { k, x, y } = transformRef.current;
      ctx.save();
      ctx.translate(W / 2 + x, H / 2 + y);
      ctx.scale(k, k);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const hover = hoverRef.current;

      // Edges
      for (const l of links) {
        const s = l.source as NetNode;
        const t = l.target as NetNode;
        if (s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) continue;
        const strength = l.pair.exchanges / maxExchanges;
        const isHover = hover.link === l;
        const dimmed = hover.node && s !== hover.node && t !== hover.node;
        ctx.strokeStyle = isHover ? "#3b82f6" : isDark ? "#ffffff" : "#09090b";
        ctx.globalAlpha = isHover ? 0.95 : dimmed ? EDGE_ALPHA_BASE * 0.35 : EDGE_ALPHA_BASE + strength * 0.65;
        ctx.lineWidth = isHover ? 2.5 : 0.75 + strength * 3.25;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Nodes
      for (const n of nodes) {
        if (n.x === undefined || n.y === undefined) continue;
        const r = 14 + Math.sqrt(n.messageCount) * 1.5;
        const isHover = hover.node === n;
        const dimmed = hover.node && hover.node !== n && !linksRef.current.some(
          (l) => (l.source === n && l.target === hover.node) || (l.target === n && l.source === hover.node)
        );

        ctx.globalAlpha = dimmed ? 0.25 : 1;
        // Community glow ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + (isHover ? 6 : 3), 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = dimmed ? 0.12 : isHover ? 0.45 : 0.25;
        ctx.fill();
        ctx.globalAlpha = dimmed ? 0.25 : 1;

        // Body
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#121214" : "#ffffff";
        ctx.fill();
        ctx.lineWidth = isHover ? 3 : 2;
        ctx.strokeStyle = n.color;
        ctx.stroke();

        // Initials
        ctx.fillStyle = isDark ? "#e4e4e7" : "#18181b";
        ctx.font = `600 ${Math.max(9, r * 0.62)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials(n.id), n.x, n.y + 0.5);

        // Name label under node
        ctx.fillStyle = isDark ? "rgba(228,228,231,0.75)" : "rgba(24,24,27,0.7)";
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText(n.id.length > 14 ? `${n.id.slice(0, 13)}…` : n.id, n.x, n.y + r + 12);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // Settle detection — stop the simulation once physics is calm (stop()
      // is idempotent, and drag restarts it via alphaTarget). The badge fades
      // itself out via CSS, so no React state is involved.
      if (now - lastSettleCheck > 500) {
        lastSettleCheck = now;
        const sim = simRef.current;
        if (sim && nodes.length > 0) {
          const vx = nodes.reduce((s, n) => s + Math.abs(n.vx ?? 0), 0) / nodes.length;
          if (vx < 0.02) sim.stop();
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isDark, maxExchanges, members.length]);

  // Hit-testing
  const pickNode = (clientX: number, clientY: number): NetNode | null => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return null;
    const rect = canvas.getBoundingClientRect();
    const { k, x, y } = transformRef.current;
    const mx = (clientX - rect.left - (rect.width / 2 + x)) / k;
    const my = (clientY - rect.top - (rect.height / 2 + y)) / k;
    let best: NetNode | null = null;
    let bestD = Infinity;
    for (const n of nodesRef.current) {
      if (n.x === undefined || n.y === undefined) continue;
      const r = 14 + Math.sqrt(n.messageCount) * 1.5 + 4;
      const d = (mx - n.x) ** 2 + (my - n.y) ** 2;
      if (d < r * r && d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  const pickLink = (clientX: number, clientY: number): NetLink | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { k, x, y } = transformRef.current;
    const mx = (clientX - rect.left - (rect.width / 2 + x)) / k;
    const my = (clientY - rect.top - (rect.height / 2 + y)) / k;

    let best: NetLink | null = null;
    let bestD = 12; // px tolerance
    for (const l of linksRef.current) {
      const s = l.source as NetNode;
      const t = l.target as NetNode;
      if (s.x === undefined || t.x === undefined) continue;
      const dx = t.x - s.x;
      const dy = (t.y ?? 0) - (s.y ?? 0);
      const len2 = dx * dx + dy * dy;
      if (!len2) continue;
      const u = Math.max(0, Math.min(1, ((mx - s.x) * dx + (my - (s.y ?? 0)) * dy) / len2));
      const px = s.x + u * dx;
      const py = (s.y ?? 0) + u * dy;
      const d = Math.hypot(mx - px, my - py);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  };

  const fmtMs = (ms: number) =>
    ms === Infinity ? "—" :
    ms < 60_000 ? `${Math.round(ms / 1000)}s` :
    ms < 3_600_000 ? `${Math.round(ms / 60_000)}m` :
    `${(ms / 3_600_000).toFixed(1)}h`;

  const downPosRef = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    downPosRef.current = { x: e.clientX, y: e.clientY };
    const node = pickNode(e.clientX, e.clientY);
    if (node) {
      dragRef.current = { node, panning: false, lastX: e.clientX, lastY: e.clientY };
      simRef.current?.alphaTarget(0.15).restart();
    } else {
      dragRef.current = { node: null, panning: true, lastX: e.clientX, lastY: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag?.node) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { k, x, y } = transformRef.current;
      drag.node.fx = (e.clientX - rect.left - (rect.width / 2 + x)) / k;
      drag.node.fy = (e.clientY - rect.top - (rect.height / 2 + y)) / k;
      return;
    }
    if (drag?.panning) {
      transformRef.current.x += e.clientX - drag.lastX;
      transformRef.current.y += e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      return;
    }
    // Hover
    const node = pickNode(e.clientX, e.clientY);
    const link = node ? null : pickLink(e.clientX, e.clientY);
    hoverRef.current = { node, link };
    canvasRef.current!.style.cursor = node ? "grab" : link ? "pointer" : "default";

    if (node) {
      setHoverInfo({
        kind: "node",
        title: node.id,
        color: node.color,
        lines: [
          `${node.messageCount.toLocaleString("en-IN")} messages`,
          node.community ? `${node.community.name} · ${(node.community.nightRatio * 100).toFixed(0)}% night texts` : "",
        ].filter(Boolean),
      });
    } else if (link) {
      const p = link.pair;
      setHoverInfo({
        kind: "link",
        title: `${p.a} ⇄ ${p.b}`,
        lines: [
          `${p.exchanges.toLocaleString("en-IN")} exchanges (${p.fastExchanges} rapid)`,
          `avg reply ${fmtMs(p.avgReplyMs)} · median ${fmtMs(p.medianReplyMs)}`,
          `${p.a} → ${p.b}: ${p.bToA.replies} replies · ${fmtMs(p.bToA.avgMs)}`,
          `${p.b} → ${p.a}: ${p.aToB.replies} replies · ${fmtMs(p.aToB.avgMs)}`,
        ],
      });
    } else {
      setHoverInfo(null);
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag?.node) {
      drag.node.fx = undefined;
      drag.node.fy = undefined;
      simRef.current?.alphaTarget(0);
    }
    dragRef.current = { node: null, panning: false, lastX: 0, lastY: 0 };
  };

  const onClick = (e: React.MouseEvent) => {
    // Suppress click if it was a drag/pan (moved more than a few px)
    const moved = Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y);
    if (moved > 5) return;
    const node = pickNode(e.clientX, e.clientY);
    if (node && onNodeClick) onNodeClick(node.id);
  };

  // Native non-passive wheel listener: React's synthetic onWheel is passive
  // at the root, so preventDefault() there can't stop the page from scrolling.
  // Zoom is anchored at the cursor: the world point under the pointer stays
  // fixed while k changes → translate' = mouse − center − k′ · world.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { k, x, y } = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const wx = (mx - x) / k;
      const wy = (my - y) / k;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const k2 = Math.max(0.35, Math.min(4, k * factor));
      transformRef.current = { k: k2, x: mx - k2 * wx, y: my - k2 * wy };
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const exportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "vibecheck-connections.png";
      a.click();
    } catch (err) {
      console.error("Network export failed", err);
    }
  };

  // Flagship export: a single HTML file a friend can open offline and explore
  // — drag, zoom, hover for exact stats. Embeds the settled layout.
  const exportHtml = () => {
    if (!members.length) return;
    const nodes: GraphExportPayload["nodes"] = nodesRef.current.map((n) => ({
      id: n.id,
      label: n.id,
      initials: initials(n.id),
      community: n.community ? communities.findIndex((c) => c.id === n.community?.id) : -1,
      color: n.color,
      x: Math.round(n.x ?? 0),
      y: Math.round(n.y ?? 0),
      r: Math.round(14 + Math.sqrt(n.messageCount) * 1.5),
      messages: n.messageCount,
    }));
    const nodeIndex = new Map(nodesRef.current.map((n, i) => [n.id, i]));
    const links: GraphExportPayload["links"] = visibleLinks.map((p) => {
      const a = nodeIndex.get(p.a) ?? 0;
      const b = nodeIndex.get(p.b) ?? 0;
      return {
        s: a,
        t: b,
        exchanges: p.exchanges,
        fast: p.fastExchanges,
        avgMs: p.avgReplyMs,
        medianMs: p.medianReplyMs,
        aToB: p.bToA.replies, // bToA stat: b replied after a
        bToA: p.aToB.replies, // aToB stat: a replied after b
      };
    });
    const payload: GraphExportPayload = {
      meta: {
        title: "VibeCheck — Connection Web",
        generatedAt: Date.now(),
        rangeLabel,
        messages: members.reduce((s, m) => s + m.messageCount, 0),
        members: members.length,
        days: firstMs && lastMs ? Math.max(1, Math.round((lastMs - firstMs) / 86_400_000)) : 0,
      },
      communities: communities.map((c, i) => ({
        id: i,
        name: c.name,
        color: c.color,
        memberCount: c.members.length,
      })),
      nodes,
      links,
    };
    try {
      const blob = new Blob([buildConnectionWebHtml(payload)], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vibecheck-connections.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (err) {
      console.error("HTML export failed", err);
    }
  };

  if (members.length === 0) {
    // (empty state rendered below; module-level guards keep hooks safe)
    return (
      <div className={`rounded-2xl border p-6 ${cardClasses(isDark)}`}>
        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Connection Web</h2>
        <p className={`text-xs mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Who actually talks to whom — drag nodes, hover edges, scroll to zoom
        </p>
        <div
          className="relative w-full rounded-xl flex flex-col items-center justify-center text-center mt-3"
          style={{ height: 480, background: isDark ? "#0d0d10" : "#fafafa" }}
        >
          <Waypoints size={28} className={`mb-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} aria-hidden />
          <p className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Not enough connections yet
          </p>
          <p className={`text-xs mt-1 max-w-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            The web draws itself from replies between people. This selection has no
            back-and-forth yet — widen the time window or pick a livelier era in the Time Machine.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-6 ${cardClasses(isDark)}`}>
      <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Connection Web</h2>
          <p className={`text-xs mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Who actually talks to whom — drag nodes, hover edges, scroll to zoom
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPng}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isDark ? "bg-white/5 text-zinc-300 hover:bg-white/10" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <ImageDown size={13} />
            PNG
          </button>
          <button
            onClick={exportHtml}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isDark
                ? "bg-[#3b82f6]/15 text-blue-400 hover:bg-[#3b82f6]/25"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }`}
          >
            <Share2 size={13} />
            Share HTML
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {communities.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
            <span className={`text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
              {c.name}
              <span className={`ml-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({c.members.length})</span>
            </span>
          </div>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative w-full rounded-xl overflow-hidden touch-none"
        style={{ height: 480, background: isDark ? "#0d0d10" : "#fafafa" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { hoverRef.current = { node: null, link: null }; setHoverInfo(null); onPointerUp(); }}
          onClick={onClick}
          role="img"
          aria-label={`Connection Web: ${members.length} members, ${communities.length} communities, ${visibleLinks.length} connections`}
        />
        {/* Screen-reader fallback for the canvas */}
        <ul className="sr-only">
          {communities.map((c) => (
            <li key={c.id}>{c.name}: {c.members.join(", ")}</li>
          ))}
          {members.map((m) => (
            <li key={m.sender}>{m.sender}: {m.messageCount.toLocaleString("en-IN")} messages</li>
          ))}
        </ul>

        {/* Hover tooltip */}
        {hoverInfo && (
          <div
            className={`absolute top-3 left-3 max-w-[280px] px-3.5 py-2.5 rounded-xl border text-xs backdrop-blur-md pointer-events-none ${
              isDark ? "bg-[#121214]/95 border-white/10" : "bg-white/95 border-zinc-200 shadow-lg"
            }`}
          >
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              {hoverInfo.color && <span className="w-2 h-2 rounded-full" style={{ background: hoverInfo.color }} />}
              <span className={isDark ? "text-white" : "text-zinc-900"}>{hoverInfo.title}</span>
            </p>
            {hoverInfo.lines.map((line, i) => (
              <p key={i} className={isDark ? "text-zinc-400" : "text-zinc-500"}>{line}</p>
            ))}
          </div>
        )}

        <div
          className={`absolute bottom-3 right-3 text-[10px] px-2 py-1 rounded-full pointer-events-none ${
            isDark ? "bg-white/5 text-zinc-500" : "bg-black/5 text-zinc-400"
          }`}
          style={{ animation: "settle-fade 3.2s ease-out forwards" }}
        >
          settling physics…
        </div>
        <style>{`@keyframes settle-fade { 0%, 55% { opacity: 1 } 100% { opacity: 0 } }`}</style>
      </div>
    </div>
  );
}
