import type { GameEvent } from '../game';

/** Everything that makes a sound: the game's events, and the swoosh of a screen change. */
export type Cue = GameEvent | 'swoosh';

/** One oscillator gliding from one pitch to another. */
interface Tone {
  from: number;
  to: number;
  at: number;
  length: number;
  wave: OscillatorType;
  volume: number;
}

const SWOOSH: Tone[] = [{ from: 250, to: 1100, at: 0, length: 0.18, wave: 'triangle', volume: 0.05 }];

const SOUNDS: Record<Cue, Tone[]> = {
  flap: [{ from: 500, to: 900, at: 0, length: 0.07, wave: 'square', volume: 0.04 }],
  score: [
    { from: 988, to: 988, at: 0, length: 0.08, wave: 'square', volume: 0.05 },
    { from: 1319, to: 1319, at: 0.08, length: 0.22, wave: 'square', volume: 0.05 },
  ],
  hit: [{ from: 160, to: 50, at: 0, length: 0.16, wave: 'sine', volume: 0.5 }],
  fall: [{ from: 900, to: 180, at: 0.12, length: 0.5, wave: 'triangle', volume: 0.1 }],
  over: SWOOSH,
  swoosh: SWOOSH,
};

const VIBRATE_MS: Partial<Record<Cue, number>> = { hit: 40 };

let audio: AudioContext | null = null;

/** Browsers only start audio from a tap or key press; call this from those handlers. */
export function unlockAudio(): void {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
}

/** Plays the sounds and vibration for these cues. */
export function playFeedback(cues: Cue[]): void {
  unlockAudio();
  const ctx = audio!;
  for (const tone of cues.flatMap((cue) => SOUNDS[cue])) {
    const at = ctx.currentTime + tone.at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.from, at);
    osc.frequency.exponentialRampToValueAtTime(tone.to, at + tone.length);
    gain.gain.setValueAtTime(tone.volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + tone.length);
  }
  const vibrate = Math.max(0, ...cues.map((cue) => VIBRATE_MS[cue] ?? 0));
  if (vibrate && 'vibrate' in navigator) navigator.vibrate(vibrate);
}
