import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImages } from './images';

// jsdom loads no images; give it a decode() the tests can steer.
if (typeof HTMLImageElement.prototype.decode !== 'function') {
  HTMLImageElement.prototype.decode = () => Promise.resolve();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('preloadImages', () => {
  it('resolves once every image has decoded', async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockResolvedValue(undefined);
    await preloadImages(['/a.webp', '/b.webp']);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it('loads each image once, however often it is asked for', async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockResolvedValue(undefined);
    await preloadImages(['/once.webp']);
    await preloadImages(['/once.webp']);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('never waits forever on a broken or slow image', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockReturnValue(
      new Promise(() => {}),
    );
    let done = false;
    void preloadImages(['/slow.webp']).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(5999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('tries a failed image again next time', async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValue(undefined);
    await preloadImages(['/flaky.webp']);
    await preloadImages(['/flaky.webp']);
    expect(decode).toHaveBeenCalledTimes(2);
  });
});
