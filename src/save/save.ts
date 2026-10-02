export interface Save {
  best: number;
  /** Sound and vibration on. */
  feedback: boolean;
}

const KEY = 'flappybird';
const DEFAULTS: Save = { best: 0, feedback: true };

const isField: { [F in keyof Save]: (value: unknown) => value is Save[F] } = {
  best: (value): value is number => Number.isSafeInteger(value) && (value as number) >= 0,
  feedback: (value): value is boolean => typeof value === 'boolean',
};
const FIELDS = Object.keys(isField) as (keyof Save)[];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads the save, replacing each field that fails validation. `reset`: something was replaced (and written back). */
export function loadSave(): { save: Save; reset: boolean } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage is blocked: play on with defaults, as on a first launch.
  }
  if (raw === null) return { save: DEFAULTS, reset: false };

  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isObject(parsed) && Object.keys(parsed).every((k) => (FIELDS as string[]).includes(k))) data = parsed;
  } catch {
    // Unparseable: every field is replaced below.
  }
  const save = Object.fromEntries(FIELDS.map((f) => [f, isField[f](data[f]) ? data[f] : DEFAULTS[f]])) as unknown as Save;
  const reset = FIELDS.some((f) => save[f] !== data[f]);
  if (reset) writeSave(save);
  return { save, reset };
}

/** Writes the whole save in one write; false when storage refused it. An invalid save is a bug and throws. */
export function writeSave(save: Save): boolean {
  if (Object.keys(save).length !== FIELDS.length || !FIELDS.every((f) => isField[f](save[f]))) {
    throw new Error(`Refusing to save invalid ${JSON.stringify(save)}`);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
