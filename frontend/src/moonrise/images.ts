export const COVER_SRC = '/moonrise/cover.webp';
export const PAPER_SRC = '/moonrise/paper.webp';

/** Everything the notebook shows. */
export const NOTEBOOK_IMAGES = [
  COVER_SRC,
  PAPER_SRC,
  '/notes-1.webp',
  '/notes-2.png',
];

/** A broken or very slow image never holds anything up longer than this. */
const IMAGE_CAP_MS = 6000;

const loaded = new Map<string, Promise<void>>();

function load(src: string): Promise<void> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  const done =
    typeof img.decode === 'function'
      ? img.decode()
      : new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(src));
        });
  return done.then(() => undefined);
}

// Fetch and decode images ahead of time, once each. Resolves when all are
// ready, failed, or after IMAGE_CAP_MS. A failed image is tried again on the
// next call.
export function preloadImages(srcs: readonly string[]): Promise<void> {
  const each = srcs.map((src) => {
    let p = loaded.get(src);
    if (!p) {
      p = load(src).catch(() => {
        loaded.delete(src);
      });
      loaded.set(src, p);
    }
    return p;
  });
  let cap: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.all(each).then(() => undefined),
    new Promise<void>((resolve) => {
      cap = setTimeout(resolve, IMAGE_CAP_MS);
    }),
  ]).finally(() => clearTimeout(cap));
}
