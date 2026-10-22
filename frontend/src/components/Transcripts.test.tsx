import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Transcripts } from './Transcripts';

const NOTE =
  "heads up: these aren't all my sessions, and not every prompt I sent is in here either. exporting everything got a bit much lol. happy to show you the rest in person though :)";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(res: () => Response) {
  const fetch = vi.fn(() => Promise.resolve(res()));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const user = () => userEvent.setup();
// A closed <dialog> has no dialog role, so find it by its label.
const drawer = () => {
  const el = document.querySelector<HTMLElement>(
    'dialog[aria-label="transcripts/"]',
  );
  if (!el) throw new Error('drawer not rendered');
  return el;
};
const openDrawer = () =>
  user().click(screen.getByRole('button', { name: 'TRANSCRIPTS' }));
const openPreview = (row: number) =>
  user().click(
    within(drawer()).getAllByRole('button', { name: 'PREVIEW' })[row],
  );
const closeIn = (dialog: HTMLElement) =>
  user().click(within(dialog).getByRole('button', { name: 'CLOSE' }));

describe('Transcripts', () => {
  it('opens the drawer from the side tab', async () => {
    render(<Transcripts />);
    expect(drawer().hasAttribute('open')).toBe(false);
    await openDrawer();
    expect(drawer().hasAttribute('open')).toBe(true);
    expect(within(drawer()).getByText(NOTE)).toBeTruthy();
    expect(within(drawer()).getAllByRole('listitem')).toHaveLength(3);
  });

  it('lists the three transcripts with download links', async () => {
    render(<Transcripts />);
    await openDrawer();
    const items = within(drawer()).getAllByRole('listitem');
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
    await openDrawer();
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
    await openDrawer();
    await openPreview(2);
    expect(await screen.findByText('COULD NOT LOAD TRANSCRIPT')).toBeTruthy();
  });

  it('keeps the drawer open when the preview closes', async () => {
    stubFetch(() => new Response('text'));
    render(<Transcripts />);
    await openDrawer();
    await openPreview(1);
    const preview = screen.getByRole('dialog', { name: 'backend-planning.md' });
    await closeIn(preview);
    expect(preview.hasAttribute('open')).toBe(false);
    expect(drawer().hasAttribute('open')).toBe(true);
  });

  it('closes the drawer with CLOSE', async () => {
    render(<Transcripts />);
    await openDrawer();
    await closeIn(drawer());
    expect(drawer().hasAttribute('open')).toBe(false);
  });

  it('shows the list again after reopening', async () => {
    stubFetch(() => new Response('text'));
    render(<Transcripts />);
    await openDrawer();
    await openPreview(0);
    await closeIn(
      screen.getByRole('dialog', { name: '1337-design-system.md' }),
    );
    await closeIn(drawer());
    await openDrawer();
    expect(drawer().hasAttribute('open')).toBe(true);
    const open = document.querySelectorAll('dialog[open]');
    expect(open).toHaveLength(1);
  });

  it('stays open when a click lands on the dialog itself', async () => {
    stubFetch(() => new Response('text'));
    render(<Transcripts />);
    await openDrawer();
    await openPreview(0);
    const dialog = screen.getByRole('dialog', {
      name: '1337-design-system.md',
    });
    await user().click(dialog);
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('does not show a previous failure while retrying', async () => {
    let fail = true;
    const fetch = vi.fn(() =>
      fail
        ? Promise.resolve(new Response('', { status: 404 }))
        : new Promise<Response>(() => {}),
    );
    vi.stubGlobal('fetch', fetch);
    render(<Transcripts />);
    await openDrawer();
    await openPreview(0);
    expect(await screen.findByText('COULD NOT LOAD TRANSCRIPT')).toBeTruthy();
    await closeIn(
      screen.getByRole('dialog', { name: '1337-design-system.md' }),
    );
    fail = false;
    await openPreview(0);
    expect(screen.queryByText('COULD NOT LOAD TRANSCRIPT')).toBeNull();
    expect(screen.getByText('LOADING…')).toBeTruthy();
  });
});
