/** The spread is two pages minus their overlap at the spine (6.5%). */
const SPREAD = 2 - 0.065;

// One page's width: the spread fills what the sheet leaves of the screen
// (its 16px margins and its padding: 20px on phones, 32px otherwise), and
// stays under the screen height.
export function pageWidth(
  width = window.innerWidth,
  height = window.innerHeight,
): number {
  const pad = width <= 560 ? 20 : 32;
  const across = Math.floor((width - 32 - 2 * pad) / SPREAD);
  const down = Math.floor((height - 260) / 1.5);
  return Math.max(120, Math.min(400, across, down));
}
