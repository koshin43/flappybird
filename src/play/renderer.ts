import { TUNING, WORLD, type Run } from '../game';
import { GROUND_PERIOD, LIP_HEIGHT } from './art';
import { birdCanvas, bodyCanvas, groundCanvas, lipCanvas, skyCanvas } from './sprites';

/** World pixels per art pixel. */
const ART = 2;
/** Wing frames up, middle, down, middle; each held for 5 ticks. */
const WING_CYCLE = [0, 1, 2, 1];
const WING_TICKS = 5;

/** Degrees, positive is nose down: 25° up for 24 ticks after a flap, then 4° per tick down to 90°. */
function tilt(run: Run): number {
  if (run.phase === 'ready') return 0;
  const t = run.tick - run.flapTick;
  return t < 24 ? -25 : Math.min(90, -25 + (t - 24) * 4);
}

/** Draws the playfield. `bob` lifts the bird by that many pixels; nothing here changes the run. */
export function draw(ctx: CanvasRenderingContext2D, run: Run, bob: number): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(skyCanvas(run.sky), 0, 0, WORLD.width, WORLD.ground);

  const lip = lipCanvas();
  const body = bodyCanvas();
  const lipHeight = LIP_HEIGHT * ART;
  const width = TUNING.pipeWidth;
  for (const { x, gapTop } of run.pipes) {
    const bottom = gapTop + TUNING.gap;
    ctx.drawImage(body, x, 0, width, gapTop - lipHeight);
    ctx.drawImage(lip, x, gapTop - lipHeight, width, lipHeight);
    ctx.drawImage(lip, x, bottom, width, lipHeight);
    ctx.drawImage(body, x, bottom + lipHeight, width, WORLD.ground - bottom - lipHeight);
  }

  const ground = groundCanvas();
  ctx.drawImage(ground, -(run.distance % (GROUND_PERIOD * ART)), WORLD.ground, ground.width * ART, ground.height * ART);

  const flapping = run.phase === 'ready' || run.phase === 'playing';
  const frame = flapping ? WING_CYCLE[Math.floor(run.tick / WING_TICKS) % WING_CYCLE.length] : 1;
  const bird = birdCanvas(`${run.bird} ${frame}`);
  ctx.save();
  ctx.translate(TUNING.birdX, Math.round(run.y - bob));
  ctx.rotate((tilt(run) * Math.PI) / 180);
  ctx.drawImage(bird, (-bird.width * ART) / 2, (-bird.height * ART) / 2, bird.width * ART, bird.height * ART);
  ctx.restore();
}
