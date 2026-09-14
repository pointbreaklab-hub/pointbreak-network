/**
 * Contrast checking for the user-chosen accent.
 *
 * Letting someone pick any colour means someone will pick pale yellow and get
 * an unreadable page. Rather than refusing the colour, the theme keeps it for
 * large decorative elements and derives a readable variant for text, so the
 * choice is honoured without the result being unusable.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** WCAG AA for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

function darken({ r, g, b }: Rgb, amount: number): Rgb {
  return {
    r: Math.round(r * (1 - amount)),
    g: Math.round(g * (1 - amount)),
    b: Math.round(b * (1 - amount))
  };
}

export function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export interface AccentPalette {
  /** Exactly what the user chose, for blocks and rules. */
  accent: string;
  /** Darkened until it is legible on white, for text and links. */
  readable: string;
  /** True when the two differ, so the UI can explain why. */
  adjusted: boolean;
  /** The chosen colour's ratio against white. This is what failed. */
  originalRatio: number;
  /** The adjusted colour's ratio. This is what passes. */
  ratio: number;
}

export function accentPalette(hex: string): AccentPalette | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  let candidate = rgb;
  const originalRatio = contrastRatio(rgb, WHITE);
  let ratio = originalRatio;
  let adjusted = false;

  // Step down in brightness until it clears AA, rather than rejecting outright.
  for (let step = 0; step < 20 && ratio < MIN_TEXT_CONTRAST; step++) {
    candidate = darken(candidate, 0.12);
    ratio = contrastRatio(candidate, WHITE);
    adjusted = true;
  }

  return {
    accent: toHex(rgb),
    readable: toHex(candidate),
    adjusted,
    originalRatio: Number(originalRatio.toFixed(2)),
    ratio: Number(ratio.toFixed(2))
  };
}
