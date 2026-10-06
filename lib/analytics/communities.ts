import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import type { MemberProfile, PairStat } from "./pairStats";

/**
 * Community detection over the reply graph (Louvain), plus automatic,
 * trait-based cluster naming — "The Night Owls", "The Meme Lords", etc.
 */

export interface Community {
  id: number;
  name: string;
  members: string[];
  color: string;
  messageCount: number;
  nightRatio: number;
  emojiRate: number;
  avgWords: number;
  /** Average reply speed of members (ms), Infinity when unknown. */
  avgReplyMs: number;
  /** Total exchanges between this community and the rest of the chat. */
  externalExchanges: number;
}

export interface CommunityResult {
  communities: Community[];
  /** sender → community id */
  assignment: Record<string, number>;
}

export const COMMUNITY_COLORS = [
  "#3b82f6", "#a855f7", "#10b981", "#f97316",
  "#f43f5e", "#06b6d4", "#eab308", "#8b5cf6",
];

const NAME_POOL = [
  "The Night Owls",
  "The Meme Lords",
  "The One-Liners",
  "The Quick Draw",
  "The Loud Ones",
  "The Regulars",
  "The Couch Crew",
  "The Wanderers",
  "The Night Shift",
  "The Inner Circle",
];

function pickNames(traits: { nightRatio: number; emojiRate: number; avgWords: number; avgReplyMs: number; messageCount: number }[]): string[] {
  const used = new Set<string>();
  const names: string[] = [];

  for (const t of traits) {
    let preferred: string[];
    if (t.nightRatio >= 0.3) preferred = ["The Night Owls", "The Night Shift"];
    else if (t.emojiRate >= 0.6) preferred = ["The Meme Lords", "The Loud Ones"];
    else if (t.avgWords > 0 && t.avgWords <= 3.5) preferred = ["The One-Liners", "The Regulars"];
    else if (t.avgReplyMs <= 45_000) preferred = ["The Quick Draw", "The Regulars"];
    else if (t.messageCount >= 100) preferred = ["The Loud Ones", "The Regulars"];
    else preferred = ["The Regulars", "The Couch Crew"];

    let chosen = preferred.find((n) => !used.has(n));
    if (!chosen) chosen = NAME_POOL.find((n) => !used.has(n)) ?? "The Regulars";
    used.add(chosen);
    names.push(chosen);
  }
  return names;
}

