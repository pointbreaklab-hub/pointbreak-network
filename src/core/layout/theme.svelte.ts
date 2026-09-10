import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';
/** Also read by the pre-paint script in src/app.html — keep in sync. */
const KEY = 'pb.theme';

class ThemeStore {
  current = $state<Theme>('dark');

  constructor() {
    if (!browser) return;
    const stored = localStorage.getItem(KEY) as Theme | null;
    this.current =
      stored ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    this.apply();
  }

  toggle() {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    if (browser) localStorage.setItem(KEY, this.current);
    this.apply();
  }

  private apply() {
    if (browser) document.documentElement.dataset.theme = this.current;
  }
}

export const theme = new ThemeStore();
