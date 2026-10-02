import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import { TUNING, WORLD, medal, newRun, step, type GameEvent, type Run } from '../game';
import { loadSave, writeSave } from '../save';
import { playFeedback, unlockAudio, type Cue } from './feedback';
import css from './GameScreen.module.css';
import { MedalCoin, PixelText } from './Pixels';
import { draw } from './renderer';

/** A stall (debugger, slow frame) never fast-forwards the run by more than this. */
const MAX_FRAME_MS = 100;
const BUTTON_DELAY_MS = 600;
const COUNTDOWN_MS = 1000;
const BOB_PX = 4;
const FLAP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
const CONFIRM_KEYS = ['Space', 'Enter'];

/** What covers the playfield besides the run's own phase. Numbers are the resume countdown. */
type Overlay = 'title' | 'paused' | 3 | 2 | 1 | null;

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function GameScreen() {
  const [loaded] = useState(loadSave);
  const [feedback, setFeedback] = useState(loaded.save.feedback);
  /** The best before the current run; the run's own score is folded in when the next run starts. */
  const [best, setBest] = useState(loaded.save.best);
  const [notice, setNotice] = useState(loaded.reset);
  const [overlay, setOverlay] = useState<Overlay>('title');
  /** The run as of its last event. The live run is in `live`, advanced by the loop without re-rendering. */
  const [shown, setShown] = useState(() => newRun(newSeed()));
  const [saveFailed, setSaveFailed] = useState(false);
  const [flashes, setFlashes] = useState(0);
  const [buttonsFor, setButtonsFor] = useState<Run | null>(null);
  const [hidden, setHidden] = useState(document.hidden);
  const [still] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const live = useRef(shown);
  const flap = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  const screen =
    typeof overlay === 'number' ? 'countdown' : (overlay ?? (shown.phase === 'dying' ? 'playing' : shown.phase));
  const buttonsReady = screen === 'over' && buttonsFor === shown;
  const running = !hidden && (overlay === null || overlay === 'title') && shown.phase !== 'over';

  const cue = (cues: Cue[]) => feedback && playFeedback(cues);

  const onTicks = useEffectEvent((run: Run, events: GameEvent[]) => {
    cue(events);
    if (events.includes('hit')) setFlashes((n) => n + 1);
    if (events.includes('over') && run.score > best) setSaveFailed(!writeSave({ best: run.score, feedback }));
    setShown(run);
  });

  useEffect(() => {
    if (!running) return;
    const ctx = canvas.current!.getContext('2d')!;
    let frame = 0;
    let last: number | null = null;
    let owed = 0;
    const onFrame = (now: number) => {
      owed += last === null ? 0 : Math.min(now - last, MAX_FRAME_MS);
      last = now;
      let run = live.current;
      const events: GameEvent[] = [];
      for (; owed >= TUNING.tickMs; owed -= TUNING.tickMs) {
        const next = step(run, flap.current);
        flap.current = false;
        run = next.run;
        events.push(...next.events);
      }
      live.current = run;
      draw(ctx, run, run.phase === 'ready' && !still ? Math.sin((now / 1000) * 2 * Math.PI) * BOB_PX : 0);
      if (events.length > 0) onTicks(run, events);
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
  }, [running, still]);

  useEffect(() => {
    /** Leaving the app mid-run pauses it. Phones keep the page visible in the app switcher, so focus loss counts. */
    const leave = () => {
      if (live.current.phase === 'playing' || live.current.phase === 'dying') setOverlay('paused');
    };
    const onVisibility = () => {
      setHidden(document.hidden);
      if (document.hidden) leave();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', leave);
    };
  }, []);

  useEffect(() => {
    if (typeof overlay !== 'number' || hidden) return;
    const id = setTimeout(() => setOverlay(overlay === 1 ? null : ((overlay - 1) as 2 | 1)), COUNTDOWN_MS);
    return () => clearTimeout(id);
  }, [overlay, hidden]);

  useEffect(() => {
    if (shown.phase !== 'over') return;
    const id = setTimeout(() => setButtonsFor(shown), BUTTON_DELAY_MS);
    return () => clearTimeout(id);
  }, [shown]);

  function play() {
    unlockAudio();
    setNotice(false);
    setOverlay(null);
    cue(['swoosh']);
  }

  function nextRun(to: 'title' | null) {
    const run = newRun(newSeed());
    live.current = run;
    setBest(Math.max(best, shown.score));
    setShown(run);
    setSaveFailed(false);
    if (to === 'title') setOverlay('title');
    else play();
  }

  /** A tap on the playfield or a flap key. */
  function press() {
    unlockAudio();
    if (screen === 'ready' || screen === 'playing') flap.current = true;
    else if (screen === 'paused') setOverlay(3);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const confirm = CONFIRM_KEYS.includes(e.code);
    if (screen === 'title' && confirm) play();
    else if (screen === 'over' && confirm && buttonsReady) nextRun(null);
    else if (FLAP_KEYS.includes(e.code) && !e.repeat) press();
    else return;
    e.preventDefault();
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  function toggleFeedback(on: boolean) {
    setFeedback(on);
    writeSave({ best, feedback: on });
  }

  const record = shown.score > best;
  const won = medal(shown.score);

  return (
    <main className={css.page}>
      <div className={css.stage} onPointerDown={(e: PointerEvent) => e.isPrimary && press()}>
        <canvas ref={canvas} className={css.canvas} width={WORLD.width} height={WORLD.height} />
        {flashes > 0 && <div key={flashes} className={css.flash} />}

        {(screen === 'ready' || screen === 'playing') && (
          <div className={css.score} role="status" aria-label="Score">
            <PixelText text={String(shown.score)} size={4} />
          </div>
        )}

        {screen === 'title' && (
          <div className={css.overlay}>
            <PixelText text="FLAPPY BIRD" size={3} tone="gold" />
            {notice && (
              <p className={css.notice} role="alert">
                Saved data couldn't be read and was reset.
              </p>
            )}
            <div className={css.actions}>
              <button className={css.button} onClick={play}>
                <PixelText text="PLAY" size={2} />
              </button>
              <label className={css.toggle}>
                <input type="checkbox" checked={feedback} onChange={(e) => toggleFeedback(e.target.checked)} />
                <span aria-hidden="true">
                  <PixelText text={feedback ? 'SOUND ON' : 'SOUND OFF'} size={2} />
                </span>
                <span className={css.hiddenLabel}>Sound and vibration</span>
              </label>
            </div>
          </div>
        )}

        {screen === 'ready' && (
          <div className={css.overlay}>
            <PixelText text="GET READY" size={3} tone="gold" />
            <PixelText text="TAP TO FLAP" size={2} />
          </div>
        )}

        {screen === 'paused' && (
          <div className={css.overlay}>
            <PixelText text="PAUSED" size={3} tone="gold" />
            <PixelText text="TAP TO RESUME" size={2} />
          </div>
        )}

        {screen === 'countdown' && (
          <div className={css.overlay} role="timer">
            <PixelText text={String(overlay)} size={6} />
          </div>
        )}

        {screen === 'over' && (
          <section className={css.overlay} aria-label="Game Over">
            <PixelText text="GAME OVER" size={3} tone="gold" />
            <div className={css.panel}>
              <div className={css.medal}>{won && <MedalCoin medal={won} />}</div>
              <dl className={css.results}>
                <dt>
                  <PixelText text="SCORE" size={2} tone="gold" />
                </dt>
                <dd aria-label="Score">
                  <PixelText text={String(shown.score)} size={2} />
                </dd>
                <dt>
                  <PixelText text="BEST" size={2} tone="gold" />
                  {record && <PixelText text="NEW" size={2} tone="gold" />}
                </dt>
                <dd aria-label="Best">
                  <PixelText text={String(Math.max(best, shown.score))} size={2} />
                </dd>
              </dl>
            </div>
            {saveFailed && (
              <p className={css.notice} role="alert">
                Couldn't save your best score.
              </p>
            )}
            <div className={css.actions}>
              <button className={css.button} disabled={!buttonsReady} onClick={() => nextRun(null)}>
                <PixelText text="PLAY AGAIN" size={2} />
              </button>
              <button className={css.button} disabled={!buttonsReady} onClick={() => nextRun('title')}>
                <PixelText text="MENU" size={2} />
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