export function detectCommunities(members: MemberProfile[], pairs: PairStat[]): CommunityResult {
  if (members.length === 0) return { communities: [], assignment: {} };

  // Tiny chats: one community, no detection needed.
  if (members.length <= 2) {
    const c: Community = {
      id: 0,
      name: members.length === 1 ? "The Inner Circle" : "The Dynamic Duo",
      members: members.map((m) => m.sender),
      color: COMMUNITY_COLORS[0],
      messageCount: members.reduce((s, m) => s + m.messageCount, 0),
      nightRatio: members.reduce((s, m) => s + m.nightRatio, 0) / members.length,
      emojiRate: members.reduce((s, m) => s + m.emojiCount, 0) / Math.max(1, members.reduce((s, m) => s + m.messageCount, 0)),
      avgWords: members.reduce((s, m) => s + m.avgWords, 0) / members.length,
      avgReplyMs: avgOf(members.map((m) => m.avgReplyMs)),
      externalExchanges: 0,
    };
    const assignment: Record<string, number> = {};
    for (const m of c.members) assignment[m] = 0;
    return { communities: [c], assignment };
  }

  const graph = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
  for (const m of members) graph.addNode(m.sender, { messageCount: m.messageCount });
  for (const p of pairs) {
    if (p.exchanges > 0 && graph.hasNode(p.a) && graph.hasNode(p.b)) {
      graph.addEdge(p.a, p.b, { weight: p.exchanges });
    }
  }

  let raw: Record<string, number>;
  try {
    raw = louvain(graph, { resolution: 1 });
  } catch {
    raw = {};
    for (const m of members) raw[m.sender] = 0; // degenerate graph fallback
  }

  // Group by raw community, then merge singleton groups into their
  // strongest neighbor community (lurkers with one edge shouldn't be "solo").
  const groups = new Map<number, string[]>();
  for (const m of members) {
    const id = raw[m.sender] ?? 0;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(m.sender);
  }

  const edgeWeight = (from: string[], to: Set<string>): number => {
    let w = 0;
    for (const p of pairs) {
      const aIn = from.includes(p.a);
      const bIn = to.has(p.b);
      if (aIn && bIn) w += p.exchanges;
      else if (to.has(p.a) && from.includes(p.b)) w += p.exchanges;
    }
    return w;
  };

  const groupSets = new Map(Array.from(groups, ([id, arr]) => [id, new Set(arr)]));
  const merged = new Map<number, string[]>();
  const mergedSets = new Map<number, Set<string>>();
  let nextId = 0;

  for (const [id, arr] of groups) {
    if (arr.length > 1) {
      merged.set(nextId, arr);
      mergedSets.set(nextId, groupSets.get(id)!);
      nextId++;
    }
  }
  for (const [id, arr] of groups) {
    if (arr.length <= 1) {
      const sender = arr[0];
      let bestId = -1;
      let bestW = -1;
      for (const [mid, mset] of mergedSets) {
        const w = edgeWeight(arr, mset);
        if (w > bestW) { bestW = w; bestId = mid; }
      }
      if (bestId === -1) {
        // no edges at all: fold into the largest community
        let bestSize = -1;
        for (const [mid, marr] of merged) {
          if (marr.length > bestSize) { bestSize = marr.length; bestId = mid; }
        }
      }
      if (bestId === -1) {
        merged.set(nextId, arr);
        mergedSets.set(nextId, new Set(arr));
        nextId++;
      } else {
        merged.get(bestId)!.push(sender);
        mergedSets.get(bestId)!.add(sender);
      }
      void id;
    }
  }

  // Keep the 8 largest, fold the rest into "The Others" via largest merge target.
  let list = Array.from(merged.entries()).sort((x, y) => y[1].length - x[1].length);
  if (list.length > COMMUNITY_COLORS.length) {
    const keep = list.slice(0, COMMUNITY_COLORS.length - 1);
    const rest = list.slice(COMMUNITY_COLORS.length - 1).flatMap(([, arr]) => arr);
    keep[keep.length - 1][1].push(...rest);
    list = keep;
  }

  const memberBySender = new Map(members.map((m) => [m.sender, m]));
  const traits = list.map(([, arr]) => {
    const ms = arr.map((s) => memberBySender.get(s)!).filter(Boolean);
    const totalMsgs = ms.reduce((s, m) => s + m.messageCount, 0) || 1;
    return {
      nightRatio: ms.reduce((s, m) => s + m.nightRatio * m.messageCount, 0) / totalMsgs,
      emojiRate: ms.reduce((s, m) => s + m.emojiCount, 0) / totalMsgs,
      avgWords: ms.reduce((s, m) => s + m.avgWords * m.messageCount, 0) / totalMsgs,
      avgReplyMs: avgOf(ms.map((m) => m.avgReplyMs)),
      messageCount: totalMsgs,
    };
  });

  const names = pickNames(traits);
  const externalFor = (idx: number): number => {
    const own = new Set(list[idx][1]);
    let w = 0;
    for (const p of pairs) {
      const aIn = own.has(p.a);
      const bIn = own.has(p.b);
      if (aIn !== bIn) w += p.exchanges;
    }
    return w;
  };

  const communities: Community[] = list.map(([id, arr], idx) => {
    const ms = arr.map((s) => memberBySender.get(s)!).filter(Boolean);
    const totalMsgs = ms.reduce((s, m) => s + m.messageCount, 0);
    return {
      id,
      name: names[idx],
      members: [...arr].sort((x, y) => (memberBySender.get(y)?.messageCount ?? 0) - (memberBySender.get(x)?.messageCount ?? 0)),
      color: COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length],
      messageCount: totalMsgs,
      nightRatio: traits[idx].nightRatio,
      emojiRate: traits[idx].emojiRate,
      avgWords: traits[idx].avgWords,
      avgReplyMs: traits[idx].avgReplyMs,
      externalExchanges: externalFor(idx),
    };
  });

  const assignment: Record<string, number> = {};
  for (const c of communities) for (const m of c.members) assignment[m] = c.id;

  return { communities, assignment };
}

function avgOf(values: number[]): number {
  const finite = values.filter((v) => v !== Infinity);
  if (!finite.length) return Infinity;
  return finite.reduce((s, v) => s + v, 0) / finite.length;
}
