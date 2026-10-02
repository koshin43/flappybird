import { pick } from './random';

export type Phase = 'ready' | 'playing' | 'dying' | 'over';
export type Medal = 'bronze' | 'silver' | 'gold' | 'platinum';
export type GameEvent = 'flap' | 'score' | 'hit' | 'fall' | 'over';

export const SKIES = ['day', 'night'] as const;
export const BIRDS = ['yellow', 'blue', 'red'] as const;
export type Sky = (typeof SKIES)[number];
export type BirdColor = (typeof BIRDS)[number];

/** x is the left edge. */
export interface Pipe {
  x: number;
  gapTop: number;
}

export interface Run {
  phase: Phase;
  tick: number;
  /** Tick of the last flap, for the bird's tilt. */
  flapTick: number;
  /** Bird centre. */
  y: number;
  /** px per tick, positive is down. */
  speed: number;
  pipes: Pipe[];
  /** px scrolled, for the ground. */
  distance: number;
  score: number;
  rng: number;
  sky: Sky;
  bird: BirdColor;
}

/** The world in logical pixels; y grows downward. */
export const WORLD = { width: 288, height: 512, ground: 400 } as const;

/** Every number that tunes the feel (spec 3.2). */
export const TUNING = {
  tickMs: 1000 / 60,
  gravity: 0.25,
  flap: -4.5,
  maxFall: 5,
  birdX: 74,
  birdStartY: 256,
  radius: 12,
  pipeWidth: 52,
  gap: 100,
  gapTopMin: 80,
  gapTopMax: 222,
  scroll: 2,
  pipeSpacing: 144,
  firstPipeX: 488,
} as const;

const MEDALS: [Medal, number][] = [
  ['platinum', 40],
  ['gold', 30],
  ['silver', 20],
  ['bronze', 10],
];

export function medal(score: number): Medal | null {
  return MEDALS.find(([, min]) => score >= min)?.[0] ?? null;
}

function gapTop(rng: number): [number, number] {
  const [n, next] = pick(rng, TUNING.gapTopMax - TUNING.gapTopMin + 1);
  return [TUNING.gapTopMin + n, next];
}

export function newRun(seed: number): Run {
  const [sky, r1] = pick(seed >>> 0, SKIES.length);
  const [bird, r2] = pick(r1, BIRDS.length);
  const [top, rng] = gapTop(r2);
  return {
    phase: 'ready',
    tick: 0,
    flapTick: 0,
    y: TUNING.birdStartY,
    speed: 0,
    pipes: [{ x: TUNING.firstPipeX, gapTop: top }],
    distance: 0,
    score: 0,
    rng,
    sky: SKIES[sky],
    bird: BIRDS[bird],
  };
}

const fall = (speed: number) => Math.min(speed + TUNING.gravity, TUNING.maxFall);

/** Whether the bird's circle strictly overlaps the rectangle; touching is a graze. */
function overlaps(y: number, left: number, right: number, top: number, bottom: number): boolean {
  const dx = TUNING.birdX - Math.min(Math.max(TUNING.birdX, left), right);
  const dy = y - Math.min(Math.max(y, top), bottom);
  return dx * dx + dy * dy < TUNING.radius ** 2;
}

const hitsPipe = (y: number, { x, gapTop }: Pipe) =>
  overlaps(y, x, x + TUNING.pipeWidth, -Infinity, gapTop) ||
  overlaps(y, x, x + TUNING.pipeWidth, gapTop + TUNING.gap, WORLD.ground);

const LANDED = WORLD.ground - TUNING.radius;

/** Advances one fixed tick (spec 3.4). `flapped`: a flap was pressed since the last tick. */
export function step(run: Run, flapped: boolean): { run: Run; events: GameEvent[] } {
  const tick = run.tick + 1;
  if (run.phase === 'over') return { run, events: [] };

  if (run.phase === 'dying') {
    const speed = fall(run.speed);
    const y = run.y + speed;
    if (y < LANDED) return { run: { ...run, tick, speed, y }, events: [] };
    return { run: { ...run, tick, speed, y: LANDED, phase: 'over' }, events: ['over'] };
  }

  if (run.phase === 'ready' && !flapped) {
    return { run: { ...run, tick, distance: run.distance + TUNING.scroll }, events: [] };
  }

  const events: GameEvent[] = flapped ? ['flap'] : [];
  let speed = flapped ? TUNING.flap : fall(run.speed);
  let y = run.y + speed;
  if (y < TUNING.radius) {
    y = TUNING.radius;
    speed = 0;
  }

  let rng = run.rng;
  const pipes = run.pipes.map((p) => ({ ...p, x: p.x - TUNING.scroll })).filter((p) => p.x + TUNING.pipeWidth > 0);
  for (let next = pipes[pipes.length - 1].x + TUNING.pipeSpacing; next <= WORLD.width; next += TUNING.pipeSpacing) {
    let top;
    [top, rng] = gapTop(rng);
    pipes.push({ x: next, gapTop: top });
  }

  // A pipe's centre is at the bird when its left edge is here.
  const aligned = TUNING.birdX - TUNING.pipeWidth / 2;
  const passed = run.pipes.filter((p) => p.x > aligned && p.x - TUNING.scroll <= aligned).length;
  for (let i = 0; i < passed; i++) events.push('score');

  const moved: Run = {
    ...run,
    phase: 'playing',
    tick,
    flapTick: flapped ? tick : run.flapTick,
    y,
    speed,
    pipes,
    distance: run.distance + TUNING.scroll,
    score: run.score + passed,
    rng,
  };
  if (y >= LANDED) return { run: { ...moved, y: LANDED, phase: 'over' }, events: [...events, 'hit', 'over'] };
  if (pipes.some((p) => hitsPipe(y, p))) return { run: { ...moved, phase: 'dying' }, events: [...events, 'hit', 'fall'] };
  return { run: moved, events };
}
