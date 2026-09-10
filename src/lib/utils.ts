import type { Salary } from './types';

export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export function formatSalary(s: Salary): string {
  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: s.currency,
    maximumFractionDigits: 0
  });
  const range = s.min === s.max ? fmt.format(s.min) : `${fmt.format(s.min)}–${fmt.format(s.max)}`;
  return `${range}/${s.period}`;
}

/**
 * Exact salaries are mandatory, so a "band" wider than 25% of its own midpoint
 * is rejected at submit. That is the range that stops being information and
 * starts being a negotiating position.
 */
export const MAX_SALARY_SPREAD = 0.25;

export function isExactSalary(s: Salary, maxSpread = MAX_SALARY_SPREAD): boolean {
  if (s.min <= 0 || s.max < s.min) return false;
  const midpoint = (s.min + s.max) / 2;
  return (s.max - s.min) / midpoint <= maxSpread;
}

export function relativeTime(date: string | Date): string {
  const days = Math.round(daysBetween(date));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(days) < 30) return rtf.format(-days, 'day');
  return rtf.format(-Math.round(days / 30), 'month');
}

/** Sortable, collision-resistant id. Enough without pulling in a ULID dep. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const suffix = [...rand].map((b) => b.toString(36).padStart(2, '0')).join('');
  return `${prefix}_${time}${suffix}`;
}
