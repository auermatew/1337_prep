import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOK_KEY } from './look';
import { STALL_MS, TIMING, holdMs } from './timing';
import { useLookSwitch } from './useLookSwitch';

vi.mock('./loadMoonrise', () => ({
  loadMoonrise: vi.fn(),
  preloadMoonrise: vi.fn(),
  isMoonriseReady: vi.fn(() => false),
}));
import { isMoonriseReady, loadMoonrise } from './loadMoonrise';

vi.mock('./reload', () => ({ reloadInto: vi.fn() }));
import { reloadInto } from './reload';

const mockLoad = vi.mocked(loadMoonrise);
const mockReady = vi.mocked(isMoonriseReady);
const T = TIMING.full;
type Mod = Awaited<ReturnType<typeof loadMoonrise>>;
const MOD = { default: () => null } as unknown as Mod;
const origin = { x: 10, y: 20 };

async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  mockLoad.mockResolvedValue(MOD);
  mockReady.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useLookSwitch', () => {
  it('starts idle on the classic look', () => {
    const { result } = renderHook(() => useLookSwitch());
    expect(result.current.shown).toBe('classic');
    expect(result.current.phase).toBe('idle');
  });

  it('covers, boots, locks in and reveals the moon', async () => {
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    expect(result.current.phase).toBe('cover');
    expect(result.current.origin).toEqual(origin);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    await wait(T.moonCover);
    expect(result.current.phase).toBe('boot');
    // The lock-in overlaps the end of the hold, so 1337 locks at moonHold.
    expect(holdMs(T, false)).toBe(T.moonHold - T.lock);
    await wait(holdMs(T, false) - 1);
    expect(result.current.phase).toBe('boot');
    await wait(1);
    expect(result.current.phase).toBe('lock');
    expect(result.current.shown).toBe('classic');
    await wait(T.lock);
    expect(result.current.phase).toBe('reveal');
    expect(result.current.shown).toBe('moon');
    expect(localStorage.getItem(LOOK_KEY)).toBe('moon');
    expect(document.documentElement.dataset.look).toBe('moon');
    await wait(T.moonReveal);
    expect(result.current.phase).toBe('idle');
  });

  it('boots for only a moment when everything is cached', async () => {
    mockReady.mockReturnValue(true);
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    await wait(T.moonCover);
    expect(holdMs(T, true)).toBe(0);
    await wait(0);
    expect(result.current.phase).toBe('lock');
  });

  it('waits in the boot for a slow load', async () => {
    let resolve!: (m: Mod) => void;
    mockLoad.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    await wait(T.moonCover);
    await wait(holdMs(T, false) + 3000);
    expect(result.current.phase).toBe('boot');
    await act(async () => resolve(MOD));
    expect(result.current.phase).toBe('lock');
  });

  it('tries again by reloading into the night', async () => {
    mockLoad.mockRejectedValue(new Error('chunk'));
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    await wait(T.moonCover);
    expect(result.current.phase).toBe('failed');
    act(() => result.current.retry());
    expect(vi.mocked(reloadInto)).toHaveBeenCalledWith('moon');
  });

  it('gives up on a stalled download', async () => {
    mockLoad.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    await wait(T.moonCover);
    await wait(STALL_MS - 1);
    expect(result.current.phase).toBe('boot');
    await wait(1);
    expect(result.current.phase).toBe('failed');
  });

  it('fails and goes back to classic', async () => {
    mockLoad.mockRejectedValue(new Error('chunk'));
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    await wait(T.moonCover);
    expect(result.current.phase).toBe('failed');
    act(() => result.current.back());
    expect(result.current.phase).toBe('uncover');
    expect(result.current.shown).toBe('classic');
    expect(localStorage.getItem(LOOK_KEY)).toBe('classic');
    await wait(T.uncover);
    expect(result.current.phase).toBe('idle');
  });

  it('ignores clicks while switching', async () => {
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    act(() => result.current.switchTo('moon', { x: 0, y: 0 }));
    act(() => result.current.switchTo('classic', { x: 0, y: 0 }));
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(result.current.origin).toEqual(origin);
    expect(result.current.target).toBe('moon');
  });

  it('switches back to classic behind a paper cover', async () => {
    const { result } = renderHook(() => useLookSwitch());
    act(() => result.current.switchTo('moon', origin));
    await wait(T.moonCover);
    await wait(holdMs(T, false));
    await wait(T.lock);
    await wait(T.moonReveal);
    act(() => result.current.switchTo('classic', origin));
    expect(result.current.phase).toBe('cover');
    expect(result.current.target).toBe('classic');
    await wait(T.classicCover);
    expect(result.current.shown).toBe('classic');
    expect(result.current.phase).toBe('reveal');
    expect(localStorage.getItem(LOOK_KEY)).toBe('classic');
    await wait(T.classicReveal);
    expect(result.current.phase).toBe('idle');
  });

  it('boots straight into a stored moon', async () => {
    localStorage.setItem(LOOK_KEY, 'moon');
    const { result } = renderHook(() => useLookSwitch());
    expect(result.current.shown).toBeNull();
    expect(result.current.phase).toBe('boot');
    expect(document.documentElement.dataset.look).toBe('moon');
    await wait(holdMs(T, false));
    expect(result.current.phase).toBe('lock');
    await wait(T.lock);
    expect(result.current.shown).toBe('moon');
  });

  it('does not remember a ?look= link on its own', async () => {
    window.history.replaceState(null, '', '/?look=moon');
    const { result } = renderHook(() => useLookSwitch());
    await wait(holdMs(T, false));
    await wait(T.lock);
    expect(result.current.shown).toBe('moon');
    expect(localStorage.getItem(LOOK_KEY)).toBeNull();
  });
});
