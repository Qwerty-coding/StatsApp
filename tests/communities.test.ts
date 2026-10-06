import { describe, it, expect } from "vitest";
import { detectCommunities } from "../lib/analytics/communities";
import type { MemberProfile, PairStat } from "../lib/analytics/pairStats";

function member(sender: string, messageCount: number, overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    sender, messageCount, avgWords: 5, emojiCount: 0, nightRatio: 0,
    repliesGiven: 0, repliesReceived: 0, avgReplyMs: 60_000,
    ghostCount: 0, longestStreak: 1, firstMessage: 0, lastMessage: 0,
    ...overrides,
  };
}

function pair(a: string, b: string, exchanges: number): PairStat {
  return {
    a: a < b ? a : b, b: a < b ? b : a, exchanges,
    fastExchanges: exchanges, avgReplyMs: 60_000, medianReplyMs: 60_000,
    aToB: { replies: exchanges, avgMs: 60_000 },
    bToA: { replies: exchanges, avgMs: 60_000 },
  };
}

/** Two tight clusters (A/B/C heavy internally, X/Y/Z heavy internally) + a bridge. */
function twoClusterFixtures() {
  const members = ["A", "B", "C", "X", "Y", "Z"].map((n) => member(n, 50));
  const pairs = [
    pair("A", "B", 40), pair("A", "C", 40), pair("B", "C", 40),
    pair("X", "Y", 40), pair("X", "Z", 40), pair("Y", "Z", 40),
    pair("C", "X", 3), // weak bridge
  ];
  return { members, pairs };
}

describe("detectCommunities", () => {
  it("separates two tight clusters", () => {
    const { members, pairs } = twoClusterFixtures();
    const { communities, assignment } = detectCommunities(members, pairs);

    expect(communities.length).toBe(2);
    const set1 = new Set(communities[0].members);
    const sameSide = (a: string, b: string) => set1.has(a) === set1.has(b);
    expect(sameSide("A", "B")).toBe(true);
    expect(sameSide("A", "C")).toBe(true);
    expect(sameSide("X", "Y")).toBe(true);
    expect(sameSide("X", "Z")).toBe(true);
    expect(sameSide("A", "X")).toBe(false);
    // Every member is assigned
    expect(Object.keys(assignment).sort()).toEqual(["A", "B", "C", "X", "Y", "Z"]);
    // Colors are stable and distinct
    expect(communities[0].color).not.toBe(communities[1].color);
  });

  it("folds a lone lurker into the community they talk to most", () => {
    const members = ["A", "B", "Lurk"].map((n) => member(n, 10));
    const pairs = [pair("A", "B", 30), pair("B", "Lurk", 2)];
    const { communities, assignment } = detectCommunities(members, pairs);
    expect(communities.length).toBe(1);
    expect(assignment["Lurk"]).toBe(assignment["B"]);
  });

  it("names night-heavy clusters The Night Owls", () => {
    const { members, pairs } = twoClusterFixtures();
    // Make cluster containing "A" night-heavy
    const night = members.map((m) =>
      ["A", "B", "C"].includes(m.sender) ? { ...m, nightRatio: 0.5 } : m
    );
    const { communities } = detectCommunities(night, pairs);
    const aCommunity = communities.find((c) => c.members.includes("A"))!;
    expect(aCommunity.name).toBe("The Night Owls");
  });

  it("handles empty and single-member chats", () => {
    expect(detectCommunities([], [])).toEqual({ communities: [], assignment: {} });
    const solo = detectCommunities([member("Solo", 5)], []);
    expect(solo.communities).toHaveLength(1);
    expect(solo.communities[0].members).toEqual(["Solo"]);
  });

  it("pairs a two-member chat into The Dynamic Duo", () => {
    const { communities } = detectCommunities([member("A", 5), member("B", 5)], [pair("A", "B", 4)]);
    expect(communities[0].name).toBe("The Dynamic Duo");
  });

  it("produces deterministic results across runs", () => {
    const { members, pairs } = twoClusterFixtures();
    const r1 = detectCommunities(members, pairs);
    const r2 = detectCommunities(members, pairs);
    expect(r1.communities.map((c) => c.members)).toEqual(r2.communities.map((c) => c.members));
    expect(r1.communities.map((c) => c.name)).toEqual(r2.communities.map((c) => c.name));
  });
});
