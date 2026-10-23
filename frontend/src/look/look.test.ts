import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOK_KEY, applyLookAttr, readInitialLook, saveLook } from './look';

function at(search: string) {
  window.history.replaceState(null, '', `/${search}`);
}

beforeEach(() => {
  localStorage.clear();
  at('');
  delete document.documentElement.dataset.look;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readInitialLook', () => {
  it('starts classic', () => {
    expect(readInitialLook()).toBe('classic');
  });

  it('remembers a stored moon', () => {
    localStorage.setItem(LOOK_KEY, 'moon');
    expect(readInitialLook()).toBe('moon');
  });

  it('lets the URL win over storage', () => {
    localStorage.setItem(LOOK_KEY, 'moon');
    at('?look=classic');
    expect(readInitialLook()).toBe('classic');
  });

  it('ignores values it does not know', () => {
    at('?look=nope');
    localStorage.setItem(LOOK_KEY, 'sepia');
    expect(readInitialLook()).toBe('classic');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readInitialLook()).toBe('classic');
    expect(() => saveLook('moon')).not.toThrow();
    expect(document.documentElement.dataset.look).toBe('moon');
  });
});

describe('saveLook', () => {
  it('stores the look and rewrites a look param in the URL', () => {
    at('?look=classic&x=1');
    saveLook('moon');
    expect(localStorage.getItem(LOOK_KEY)).toBe('moon');
    expect(window.location.search).toBe('?look=moon&x=1');
  });

  it('leaves a URL without a look param alone', () => {
    at('?x=1');
    saveLook('moon');
    expect(window.location.search).toBe('?x=1');
  });

  it('marks the page with the look', () => {
    saveLook('moon');
    expect(document.documentElement.dataset.look).toBe('moon');
    applyLookAttr('classic');
    expect(document.documentElement.dataset.look).toBe('classic');
  });
});
