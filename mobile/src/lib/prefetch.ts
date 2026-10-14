import { api } from './api';

// Warm the Home screen's data while the boot screen is still up, so the first
// frame of the app renders fully populated (nudge strip, today's plan, quick
// row, explore counts) instead of popping in section by section.
// Single flight - every caller shares one run - and it never rejects, so boot
// is never blocked by a slow or offline API.

let inflight: Promise<void> | null = null;

function today(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function prefetchHome(): Promise<void> {
  if (inflight) return inflight;
  const ds = today();
  inflight = Promise.allSettled([
    api.blocks(ds, ds),
    api.connections(),
    api.getStats(),
    api.qbankGet(),
    api.decksGet(),
  ]).then(() => undefined);
  return inflight;
}

// Resolves when `p` settles or after `ms`, whichever comes first - always resolves.
export function cap(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    p.then(
      () => {
        clearTimeout(t);
        resolve();
      },
      () => {
        clearTimeout(t);
        resolve();
      },
    );
  });
}

// Reveal signal: things that must only appear once the app is actually on
// screen (the notification prompt) wait here instead of racing the boot cover.
let revealNow: () => void = () => {};
const revealed = new Promise<void>((resolve) => {
  revealNow = resolve;
});

export function whenRevealed(): Promise<void> {
  return revealed;
}

export function markRevealed(): void {
  revealNow();
}
