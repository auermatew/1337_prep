import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoonTranscripts } from './Transcripts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(fetchImpl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  const onClose = vi.fn();
  render(<MoonTranscripts open onClose={onClose} />);
  return { onClose, user: userEvent.setup() };
}

describe('MoonTranscripts', () => {
  it('lists the three transcripts with download links', () => {
    setup(() => new Promise(() => {}));
    const list = within(screen.getByRole('dialog', { name: 'Transcripts' }));
    expect(list.getAllByRole('button', { name: 'Preview' })).toHaveLength(3);
    const links = list.getAllByRole('link', { name: 'Download ↓' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/transcripts/1337-design-system.md',
      '/transcripts/backend-planning.md',
      '/transcripts/backend-build.md',
    ]);
    expect(links[0].hasAttribute('download')).toBe(true);
  });

  it('keeps the note verbatim', () => {
    setup(() => new Promise(() => {}));
    expect(
      screen.getByText(/^heads up: these aren't all my sessions/),
    ).toBeTruthy();
  });

  it('previews a transcript on the console screen', async () => {
    const { user } = setup(() =>
      Promise.resolve(new Response('# Planning\nline two')),
    );
    await user.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
    const preview = within(
      screen.getByRole('dialog', { name: 'Backend planning' }),
    );
    const text = await preview.findByText(/# Planning/);
    expect(text.closest('.ms-crt')).not.toBeNull();
    expect(
      preview.getByText('backend-planning.md · 15 KB · 2 lines'),
    ).toBeTruthy();
  });

  it('says when a transcript cannot load', async () => {
    const { user } = setup(() =>
      Promise.resolve(new Response('', { status: 500 })),
    );
    await user.click(screen.getAllByRole('button', { name: 'Preview' })[0]);
    expect(
      await screen.findByText("Couldn't load this transcript."),
    ).toBeTruthy();
  });

  it('keeps the list open when the preview closes', async () => {
    const { user, onClose } = setup(() => new Promise(() => {}));
    await user.click(screen.getAllByRole('button', { name: 'Preview' })[0]);
    const preview = screen.getByRole('dialog', { name: '1337 design system' });
    await user.click(within(preview).getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByRole('dialog', { name: '1337 design system' }),
    ).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Transcripts' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
