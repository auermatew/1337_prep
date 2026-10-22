import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Transcripts } from './Transcripts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(res: () => Response) {
  const fetch = vi.fn(() => Promise.resolve(res()));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const openPreview = async (row: number) => {
  await userEvent
    .setup()
    .click(screen.getAllByRole('button', { name: 'PREVIEW' })[row]);
};

describe('Transcripts', () => {
  it('lists the three transcripts with download links', () => {
    render(<Transcripts />);
    const items = screen.getAllByRole('listitem');
    expect(
      items.map((li) => li.querySelector('.tr-title')?.textContent),
    ).toEqual([
      '1337 design system',
      'Backend planning',
      'Backend build session',
    ]);
    const link = within(items[1]).getByRole('link', { name: 'DOWNLOAD ↓' });
    expect(link.getAttribute('href')).toBe('/transcripts/backend-planning.md');
    expect(link.getAttribute('download')).toBe('backend-planning.md');
  });

  it('previews a transcript as plain text', async () => {
    const fetch = stubFetch(() => new Response('# Title\n**bold**'));
    render(<Transcripts />);
    await openPreview(0);
    const dialog = screen.getByRole('dialog', {
      name: '1337-design-system.md',
    });
    expect(dialog.hasAttribute('open')).toBe(true);
    const pre = await within(dialog).findByText(/# Title/);
    expect(pre.tagName).toBe('PRE');
    expect(pre.textContent).toBe('# Title\n**bold**');
    expect(fetch).toHaveBeenCalledWith('/transcripts/1337-design-system.md');
  });

  it('shows an error when the transcript cannot load', async () => {
    stubFetch(() => new Response('', { status: 404 }));
    render(<Transcripts />);
    await openPreview(2);
    expect(await screen.findByText('COULD NOT LOAD TRANSCRIPT')).toBeTruthy();
  });

  it('closes with CLOSE', async () => {
    stubFetch(() => new Response('text'));
    render(<Transcripts />);
    await openPreview(1);
    const dialog = screen.getByRole('dialog', { name: 'backend-planning.md' });
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: 'CLOSE' }));
    expect(dialog.hasAttribute('open')).toBe(false);
  });
});
