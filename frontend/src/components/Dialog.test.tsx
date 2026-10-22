import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom runs no CSS animations. Every open Window has an entry animation;
// only the drawer's stylesheet swaps in an exit one while closing.
function withAnimations({ exit }: { exit: boolean }) {
  const real = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if (!(el instanceof HTMLElement) || !el.classList.contains('win')) {
      return style;
    }
    const closing = exit && el.closest('dialog[data-closing]');
    const animationName = closing ? 'dlg-drawer-out' : 'dlg-in';
    return { ...style, animationName } as CSSStyleDeclaration;
  });
}
const withExitAnimation = () => withAnimations({ exit: true });

const dialogEl = () => document.querySelector('dialog') as HTMLDialogElement;
const win = () => dialogEl().querySelector('.win') as HTMLElement;

describe('Dialog', () => {
  it('plays the exit animation before closing', () => {
    withExitAnimation();
    const { rerender } = render(
      <Dialog title="d" open onClose={() => {}}>
        body
      </Dialog>,
    );
    rerender(
      <Dialog title="d" open={false} onClose={() => {}}>
        body
      </Dialog>,
    );
    expect(dialogEl().hasAttribute('open')).toBe(true);
    expect(dialogEl().hasAttribute('data-closing')).toBe(true);
    fireEvent.animationEnd(win());
    expect(dialogEl().hasAttribute('open')).toBe(false);
    expect(dialogEl().hasAttribute('data-closing')).toBe(false);
  });

  it('closes at once when there is no exit animation', () => {
    const { rerender } = render(
      <Dialog title="d" open onClose={() => {}}>
        body
      </Dialog>,
    );
    rerender(
      <Dialog title="d" open={false} onClose={() => {}}>
        body
      </Dialog>,
    );
    expect(dialogEl().hasAttribute('open')).toBe(false);
  });

  it('closes at once when only the entry animation is set', () => {
    withAnimations({ exit: false });
    const { rerender } = render(
      <Dialog title="d" open onClose={() => {}}>
        body
      </Dialog>,
    );
    rerender(
      <Dialog title="d" open={false} onClose={() => {}}>
        body
      </Dialog>,
    );
    expect(dialogEl().hasAttribute('open')).toBe(false);
  });

  it('routes Esc through onClose so it animates too', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="d" open onClose={onClose}>
        body
      </Dialog>,
    );
    const cancel = new Event('cancel', { cancelable: true });
    act(() => {
      dialogEl().dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('takes Esc at keydown so the browser never closes it instantly', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="d" open onClose={onClose}>
        <button type="button">inside</button>
      </Dialog>,
    );
    const key = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      dialogEl().querySelector('button')!.dispatchEvent(key);
    });
    expect(key.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to closing if the animation never ends', () => {
    vi.useFakeTimers();
    withExitAnimation();
    const { rerender } = render(
      <Dialog title="d" open onClose={() => {}}>
        body
      </Dialog>,
    );
    rerender(
      <Dialog title="d" open={false} onClose={() => {}}>
        body
      </Dialog>,
    );
    expect(dialogEl().hasAttribute('open')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(dialogEl().hasAttribute('open')).toBe(false);
    vi.useRealTimers();
  });
});
