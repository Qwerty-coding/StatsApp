"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Expand, X, Loader2 } from "lucide-react";
import { cardClasses } from "./Cards";
import { buildEmojiStats, type EmojiStatsResult } from "../../lib/analytics/emojiStats";
import { useDebouncedValue } from "../../lib/useDebounced";

/**
 * Emoji Galaxy: each emoji is a glowing planet in 3D space. Size = usage,
 * position = co-usage clustering (close planets are used together).
 * Orbit controls; click a planet for its story.
 */

interface EmojiGalaxyProps {
  messages: { text: string; sender: string; isSystem: boolean; timestamp: number }[];
  isDark: boolean;
  expandable?: boolean;
}

const MAX_EMOJIS = 120;

type EmojiStat = EmojiStatsResult["emojis"][number];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Build the full three.js scene and return a disposer. Kept outside the
 * component body so the init-retry logic (zero-size guard) stays simple.
 */
function initGalaxy(
  mount: HTMLDivElement,
  opts: {
    emojis: EmojiStat[];
    co: Record<string, Record<string, number>>;
    isDark: boolean;
    onReady: () => void;
    onSelect: (stat: EmojiStat) => void;
  }
): () => void {
  const { emojis, co, isDark, onReady, onSelect } = opts;
  const width = Math.max(2, mount.clientWidth);
  const height = Math.max(2, mount.clientHeight);
  const maxCount = emojis[0]?.count ?? 1;

  // --- Scene setup -----------------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000);
  camera.position.set(0, 0, 260);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 80;
  controls.maxDistance = 600;
  controls.enablePan = false;

  const disposables: { dispose(): void }[] = [renderer, controls];

  // Starfield backdrop
  const starGeo = new THREE.BufferGeometry();
  const starCount = 400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 1400;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 900;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 1400;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: isDark ? 0x555566 : 0x9999aa,
    size: 1.4,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  disposables.push(starGeo, starMat);

  // --- Layout: co-occurrence-spring positions ---------------------------
  interface Body { emoji: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }
  const bodies: Body[] = emojis.map((e) => ({
    emoji: e.emoji,
    x: (Math.random() - 0.5) * 300,
    y: (Math.random() - 0.5) * 300,
    z: (Math.random() - 0.5) * 300,
    vx: 0, vy: 0, vz: 0,
  }));
  const byEmoji = new Map(bodies.map((b) => [b.emoji, b]));
  let maxCo = 1;
  for (const row of Object.values(co)) for (const v of Object.values(row)) if (v > maxCo) maxCo = v;

  for (let iter = 0; iter < 150; iter++) {
    // repulsion (all pairs)
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1) { dx = Math.random(); dy = Math.random(); dz = Math.random(); d2 = 1; }
        const f = 9000 / d2;
        const d = Math.sqrt(d2);
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; a.vz -= (dz / d) * f;
        b.vx += (dx / d) * f; b.vy += (dy / d) * f; b.vz += (dz / d) * f;
      }
    }
    // attraction along co-occurrence
    for (const [a, row] of Object.entries(co)) {
      const ba = byEmoji.get(a);
      if (!ba) continue;
      for (const [b, w] of Object.entries(row)) {
        const bb = byEmoji.get(b);
        if (!bb) continue;
        const dx = bb.x - ba.x, dy = bb.y - ba.y, dz = bb.z - ba.z;
        const f = (w / maxCo) * 0.06;
        ba.vx += dx * f; ba.vy += dy * f; ba.vz += dz * f;
        bb.vx -= dx * f; bb.vy -= dy * f; bb.vz -= dz * f;
      }
    }
    // integrate with centering
    for (const bd of bodies) {
      bd.x += bd.vx * 0.02; bd.y += bd.vy * 0.02; bd.z += bd.vz * 0.02;
      bd.vx *= 0.85; bd.vy *= 0.85; bd.vz *= 0.85;
      bd.x *= 0.995; bd.y *= 0.995; bd.z *= 0.995;
    }
  }

  // --- Emoji sprites ----------------------------------------------------
  const spriteGroup = new THREE.Group();
  const pickables: { mesh: THREE.Sprite; stat: EmojiStat }[] = [];

  const canvasCache = new Map<string, THREE.Texture>();
  const textureFor = (emoji: string): THREE.Texture => {
    let tex = canvasCache.get(emoji);
    if (tex) return tex;
    const size = 128;
    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d")!;
    ctx.font = "96px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, size / 2, size / 2 + 6);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    canvasCache.set(emoji, tex);
    return tex;
  };

  for (const e of emojis) {
    const sizeFrac = Math.sqrt(e.count / maxCount);
    const size = 10 + sizeFrac * 26;
    const material = new THREE.SpriteMaterial({
      map: textureFor(e.emoji),
      transparent: true,
      depthWrite: false,
    });
    disposables.push(material);
    const sprite = new THREE.Sprite(material);
    const body = byEmoji.get(e.emoji)!;
    sprite.position.set(body.x, body.y, body.z);
    // The bob animation writes an absolute offset around this base Y — it
    // never accumulates into the layout position.
    sprite.userData = { emoji: e.emoji, baseY: body.y };
    sprite.scale.setScalar(size);
    spriteGroup.add(sprite);
    pickables.push({ mesh: sprite, stat: e });
  }
  scene.add(spriteGroup);
  for (const tex of canvasCache.values()) disposables.push(tex);

  // --- Interaction ------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 5 };
  const pointer = new THREE.Vector2();
  let hovered: THREE.Sprite | null = null;

  const setPointer = (ev: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onMove = (ev: PointerEvent) => {
    setPointer(ev);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(spriteGroup.children);
    const first = hits[0]?.object as THREE.Sprite | undefined;
    if (first !== hovered) {
      if (hovered) hovered.scale.multiplyScalar(1 / 1.18);
      hovered = first ?? null;
      if (hovered) hovered.scale.multiplyScalar(1.18);
      renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
    }
  };

  const onClick = (ev: MouseEvent) => {
    setPointer(ev as unknown as PointerEvent);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(spriteGroup.children);
    const first = hits[0]?.object as THREE.Sprite | undefined;
    if (first) {
      const found = pickables.find((p) => p.mesh === first);
      if (found) onSelect(found.stat);
    }
  };

  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("click", onClick);

  // --- Loop + resize ----------------------------------------------------
  const reduceMotion = prefersReducedMotion();
  let raf = 0;
  let firedReady = false;
  const clock = new THREE.Clock();
  const animate = () => {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    if (!reduceMotion) {
      spriteGroup.rotation.y = t * 0.05;
      for (const p of pickables) {
        const baseY = p.mesh.userData.baseY as number;
        p.mesh.position.y = baseY + Math.sin(t * 1.2 + p.mesh.position.x * 0.05) * 1.5;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    // Signal "ready" on the first actually-rendered frame (not a fake timer).
    if (!firedReady) {
      firedReady = true;
      onReady();
    }
  };
  animate();

  const onResize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w < 2 || h < 2) return; // don't divide by ~0 mid-transition
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(mount);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.domElement.removeEventListener("pointermove", onMove);
    renderer.domElement.removeEventListener("click", onClick);
    controls.dispose();
    for (const d of disposables) d.dispose();
    canvasCache.clear();
    if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
  };
}

