import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Notebook } from './Notebook';

afterEach(cleanup);

describe('Notebook', () => {
  it('opens the notes picture and closes it again', async () => {
    const user = userEvent.setup();
    render(<Notebook />);
    await user.click(screen.getByRole('button', { name: 'NOTES' }));
    const dialog = screen.getByRole('dialog', { name: 'notebook.webp' });
    expect(dialog.hasAttribute('open')).toBe(true);
    const img = within(dialog).getByAltText('Handwritten planning notes');
    expect(img.getAttribute('src')).toBe('/notebook.webp');
    await user.click(within(dialog).getByRole('button', { name: 'CLOSE' }));
    expect(dialog.hasAttribute('open')).toBe(false);
  });
});
