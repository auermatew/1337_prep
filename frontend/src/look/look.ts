// Which look the page wears: the classic 1337 desk or the Moonrise night.
// "Look", not "theme": data-theme already means light/dark in the classic
// tokens. index.html repeats readInitialLook() inline so the page never
// flashes the wrong ground before the bundle runs.
export type Look = 'classic' | 'moon';

export const LOOK_KEY = '1337.look';

const isLook = (v: unknown): v is Look => v === 'classic' || v === 'moon';

export function readInitialLook(): Look {
  const fromUrl = new URLSearchParams(window.location.search).get('look');
  if (isLook(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(LOOK_KEY);
    if (isLook(stored)) return stored;
  } catch {
    // storage blocked (private mode): fall through
  }
  return 'classic';
}

export function applyLookAttr(look: Look): void {
  document.documentElement.dataset.look = look;
}

// Called by an actual switch only: a ?look= link alone is not remembered.
export function saveLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {
    // storage blocked: the switch still happens for this visit
  }
  const url = new URL(window.location.href);
  if (url.searchParams.has('look')) {
    url.searchParams.set('look', look);
    window.history.replaceState(window.history.state, '', url);
  }
  applyLookAttr(look);
}
