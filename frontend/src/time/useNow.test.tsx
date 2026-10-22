import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useNow', () => {
  it('shares one interval between hook instances and clears it on last unmount', () => {
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const first = renderHook(() => useNow(250));
    const second = renderHook(() => useNow(250));
    expect(setSpy).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(clearSpy).not.toHaveBeenCalled();

    second.unmount();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
