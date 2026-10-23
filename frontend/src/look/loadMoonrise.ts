type MoonriseModule = typeof import('../moonrise/MoonriseLook');

const PHOTOS = ['/moonrise/moon.webp', '/moonrise/clouds.webp'];
const FONTS = ['700 64px Archivo', '400 15px Geist'];
/** Fonts and photos never hold the switch longer than this. */
const EXTRAS_CAP_MS = 8000;

let pending: Promise<MoonriseModule> | null = null;
let ready = false;

const settle = (p: Promise<unknown> | undefined) =>
  (p ?? Promise.resolve()).then(
    () => undefined,
    () => undefined,
  );

function decode(src: string): Promise<unknown> {
  const img = new Image();
  img.src = src;
  return typeof img.decode === 'function' ? img.decode() : Promise.resolve();
}

// The Moonrise chunk (its JS and CSS), its fonts and the hero photos, once.
// Only the chunk can fail the load; fonts and photos are waited for at most
// EXTRAS_CAP_MS and may still pop in. A failed load can be tried again.
export function loadMoonrise(): Promise<MoonriseModule> {
  if (!pending) {
    const photos = Promise.all(PHOTOS.map((src) => settle(decode(src))));
    const load = import('../moonrise/MoonriseLook').then(async (mod) => {
      // The fonts are declared by the chunk's stylesheet, now in the page.
      const fonts = Promise.all(
        FONTS.map((f) => settle(document.fonts?.load(f))),
      );
      let cap: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.all([photos, fonts]),
        new Promise((resolve) => {
          cap = setTimeout(resolve, EXTRAS_CAP_MS);
        }),
      ]);
      clearTimeout(cap);
      ready = true;
      return mod;
    });
    pending = load;
    load.catch(() => {
      if (pending === load) pending = null;
    });
  }
  return pending;
}

/** Start loading early (hover or focus on the moon button). */
export function preloadMoonrise(): void {
  loadMoonrise().catch(() => undefined);
}

/** Chunk, fonts and photos are all here: the switch can be quick. */
export function isMoonriseReady(): boolean {
  return ready;
}
