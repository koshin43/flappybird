import { describe, expect, it } from 'vitest';
import { BIRDS, SKIES, TUNING, medal, newRun, step, type GameEvent, type Pipe, type Run } from '.';

const SEED = 7;
const FAR: Pipe = { x: 1000, gapTop: 150 };

/** A playing run; by default the bird hovers (speed −0.25 becomes 0 next tick, so y holds). */
const playing = (over: Partial<Run> = {}): Run => ({ ...newRun(SEED), phase: 'playing', speed: -0.25, pipes: [FAR], ...over });

/** Runs a script of ticks: `f` flaps, anything else doesn't. Returns the last run and each tick's events. */
function fly(run: Run, script: string): { run: Run; events: GameEvent[][] } {
  const events: GameEvent[][] = [];
  for (const c of script) {
    const next = step(run, c === 'f');
    run = next.run;
    events.push(next.events);
  }
  return { run, events };
}

/** The first pipe the bird hasn't cleared yet. */
const nextPipe = (run: Run) => run.pipes.find((p) => p.x + TUNING.pipeWidth > TUNING.birdX - TUNING.radius)!;

describe('bird physics', () => {
  it('caps free fall at exactly 5, and a flap sets −4.5 on its tick with no gravity added', () => {
    const fallen = fly(playing({ y: 100, speed: 0 }), '.'.repeat(19)).run;
    expect(fallen.speed).toBe(4.75);
    const capped = fly(fallen, '...').run;
    expect(capped.speed).toBe(5);
    expect(capped.y).toBe(100 + (0.25 * 19 * 20) / 2 + 15);

    expect(step(capped, true)).toEqual({
      run: {
        ...capped,
        tick: capped.tick + 1,
        flapTick: capped.tick + 1,
        speed: -4.5,
        y: capped.y - 4.5,
        distance: capped.distance + 2,
        pipes: [{ ...FAR, x: capped.pipes[0].x - 2 }],
      },
      events: ['flap'],
    });
  });

  it('hovers in ready without moving pipes, then the first flap starts playing on that same tick', () => {
    const fresh = newRun(SEED);
    const waited = fly(fresh, '.'.repeat(500)).run;
    expect(waited).toEqual({ ...fresh, tick: 500, distance: 1000 });

    expect(step(waited, true)).toEqual({
      run: { ...waited, phase: 'playing', tick: 501, flapTick: 501, speed: -4.5, y: 251.5, distance: 1002, pipes: [{ ...fresh.pipes[0], x: 486 }] },
      events: ['flap'],
    });
  });

  it('stops at the ceiling without dying, but a pipe still reaches above the screen', () => {
    expect(step(playing({ y: 14, speed: 0 }), true)).toMatchObject({ run: { phase: 'playing', y: 12, speed: 0 }, events: ['flap'] });
    const underPipe = playing({ y: 14, speed: 0, pipes: [{ x: 52, gapTop: 80 }] });
    expect(step(underPipe, true)).toMatchObject({ run: { phase: 'dying', y: 12 }, events: ['flap', 'hit', 'fall'] });
  });
});

describe('collision', () => {
  // Pipe x is where the pipe ends up after the tick. Exactly 12 away is a graze; a quarter pixel closer is a hit.
  // The diagonal rows catch a box-shaped hitbox: 8.5² + 8.5² > 12² survives, 8.25² + 8.5² < 12² hits.
  it.each([
    ['side', 50, 86, 150, []],
    ['side', 50, 85.75, 150, ['hit', 'fall']],
    ['top pipe lip', 112, 60, 100, []],
    ['top pipe lip', 111.75, 60, 100, ['hit', 'fall']],
    ['bottom pipe lip', 188, 60, 100, []],
    ['bottom pipe lip', 188.25, 60, 100, ['hit', 'fall']],
    ['corner diagonal', 108.5, 82.5, 100, []],
    ['corner diagonal', 108.5, 82.25, 100, ['hit', 'fall']],
    ['clear past the pipe', 50, 10, 150, []],
  ] as const)('%s: y %d, pipe at %d', (_, y, x, gapTop, events) => {
    expect(step(playing({ y, pipes: [{ x: x + 2, gapTop }] }), false).events).toEqual(events);
  });

  it.each([
    ['just above the ground', 386.5, [FAR], 'playing', 387.75, []],
    ['touching the ground', 386.75, [FAR], 'over', 388, ['hit', 'over']],
    ['ground inside a pipe column', 386.75, [{ x: 40, gapTop: 100 }], 'over', 388, ['hit', 'over']],
  ] as const)('%s', (_, y, pipes, phase, landed, events) => {
    expect(step(playing({ y, speed: 1, pipes: [...pipes] }), false)).toMatchObject({ run: { phase, y: landed }, events });
  });

  it('a pipe hit freezes the world, ignores flaps, drops the bird, then ends', () => {
    const hit = step(playing({ y: 111.75, pipes: [{ x: 62, gapTop: 100 }] }), false);
    expect(hit.events).toEqual(['hit', 'fall']);
    const dying = hit.run;

    const fall = fly(dying, 'f'.repeat(80));
    expect(fall.events.flat()).toEqual(['over']);
    expect(fall.run).toMatchObject({ phase: 'over', y: 388, pipes: dying.pipes, distance: dying.distance, flapTick: dying.flapTick });
    expect(fall.run.speed).toBeGreaterThan(0);

    expect(step(fall.run, true)).toEqual({ run: fall.run, events: [] });
  });
});

