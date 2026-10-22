import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Notebook } from './Notebook';

afterEach(cleanup);

describe('Notebook', () => {
  it('opens the two notebook pages and closes again', async () => {
    const user = userEvent.setup();
    render(<Notebook />);
    await user.click(screen.getByRole('button', { name: 'NOTES' }));
    const dialog = screen.getByRole('dialog', { name: 'notebook/' });
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
});
