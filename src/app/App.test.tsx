import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TUNING, WORLD } from '../game';
import { playFeedback } from '../play/feedback';
import { App } from './App';

vi.mock('../play/feedback', () => ({ playFeedback: vi.fn(), unlockAudio: vi.fn() }));

const KEY = 'flappybird';
const SEED = 1;
const FRAME_MS = 16;
const LIP = { width: TUNING.pipeWidth, height: 26 };

// --- Boundaries: canvas, page visibility, randomness, reduced motion. ---

type Call = [name: string, args: unknown[]];
/** Every call on the visible canvas since the last frame began. */
let frame: Call[] = [];
let framesDrawn = 0;
let hidden = false;
/** The animation clock and the frames waiting for it. */
let now = 0;
const waiting = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

function recordingContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const visible = canvas.width === WORLD.width && canvas.height === WORLD.height;
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_, name: string) => {
      if (name === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return (...args: unknown[]) => {
        if (!visible) return;
        // The sky is drawn first and fills the playfield: a new frame.
        if (name === 'drawImage' && args[3] === WORLD.width && args[4] === WORLD.ground) {
          frame = [];
          framesDrawn++;
        }
        frame.push([name, args]);
      };
    },
    set: () => true,
  });
}

/** What the last frame showed: the bird's height and each pipe's gap. */
function scene() {
  const [, [, birdY]] = frame.findLast(([name]) => name === 'translate')! as [string, number[]];
  const lips = frame
    .filter(([name, a]) => name === 'drawImage' && a[3] === LIP.width && a[4] === LIP.height)
    .map(([, a]) => a as number[]);
  const pipes = lips.filter((_, i) => i % 2 === 0).map(([, x, y]) => ({ x, gapTop: y + LIP.height }));
  return { birdY, pipes };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.clear();
  now = 0;
  waiting.clear();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    waiting.set(nextFrameId, callback);
    return nextFrameId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => waiting.delete(id));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  frame = [];
  framesDrawn = 0;
  hidden = false;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return recordingContext(this);
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:,');
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    (array as Uint32Array)[0] = SEED;
    return array;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(playFeedback).mockClear();
});

// --- Driving the app like a player. ---

/** Moves both clocks on by `ms`, with a screen refresh every `frameMs`. */
function advance(ms: number, frameMs = FRAME_MS) {
  for (let left = ms; left > 0; left -= frameMs) {
    const step = Math.min(frameMs, left);
    act(() => {
      vi.advanceTimersByTime(step);
      now += step;
      const due = [...waiting.values()];
      waiting.clear();
      due.forEach((callback) => callback(now));
    });
  }
}
const key = (code: string, repeat = false) => fireEvent.keyDown(window, { code, repeat });
const tap = () => fireEvent.pointerDown(document.querySelector('canvas')!, { isPrimary: true });
const hide = (to: boolean) => {
  hidden = to;
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
};
/** Focus leaves the window but the page stays visible, as when a phone opens its app switcher. */
const blur = () => act(() => void window.dispatchEvent(new FocusEvent('blur')));
const button = (name: string) => screen.getByRole('button', { name });
const shows = (text: string) => screen.queryByRole('img', { name: text }) !== null;
/** The pixel lettering inside an element, as text. */
const pixels = (el: HTMLElement) =>
  within(el)
    .queryAllByRole('img')
    .map((img) => img.getAttribute('alt'))
    .join(' ');
const score = () => pixels(screen.getByRole('status', { name: 'Score' }));
const gameOver = () => screen.queryByRole('region', { name: 'Game Over' });
const saved = () => JSON.parse(localStorage.getItem(KEY)!);

function frames(until: () => boolean, onFrame = () => {}, limit = 5000) {
  for (let i = 0; i < limit; i++) {
    if (until()) return;
    advance(FRAME_MS);
    onFrame();
  }
  throw new Error('Gave up waiting');
}

/** Flies through gaps by eye: flap when the bird sinks toward the next gap's bottom. */
function flyTo(points: number) {
  frames(
    () => score() === String(points),
    () => {
      const { birdY, pipes } = scene();
      const next = pipes.find((p) => p.x + TUNING.pipeWidth > TUNING.birdX - TUNING.radius)!;
      if (birdY > next.gapTop + 75) key('Space');
    },
  );
}

/** Flaps every frame: up into the ceiling, then into the next pipe. */
const crash = () => frames(() => gameOver() !== null, () => key('Space'));
/** Never flaps: down into the ground. */
const drop = () => frames(() => gameOver() !== null);

function startRun() {
  render(<App />);
  fireEvent.click(button('PLAY'));
  key('Space');
}