describe('scoring', () => {
  it.each([
    ['centre crosses the bird', 50, 100, 120, 1, ['score']],
    ['centre already at the bird', 48, 100, 120, 0, []],
    ['scored on the tick of a hit', 50, 100, 95, 1, ['score', 'hit', 'fall']],
  ] as const)('%s', (_, x, gapTop, y, score, events) => {
    expect(step(playing({ y, pipes: [{ x, gapTop }] }), false)).toMatchObject({ run: { score }, events });
  });
});

describe('a long run', () => {
  /** Holds the bird at the centre of the next gap, so the run only ends when asked. Returns every gap seen. */
  function heldRun(seed: number, pipes: number) {
    let run = step(newRun(seed), true).run;
    const gaps = new Map<number, number>();
    while (run.score < pipes) {
      run = step({ ...run, y: nextPipe(run).gapTop + TUNING.gap / 2, speed: -0.25 }, false).run;
      expect(run.phase).toBe('playing');
      const xs = run.pipes.map((p) => p.x);
      expect(xs.slice(1).map((x, i) => x - xs[i])).toEqual(Array(xs.length - 1).fill(TUNING.pipeSpacing));
      expect(xs[0] + TUNING.pipeWidth).toBeGreaterThan(0);
      expect(xs[xs.length - 1] + TUNING.pipeSpacing).toBeGreaterThan(288);
      for (const p of run.pipes) gaps.set(p.x + run.distance, p.gapTop);
    }
    return { run, gaps: [...gaps.values()] };
  }

  it('scores each of 1000 pipes once, keeps them 144 apart, and spans the whole gap range', () => {
    const { run, gaps } = heldRun(SEED, 1000);
    // Pipes entered so far: the 1000 passed, plus those still ahead of the bird.
    expect(gaps.length).toBe(1000 + run.pipes.filter((p) => p.x + TUNING.pipeWidth / 2 > TUNING.birdX).length);
    expect(Math.min(...gaps)).toBe(TUNING.gapTopMin);
    expect(Math.max(...gaps)).toBe(TUNING.gapTopMax);
  });

  it('is reproducible from its seed', () => {
    expect(heldRun(SEED, 30)).toEqual(heldRun(SEED, 30));
    expect(heldRun(SEED + 1, 30).gaps).not.toEqual(heldRun(SEED, 30).gaps);
  });

  it('is flyable with real physics: flapping near the bottom of each gap clears 100 pipes', () => {
    let run = step(newRun(SEED), true).run;
    while (run.phase === 'playing' && run.score < 100) {
      run = step(run, run.y > nextPipe(run).gapTop + TUNING.gap - 25).run;
    }
    expect(run).toMatchObject({ phase: 'playing', score: 100 });
  });

  it('picks every sky and bird across seeds', () => {
    const runs = Array.from({ length: 50 }, (_, seed) => newRun(seed));
    expect(new Set(runs.map((r) => r.sky))).toEqual(new Set(SKIES));
    expect(new Set(runs.map((r) => r.bird))).toEqual(new Set(BIRDS));
  });
});

it.each([
  [0, null],
  [9, null],
  [10, 'bronze'],
  [19, 'bronze'],
  [20, 'silver'],
  [29, 'silver'],
  [30, 'gold'],
  [39, 'gold'],
  [40, 'platinum'],
  [100, 'platinum'],
] as const)('medal for %d is %s', (score, expected) => {
  expect(medal(score)).toBe(expected);
});
