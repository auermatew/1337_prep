import { moonriseStylesApplied } from './moonriseStyles';

type MoonriseModule = typeof import('../moonrise/MoonriseLook');

const PHOTOS = ['/moonrise/moon-cutout.webp', '/moonrise/clouds.webp'];
const FONTS = ['700 64px Archivo', '400 15px Geist'];
/** Fonts and photos never hold the switch longer than this. */
const EXTRAS_CAP_MS = 8000;

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

// Vite's preload helper skips a stylesheet whose <link> is already in the
// page, failed or not: drop the chunk's links so a later load fetches again.
function dropChunkLinks(): void {
  document
    .querySelectorAll('link[href*="MoonriseLook"]')
    .forEach((link) => link.remove());
}

// Loads a chunk (its JS and CSS), then its fonts and the hero photos, once.
// Only the chunk can fail the load; fonts and photos are waited for at most
// EXTRAS_CAP_MS and may still pop in. After a failure the next load starts
// over. A chunk whose styles did not arrive counts as failed.
export function createMoonriseLoader<M>(
  importer: () => Promise<M>,
  stylesApplied: () => boolean = moonriseStylesApplied,
) {
  let pending: Promise<M> | null = null;
  let ready = false;

  const load = (): Promise<M> => {
    if (!pending) {
      const photos = Promise.all(PHOTOS.map((src) => settle(decode(src))));
      const attempt = importer().then(async (mod) => {
        if (!stylesApplied()) throw new Error('Moonrise styles did not load');
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
      pending = attempt;
      attempt.catch(() => {
        dropChunkLinks();
        if (pending === attempt) pending = null;
      });
    }
    return pending;
  };

  return {
    load,
    /** Start loading early (hover or focus on the moon button). */
    preload: () => void load().catch(() => undefined),
    /** Chunk, fonts and photos are all here: the switch can be quick. */
    isReady: () => ready,
  };
}

const moonrise = createMoonriseLoader<MoonriseModule>(
  () => import('../moonrise/MoonriseLook'),
);

export const loadMoonrise = moonrise.load;
export const preloadMoonrise = moonrise.preload;
export const isMoonriseReady = moonrise.isReady;