export default function EmojiGalaxy({ messages, isDark, expandable = true }: EmojiGalaxyProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<EmojiStat | null>(null);
  const [expanded, setExpanded] = useState(false);
  const debouncedMessages = useDebouncedValue(messages, 300);

  const stats = useMemo(
    () => (debouncedMessages.length ? buildEmojiStats(debouncedMessages as never, 2) : null),
    [debouncedMessages]
  );

  const hasData = !!stats && stats.emojis.length > 0;
  const emojis = useMemo(() => (stats ? stats.emojis.slice(0, MAX_EMOJIS) : []), [stats]);
  const co = useMemo(() => stats?.coOccurrence ?? {}, [stats]);

  // Readiness is keyed to the scene: when the scene rebuilds (data or theme
  // change), ready is false again — derived, no setState-in-effect reset.
  const sceneEpoch = `${emojis.length}-${isDark}`;
  const [readyEpoch, setReadyEpoch] = useState<string | null>(null);
  const ready = readyEpoch === sceneEpoch;

  // Init is gated on the mount actually having size: the expand panel
  // transitions from 0×N, and a 0-size init would make camera.aspect NaN.
  // The ResizeObserver is attached BEFORE the first init attempt, so it
  // triggers the real init as soon as the panel has grown.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || emojis.length === 0) return;

    let cleanup: (() => void) | null = null;
    let disposed = false;

    const tryInit = () => {
      if (disposed || cleanup) return;
      if (mount.clientWidth < 2 || mount.clientHeight < 2) return;
      cleanup = initGalaxy(mount, {
        emojis,
        co,
        isDark,
        onReady: () => setReadyEpoch(sceneEpoch),
        onSelect: (stat) => setSelected(stat),
      });
    };

    const ro = new ResizeObserver(tryInit);
    ro.observe(mount);
    tryInit();

    return () => {
      disposed = true;
      ro.disconnect();
      cleanup?.();
      cleanup = null;
    };
  }, [emojis, co, isDark, sceneEpoch]);

  const fmtDate = (ms: number) =>
    ms ? new Date(ms).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—";

  const totalUses = stats?.emojis.reduce((s, e) => s + e.count, 0) ?? 0;
  const topThree = emojis.slice(0, 3).map((e) => e.emoji).join(" ");

  return (
    <div className={`rounded-2xl border p-6 relative ${cardClasses(isDark)} ${expanded ? "fixed inset-4 z-50" : ""}`}>
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>Emoji Galaxy</h2>
          <p className={`text-xs mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {hasData
              ? `${stats!.emojis.length} emojis · ${totalUses.toLocaleString("en-IN")} uses — closer planets are used together`
              : "No emoji usage yet"}
          </p>
        </div>
        {expandable && hasData && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-pressed={expanded}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isDark ? "bg-white/5 text-zinc-300 hover:bg-white/10" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {expanded ? <><X size={13} /> Collapse</> : <><Expand size={13} /> Expand</>}
          </button>
        )}
      </div>

      <div
        ref={mountRef}
        className="relative w-full rounded-xl overflow-hidden"
        role="img"
        aria-label={hasData
          ? `Emoji Galaxy: ${stats!.emojis.length} emojis; most used: ${topThree}. Size shows frequency, position shows co-usage.`
          : "Emoji Galaxy: no emoji usage in this chat"}
        style={{ height: expanded ? "calc(100% - 60px)" : 420, background: isDark ? "radial-gradient(circle at 50% 40%, #101018 0%, #09090b 70%)" : "radial-gradient(circle at 50% 40%, #eef2ff 0%, #e0e7ff 100%)" }}
      >
        {/* Screen-reader fallback list */}
        {hasData && (
          <ul className="sr-only">
            {emojis.map((e) => (
              <li key={e.emoji}>{e.emoji} used {e.count} times</li>
            ))}
          </ul>
        )}
        {hasData && !ready && (
          <div
            className={`absolute inset-0 flex items-center justify-center gap-2 text-sm pointer-events-none ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            <Loader2 size={14} className="animate-spin" />
            rendering galaxy…
          </div>
        )}
      </div>

      {/* Selected emoji panel */}
      {selected && (
        <div className={`absolute bottom-4 left-4 right-4 max-w-md px-4 py-3 rounded-xl border backdrop-blur-md ${
          isDark ? "bg-[#121214]/95 border-white/10" : "bg-white/95 border-zinc-200 shadow-lg"
        }`}>
          <button
            onClick={() => setSelected(null)}
            className={`absolute top-2 right-2 p-1 rounded-full ${isDark ? "hover:bg-white/10 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"}`}
            aria-label="Close"
          >
            <X size={13} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{selected.emoji}</span>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {selected.count.toLocaleString("en-IN")} uses
              </p>
              <p className={`text-xs truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Top: {selected.users.slice(0, 3).map((u) => u.sender).join(", ") || "—"}
              </p>
              <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                First seen {fmtDate(selected.firstUsed)} · last {fmtDate(selected.lastUsed)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
