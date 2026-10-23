import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useEffect } from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import App from '../App';
import { deskProps, task } from '../test/desk';
import { loadMoonrise } from './loadMoonrise';
import { TIMING } from './timing';

// jsdom does not apply the chunk's CSS; the probe is checked in a browser.
vi.mock('./moonriseStyles', () => ({ moonriseStylesApplied: () => true }));

vi.mock('../stream/useTaskStream', () => ({ useTaskStream: vi.fn() }));
import { useTaskStream } from '../stream/useTaskStream';

const T = TIMING.full;
const TASKS = [task('a', 'running'), task('b', 'finished')];
let mounts = 0;

async function step(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

beforeAll(async () => {
  // Warm the chunk with real timers: the switch below then takes the fast path.
  await loadMoonrise();
});

beforeEach(() => {
  mounts = 0;
  localStorage.clear();
  const { log, status, lastEventId, error, upsert } = deskProps();
  vi.mocked(useTaskStream).mockImplementation(() => {
    useEffect(() => {
      mounts += 1;
    }, []);
    return {
      tasks: TASKS,
      log,
      status,
      lastEventId,
      error,
      upsert,
    };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function toMoon() {
  press('Switch to Moonrise');
  await step(T.moonCover);
  await step(T.fastHold);
  await step(T.lock);
  await step(T.moonReveal);
}

async function toClassic() {
  press('Switch to classic');
  await step(T.classicCover);
  await step(T.classicReveal);
}

describe('the look switch', () => {
  it('puts a moon button on the classic look', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Switch to Moonrise' }),
    ).toBeTruthy();
    expect(document.querySelector('.moonrise')).toBeNull();
  });

  it('turns the page into the Moonrise night', async () => {
    const { container } = render(<App />);
    await toMoon();
    expect(container.querySelector('.moonrise')).not.toBeNull();
    expect(container.querySelector('.top')).toBeNull();
    expect(document.documentElement.dataset.look).toBe('moon');
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('brings the classic desk back', async () => {
    const { container } = render(<App />);
    await toMoon();
    await toClassic();
    expect(container.querySelector('.top')).not.toBeNull();
    expect(container.querySelector('.moonrise')).toBeNull();
    expect(document.documentElement.dataset.look).toBe('classic');
  });

  it('keeps one stream across switches', async () => {
    render(<App />);
    await toMoon();
    await toClassic();
    await toMoon();
    expect(mounts).toBe(1);
  });

  it('says what it is doing to screen readers', async () => {
    render(<App />);
    press('Switch to Moonrise');
    expect(screen.getByText('Switching to Moonrise…')).toBeTruthy();
    await step(T.moonCover);
    await step(T.fastHold);
    await step(T.lock);
    await step(T.moonReveal);
    expect(screen.queryByText('Switching to Moonrise…')).toBeNull();
  });
});
