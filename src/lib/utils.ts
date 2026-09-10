import type { Compensation } from './types';

/** Clamp into 0..1 so every signal is on the same scale before weighting. */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / 86_400_000;
}

export function formatCompensation(c: Compensation): string {
  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: c.currency,
    maximumFractionDigits: 0
  });
  const range = c.min === c.max ? fmt.format(c.min) : `${fmt.format(c.min)}–${fmt.format(c.max)}`;
  return `${range}/${c.period}`;
}

export function relativeTime(date: string | Date): string {
  const days = Math.round(daysBetween(date));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(days) < 30) return rtf.format(-days, 'day');
  return rtf.format(-Math.round(days / 30), 'month');
}

/** Sortable, collision-resistant id. Good enough without pulling in a ULID dep. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const suffix = [...rand].map((b) => b.toString(36).padStart(2, '0')).join('');
  return `${prefix}_${time}${suffix}`;
}
