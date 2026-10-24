import { describe, expect, it } from 'vitest';
import { lowSky, starField } from './stars';

const top = (s: { top: string }) => parseFloat(s.top);

describe('starField', () => {
  it('draws the same sky every time, in the top 70%', () => {
    const sky = starField();
    expect(sky).toHaveLength(140);
    expect(starField()).toEqual(sky);
    for (const s of sky) {
      expect(top(s)).toBeGreaterThanOrEqual(0);
      expect(top(s)).toBeLessThan(70);
    }
  });

  it('keeps the low sky below the default band, edge to edge', () => {
    const low = lowSky();
    expect(low.length).toBeGreaterThan(0);
    for (const s of low) {
      expect(top(s)).toBeGreaterThanOrEqual(70);
      expect(top(s)).toBeLessThan(100);
    }
    // Not just a copy of the top band shifted down.
    const sky = starField();
    expect(low.map((s) => s.left)).not.toEqual(
      sky.slice(0, low.length).map((s) => s.left),
    );
  });
});
