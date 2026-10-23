import { describe, expect, it } from 'vitest';
import { pageRects } from './paperMask';

describe('pageRects', () => {
  it('places both pages of a 200px spread like the book does', () => {
    const { left, right } = pageRects(200);
    // The right page starts one page minus the 6.5% overlap in.
    expect(right).toEqual({
      x: 187,
      y: 0,
      width: 200,
      height: 300,
      mirrored: false,
    });
    // The cover turns on its spine at 3.3% of the page: the left page is the
    // cover's slot (where the right page lies) mirrored around that line,
    // so it ends where the spine is plus that same 3.3%.
    expect(left.mirrored).toBe(true);
    expect(left.x).toBeCloseTo(0.2);
    expect(left.x + left.width).toBeCloseTo(right.x + 2 * 0.033 * 200);
    expect(left.width).toBe(200);
    expect(left.height).toBe(300);
  });
});
