import type { DrawClip } from '../components/DrawLayer';

/** Pages overlap by 6.5% of a page so their straight edges meet. */
const OVERLAP = 0.065;
/** The cover turns on its spine, 3.3% in from the page's left edge. */
const SPINE = 0.033;

export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
  mirrored: boolean;
}

// Where the two pages of an open spread lie in the spread's box, for a page
// width (see .ms-nb-book, .ms-nb-page and .ms-nb-leaf in the stylesheet).
export function pageRects(page: number): { left: PageRect; right: PageRect } {
  const height = page * 1.5;
  const rightX = page - OVERLAP * page;
  // The open cover is its closed slot [rightX, rightX + page] turned around
  // the spine line: x → 2·spine − x.
  const spine = rightX + SPINE * page;
  return {
    right: { x: rightX, y: 0, width: page, height, mirrored: false },
    left: {
      x: 2 * spine - (rightX + page),
      y: 0,
      width: page,
      height,
      mirrored: true,
    },
  };
}

// A clip for the draw layer in the shape of both pages: the paper photo's
// alpha, cut hard at half, so the ink inside keeps its full strength.
export function paperClip(
  paper: HTMLImageElement | null,
  page: number,
): DrawClip {
  let cache: { key: string; mask: HTMLCanvasElement } | null = null;

  const build = (paper: HTMLImageElement, width: number, height: number) => {
    const dpr = window.devicePixelRatio || 1;
    const mask = document.createElement('canvas');
    mask.width = Math.round(width * dpr);
    mask.height = Math.round(height * dpr);
    const ctx = mask.getContext('2d');
    if (!ctx) return null;
    const scale = (width / (page * (2 - OVERLAP))) * dpr;
    for (const r of Object.values(pageRects(page))) {
      ctx.save();
      ctx.scale(scale, scale);
      if (r.mirrored) {
        ctx.translate(r.x + r.width, r.y);
        ctx.scale(-1, 1);
        ctx.drawImage(paper, 0, 0, r.width, r.height);
      } else {
        ctx.drawImage(paper, r.x, r.y, r.width, r.height);
      }
      ctx.restore();
    }
    const pixels = ctx.getImageData(0, 0, mask.width, mask.height);
    const d = pixels.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
    ctx.putImageData(pixels, 0, 0);
    return mask;
  };

  return (ctx, width, height) => {
    // Until the photo is in there is no shape to keep: cut nothing.
    if (!paper?.complete || paper.naturalWidth === 0) return;
    const key = `${width}x${height}`;
    if (cache?.key !== key) {
      const mask = build(paper, width, height);
      if (!mask) return;
      cache = { key, mask };
    }
    ctx.drawImage(cache.mask, 0, 0, width, height);
  };
}
