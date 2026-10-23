import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deskProps } from '../test/desk';
import { humanize, problemText } from './copy';
import MoonriseLook from './MoonriseLook';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MoonriseLook', () => {
  it('renders inside the scoped .moonrise root', () => {
    const { container } = render(<MoonriseLook {...deskProps()} />);
    expect(container.firstElementChild!.classList.contains('moonrise')).toBe(
      true,
    );
  });

  it('puts the 1337 display in the hero', () => {
    render(<MoonriseLook {...deskProps()} />);
    const hero = screen.getByRole('region', { name: '1337' });
    expect(within(hero).getByRole('img', { name: '1337' })).toBeTruthy();
    expect(within(hero).getByText('TIMER')).toBeTruthy();
  });

  it('says the connection is live', () => {
    render(<MoonriseLook {...deskProps({ status: 'open' })} />);
    expect(screen.getByRole('status').textContent).toBe('Live');
  });

  it('says it is reconnecting', () => {
    render(<MoonriseLook {...deskProps({ status: 'reconnecting' })} />);
    expect(screen.getByRole('status').textContent).toBe('Reconnecting…');
  });

  it('shows the log in the live feed', () => {
    render(
      <MoonriseLook
        {...deskProps({
          lastEventId: 7,
          log: [
            {
              seq: 1,
              id: 7,
              taskId: 'a',
              name: 'tea',
              state: 'running',
              at: '2026-01-01T00:00:00.000Z',
            },
          ],
        })}
      />,
    );
    const feed = within(screen.getByRole('region', { name: 'Live feed' }));
    expect(feed.getByText('#7')).toBeTruthy();
    expect(feed.getByText('tea')).toBeTruthy();
    expect(feed.getByText('Last event #7')).toBeTruthy();
  });

  it('waits for the first event', () => {
    render(<MoonriseLook {...deskProps()} />);
    expect(screen.getByText('Waiting for the first event.')).toBeTruthy();
    expect(screen.getByText('No events yet')).toBeTruthy();
  });

  it('says when nothing is running', () => {
    render(<MoonriseLook {...deskProps()} />);
    expect(screen.getByText('Nothing running')).toBeTruthy();
  });

  it('shows a stream error as an alert', () => {
    render(
      <MoonriseLook {...deskProps({ error: 'Could not reach the server' })} />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Could not reach the server',
    );
  });

  it('links to GitHub in a new tab from the footer', () => {
    render(<MoonriseLook {...deskProps()} />);
    const link = screen.getByRole('link', { name: 'GitHub ↗' });
    expect(link.getAttribute('href')).toBe(
      'https://github.com/auermatew/1337_prep',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('copy', () => {
  it('humanizes seconds', () => {
    expect(humanize(180)).toBe('3m');
    expect(humanize(3725)).toBe('1h 2m 5s');
    expect(humanize(0)).toBe('');
  });

  it('says what went wrong in sentence case', () => {
    expect(problemText({ kind: 'name-required' })).toBe(
      'Give the timer a name of 1 to 100 characters.',
    );
    expect(problemText({ kind: 'seconds-invalid' })).toBe(
      'Seconds must be a whole number from 1 to 86400.',
    );
    expect(
      problemText({ kind: 'server', messages: ['name must be shorter'] }),
    ).toBe('Name must be shorter');
    expect(problemText({ kind: 'unreachable' })).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
    expect(problemText({ kind: 'not-running' })).toBe(
      'This timer already ended.',
    );
  });
});
