import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Notebook } from './Notebook';

afterEach(cleanup);

const open = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'NOTES' }));
  const dialog = screen.getByRole('dialog', { name: 'notebook/' });
  return { user, dialog };
};

const canvas = (dialog: HTMLElement) =>
  within(dialog).getByLabelText('Drawing layer') as HTMLCanvasElement;

function drawStroke(el: HTMLElement) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 20, clientY: 15 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 30, clientY: 25 });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 30, clientY: 25 });
}

describe('Notebook', () => {
  it('opens the two notebook pages and closes again', async () => {
    render(<Notebook />);
    const { user, dialog } = await open();
    expect(dialog.hasAttribute('open')).toBe(true);
    const pages = within(dialog).getAllByRole('img');
    expect(
      pages.map((p) => [p.getAttribute('alt'), p.getAttribute('src')]),
    ).toEqual([
      ['Notes, page 1', '/notes-1.webp'],
      ['Notes, page 2', '/notes-2.png'],
    ]);
    await user.click(within(dialog).getByRole('button', { name: 'CLOSE' }));
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('records a stroke drawn with the pointer', async () => {
    render(<Notebook />);
    const { dialog } = await open();
    const layer = canvas(dialog);
    expect(layer.dataset.strokes).toBe('0');
    drawStroke(layer);
    expect(layer.dataset.strokes).toBe('1');
    drawStroke(layer);
    expect(layer.dataset.strokes).toBe('2');
  });

  it('clears the drawing with CLEAR', async () => {
    render(<Notebook />);
    const { user, dialog } = await open();
    drawStroke(canvas(dialog));
    await user.click(within(dialog).getByRole('button', { name: 'CLEAR' }));
    expect(canvas(dialog).dataset.strokes).toBe('0');
  });

  it('starts blank again after closing and reopening', async () => {
    render(<Notebook />);
    const { user, dialog } = await open();
    drawStroke(canvas(dialog));
    await user.click(within(dialog).getByRole('button', { name: 'CLOSE' }));
    await user.click(screen.getByRole('button', { name: 'NOTES' }));
    expect(canvas(dialog).dataset.strokes).toBe('0');
  });

  it('switches between pen and scroll', async () => {
    render(<Notebook />);
    const { user, dialog } = await open();
    const paper = dialog.querySelector('.nb-paper') as HTMLElement;
    // jsdom has no matchMedia, so it counts as a wide screen: pen first.
    expect(paper.dataset.mode).toBe('pen');
    await user.click(within(dialog).getByRole('button', { name: 'SCROLL' }));
    expect(paper.dataset.mode).toBe('scroll');
    await user.click(within(dialog).getByRole('button', { name: 'PEN' }));
    expect(paper.dataset.mode).toBe('pen');
  });
});
