/**
 * Pure radar-chart geometry. The VibeScore radar sizes its own padding from
 * the axis labels, so no label can ever clip — including future axis renames
 * or longer custom labels.
 *
 * Coordinates: the SVG viewBox is `0 0 size size`; the polygon rim has radius
 * `r` around `center`, and label centers sit `labelR` from the center.
 */

export interface RadarLayout {
  size: number;
  pad: number;
  center: number;
  r: number;
  labelR: number;
}

const DEFAULT_FONT_SIZE = 10;
/** Average advance width of bold uppercase glyphs, as a fraction of font size. */
const BOLD_UPPER_ADVANCE = 0.68;
const LABEL_GAP = 14; // rim → label center distance
const LABEL_PAD_X = 12; // breathing room left/right of the widest label
const LABEL_PAD_Y = 8; // breathing room above/below labels

/**
 * Approximate rendered width of an uppercase label. Deterministic — used both
 * by the layout and by tests to guarantee labels fit inside the viewBox.
 */
export function estimateLabelWidth(
  text: string,
  fontSize = DEFAULT_FONT_SIZE,
  weight = 700,
  letterSpacingPx = 0.5
): number {
  if (!text) return 0;
  const scale = weight >= 600 ? 1 : 0.94;
  return text.length * fontSize * BOLD_UPPER_ADVANCE * scale + Math.max(0, text.length - 1) * letterSpacingPx;
}

/**
 * Build a square radar layout that fits every label fully inside the viewBox.
 * Padding is derived from the labels themselves: the widest label (plus a
 * fixed margin) sets the horizontal padding; the font size sets the vertical.
 */
export function radarLayout(
  labels: string[],
  opts: { r?: number; fontSize?: number } = {}
): RadarLayout {
  const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
  const r = opts.r ?? 78;

  let maxHalfWidth = 0;
  for (const label of labels) {
    maxHalfWidth = Math.max(maxHalfWidth, estimateLabelWidth(label, fontSize) / 2);
  }
  const pad = Math.ceil(Math.max(maxHalfWidth + LABEL_PAD_X, fontSize / 2 + LABEL_PAD_Y));

  const labelR = r + LABEL_GAP;
  const size = 2 * (labelR + pad);
  return { size, pad, center: size / 2, r, labelR };
}

/**
 * Point on axis `idx` of `count` at fraction `frac` of the rim radius.
 * Axis 0 points up; subsequent axes proceed clockwise.
 */
export function axisPoint(
  layout: RadarLayout,
  idx: number,
  count: number,
  frac: number
): [number, number] {
  const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
  const rad = layout.r * frac;
  return [layout.center + Math.cos(angle) * rad, layout.center + Math.sin(angle) * rad];
}

/**
 * Bounding box of the label on axis `idx`. Centered on the label anchor point
 * (which sits at `labelR` from the center, i.e. `frac = labelR / r`).
 */
export function labelBox(
  layout: RadarLayout,
  idx: number,
  count: number,
  text: string,
  fontSize = DEFAULT_FONT_SIZE
): { x: number; y: number; w: number; h: number } {
  const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
  const cx = layout.center + Math.cos(angle) * layout.labelR;
  const cy = layout.center + Math.sin(angle) * layout.labelR;
  const w = estimateLabelWidth(text, fontSize);
  const h = fontSize + 4;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