const result = (name: 'Score' | 'Best') => pixels(within(gameOver()!).getByLabelText(name));
const cues = () => vi.mocked(playFeedback).mock.calls.flatMap(([c]) => c);

// --- Flows. ---

describe('a whole run', () => {
  it('goes from Title through ten pipes to Game Over and saves the record', () => {
    render(<App />);
    expect(shows('FLAPPY BIRD')).toBe(true);
    fireEvent.click(button('PLAY'));
    expect(shows('GET READY')).toBe(true);
    expect(score()).toBe('0');

    key('Space');
    flyTo(10);
    expect(shows('GET READY')).toBe(false);
    crash();

    expect(result('Score')).toBe('10');
    expect(result('Best')).toBe('10');
    expect(shows('NEW')).toBe(true);
    expect(shows('bronze medal')).toBe(true);
    expect(saved()).toEqual({ best: 10, feedback: true });
    expect(cues().filter((c) => c === 'score')).toHaveLength(10);
    expect(cues().slice(-3)).toEqual(['hit', 'fall', 'over']);
  });

  it.each([30, 1])('keeps a best of %i: no NEW, no write, no medal for one point', (best) => {
    localStorage.setItem(KEY, JSON.stringify({ best, feedback: true }));
    startRun();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    flyTo(1);
    crash();

    expect(result('Score')).toBe('1');
    expect(result('Best')).toBe(String(best));
    expect(shows('NEW')).toBe(false);
    expect(screen.queryByRole('img', { name: /medal/ })).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('ends at once on the ground: hit and over on one tick, no fall', () => {
    startRun();
    drop();
    expect(result('Score')).toBe('0');
    expect(cues().slice(-2)).toEqual(['hit', 'over']);
    expect(cues()).not.toContain('fall');
  });
});

describe('Game Over input', () => {
  it('ignores Space and clicks for 600 ms, then Space starts again with the new best', () => {
    startRun();
    flyTo(1);
    crash();

    key('Space');
    fireEvent.click(button('PLAY AGAIN'));
    advance(550);
    key('Enter');
    expect(button('PLAY AGAIN')).toHaveProperty('disabled', true);
    expect(gameOver()).not.toBeNull();

    advance(50);
    expect(button('PLAY AGAIN')).toHaveProperty('disabled', false);
    key('Space');
    expect(shows('GET READY')).toBe(true);
    expect(score()).toBe('0');

    key('Space');
    drop();
    expect(result('Score')).toBe('0');
    expect(result('Best')).toBe('1');
    expect(shows('NEW')).toBe(false);
    expect(button('PLAY AGAIN')).toHaveProperty('disabled', true);
  });

  it('Menu returns to Title', () => {
    startRun();
    drop();
    advance(600);
    fireEvent.click(button('MENU'));
    expect(shows('FLAPPY BIRD')).toBe(true);
    expect(gameOver()).toBeNull();
  });
});

describe('pause', () => {
  it('a stalled frame moves the run at most 100 ms', () => {
    startRun();
    advance(10 * FRAME_MS);
    const before = scene();
    advance(5000, 5000);
    const moved = before.pipes[0].x - scene().pipes[0].x;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(Math.ceil(100 / TUNING.tickMs) * TUNING.scroll);
  });

  it('freezes a hidden run and resumes it after 3, 2, 1 without a flap or a jump', () => {
    startRun();
    advance(500);
    hide(true);
    expect(shows('PAUSED')).toBe(true);
    const before = scene();
    const drawn = framesDrawn;

    advance(5000);
    hide(false);
    advance(1000);
    expect(framesDrawn).toBe(drawn);
    expect(shows('PAUSED')).toBe(true);

    tap();
    expect(pixels(screen.getByRole('timer'))).toBe('3');
    advance(1000);
    expect(pixels(screen.getByRole('timer'))).toBe('2');
    hide(true);
    expect(shows('PAUSED')).toBe(true);
    hide(false);
    advance(3000);
    expect(shows('PAUSED')).toBe(true);

    tap();
    advance(1000);
    advance(1000);
    expect(pixels(screen.getByRole('timer'))).toBe('1');
    expect(framesDrawn).toBe(drawn);
    advance(1000);
    expect(screen.queryByRole('timer')).toBeNull();

    // A stale clock would fast-forward up to 100 ms (6 ticks, 12 px) on the first frame back.
    advance(2 * FRAME_MS);
    const after = scene();
    expect(before.pipes[0].x - after.pipes[0].x).toBeLessThanOrEqual(2 * TUNING.scroll);
    advance(10 * FRAME_MS);
    expect(scene().birdY).toBeGreaterThan(after.birdY);
  });

  it('pauses on focus loss alone, mid-run and mid-countdown, before the bird can fall', () => {
    startRun();
    advance(500);
    blur();
    expect(shows('PAUSED')).toBe(true);
    const drawn = framesDrawn;
    advance(3000);
    expect(framesDrawn).toBe(drawn);

    tap();
    advance(1000);
    blur();
    expect(shows('PAUSED')).toBe(true);
    advance(3000);
    expect(framesDrawn).toBe(drawn);
  });

  it('does not pause the title or Get Ready, it just stops', () => {
    render(<App />);
    hide(true);
    blur();
    expect(shows('FLAPPY BIRD')).toBe(true);
    hide(false);
    fireEvent.click(button('PLAY'));
    hide(true);
    blur();
    expect(shows('GET READY')).toBe(true);
    hide(false);
    tap();
    advance(500);
    expect(shows('GET READY')).toBe(false);
    expect(shows('PAUSED')).toBe(false);
  });
});

describe('saved data', () => {
  const NOTICE = "Saved data couldn't be read and was reset.";

  it.each([
    ['a negative best', '{"best":-1,"feedback":false}', { best: 0, feedback: false }],
    ['a fractional best', '{"best":2.5,"feedback":true}', { best: 0, feedback: true }],
    ['a text best', '{"best":"7","feedback":true}', { best: 0, feedback: true }],
    ['a text feedback', '{"best":7,"feedback":"no"}', { best: 7, feedback: true }],
    ['a missing field', '{"best":7}', { best: 7, feedback: true }],
    ['an unknown field', '{"best":7,"feedback":false,"coins":3}', { best: 0, feedback: true }],
    ['a list', '[7,false]', { best: 0, feedback: true }],
    ['unparseable JSON', '{"best":7', { best: 0, feedback: true }],
  ])('replaces %s, says so, and writes the result back', (_, raw, replaced) => {
    localStorage.setItem(KEY, raw);
    render(<App />);
    expect(screen.getByRole('alert')).toHaveProperty('textContent', NOTICE);
    expect(saved()).toEqual(replaced);
    expect(screen.getByRole('checkbox', { name: 'Sound and vibration' })).toHaveProperty('checked', replaced.feedback);

    fireEvent.click(button('PLAY'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes a valid save as it is', () => {
    localStorage.setItem(KEY, '{"best":7,"feedback":false}');
    render(<App />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('{"best":7,"feedback":false}');
    expect(screen.getByRole('checkbox', { name: 'Sound and vibration' })).toHaveProperty('checked', false);
  });

  it('says so when the best score cannot be written', () => {
    startRun();
    flyTo(1);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    crash();
    expect(within(gameOver()!).getByRole('alert')).toHaveProperty('textContent', "Couldn't save your best score.");
    expect(result('Best')).toBe('1');
  });
});

describe('sound and vibration', () => {
  it('turned off, stays off after a reload and a run makes no sound', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sound and vibration' }));
    expect(saved()).toEqual({ best: 0, feedback: false });
    unmount();

    render(<App />);
    expect(screen.getByRole('checkbox', { name: 'Sound and vibration' })).toHaveProperty('checked', false);
    fireEvent.click(button('PLAY'));
    key('Space');
    flyTo(1);
    crash();
    expect(playFeedback).not.toHaveBeenCalled();
  });

  it('on, plays a swoosh for each screen change and a chirp for each flap', () => {
    startRun();
    expect(cues()).toEqual(['swoosh']);
    advance(100);
    expect(cues()).toEqual(['swoosh', 'flap']);
  });
});

describe('input edges', () => {
  it('ignores held-key repeats', () => {
    render(<App />);
    fireEvent.click(button('PLAY'));
    key('Space', true);
    key('ArrowUp', true);
    advance(500);
    expect(shows('GET READY')).toBe(true);

    key('ArrowUp');
    advance(100);
    expect(shows('GET READY')).toBe(false);
  });

  it('a tap on Play only starts Get Ready', () => {
    render(<App />);
    const play = button('PLAY');
    fireEvent.pointerDown(play, { isPrimary: true });
    fireEvent.click(play);
    advance(500);
    expect(shows('GET READY')).toBe(true);
  });

  it('a tap on Play again only starts Get Ready', () => {
    startRun();
    drop();
    advance(600);
    const again = button('PLAY AGAIN');
    fireEvent.pointerDown(again, { isPrimary: true });
    fireEvent.click(again);
    advance(500);
    expect(shows('GET READY')).toBe(true);
  });

  it.each(['Space', 'Enter'])('%s on the title only starts Get Ready', (code) => {
    render(<App />);
    key(code);
    expect(shows('GET READY')).toBe(true);
    advance(500);
    expect(shows('GET READY')).toBe(true);
  });
});
