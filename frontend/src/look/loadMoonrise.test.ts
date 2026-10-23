import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMoonriseLoader } from './loadMoonrise';

const MOD = { default: () => null };

afterEach(() => {
  document.head.innerHTML = '';
  vi.useRealTimers();
});

function failedLink(href: string) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

describe('createMoonriseLoader', () => {
  it('imports once for many calls', async () => {
    const importer = vi.fn(() => Promise.resolve(MOD));
    const loader = createMoonriseLoader(importer, () => true);
    await Promise.all([loader.load(), loader.load()]);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(loader.isReady()).toBe(true);
  });

  it('tries the import again after a failure', async () => {
    const importer = vi
      .fn<() => Promise<typeof MOD>>()
      .mockRejectedValueOnce(new Error('chunk'))
      .mockResolvedValue(MOD);
    const loader = createMoonriseLoader(importer, () => true);
    await expect(loader.load()).rejects.toThrow('chunk');
    expect(loader.isReady()).toBe(false);
    await expect(loader.load()).resolves.toBe(MOD);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('drops the failed stylesheet so a later load fetches it again', async () => {
    failedLink('/assets/MoonriseLook-abc123.css');
    failedLink('/assets/index-xyz.css');
    const loader = createMoonriseLoader(() => Promise.reject(new Error('css')));
    await expect(loader.load()).rejects.toThrow();
    const hrefs = [...document.head.querySelectorAll('link')].map((l) =>
      l.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/assets/index-xyz.css']);
  });

  it('fails when the chunk arrives without its styles', async () => {
    // A server that answers a missing stylesheet with index.html (SPA
    // fallback) lets the import resolve with nothing styled.
    failedLink('/assets/MoonriseLook-abc123.css');
    const importer = vi.fn(() => Promise.resolve(MOD));
    const loader = createMoonriseLoader(importer, () => false);
    await expect(loader.load()).rejects.toThrow('styles');
    expect(document.head.querySelector('link')).toBeNull();
    expect(loader.isReady()).toBe(false);
  });

  it('cleans up after a failed preload too', async () => {
    failedLink('/assets/MoonriseLook-abc123.css');
    const loader = createMoonriseLoader(() => Promise.reject(new Error('css')));
    loader.preload();
    await vi.waitFor(() =>
      expect(document.head.querySelector('link')).toBeNull(),
    );
  });

  it('never waits on fonts and photos past the cap', async () => {
    vi.useFakeTimers();
    const fonts = { load: vi.fn(() => new Promise(() => {})) };
    Object.defineProperty(document, 'fonts', {
      value: fonts,
      configurable: true,
    });
    const loader = createMoonriseLoader(
      () => Promise.resolve(MOD),
      () => true,
    );
    let done = false;
    void loader.load().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(7999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    Reflect.deleteProperty(document, 'fonts');
  });
});
