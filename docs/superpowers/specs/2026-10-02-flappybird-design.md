# Flappy Bird — Design Spec

Date: 2026-10-02
Status: Draft

## 1. Purpose

A personal, faithful Flappy Bird: the classic one-button game with no ads, popups or tracking, that opens instantly and works offline. It adds nothing to the original's gameplay. The value is having the original game, as it was, on every device.

The owner plays equally on a phone (iPhone and Android) and a laptop.

Success looks like:

- The app opens instantly, including offline.
- It feels like the original: the same gravity, flap, speed and gap, the same unforgiving difficulty.
- A flap lands on the next tick. The run plays the same on a 60 Hz laptop and a 120 Hz phone.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| App type | Installable web app (PWA) named "Flappy Bird". Phone and laptop are equally important. |
| Data location | On the device only. No accounts, no server, no sync. |
| Gameplay | The original only: one bird, endless pipes, one point per pipe. No modes, power-ups or ramping difficulty. |
| Difficulty | Original-hard. Speed and gap are constant for the whole run; hitboxes are tight. |
| Look | Original pixel art in the spirit of the original game. Each run randomly picks a day or night sky and a yellow, blue or red bird. Nothing is copied from the original game. |
| Screen | The playfield keeps the original portrait shape (288×512), scaled to fit and centred. Every device sees the same world. |
| Records | Score, best score, a NEW badge on a record, and a medal. Only the best score is saved. No stats. |
| Interruptions | No pause button. The run pauses itself when the app is hidden and resumes with a 3-2-1 countdown. Runs are not saved; closing the app loses the run in progress. |
| Feedback | Generated sound effects and vibration on a hit, one on/off toggle. |
| Hosting | GitHub Pages at `https://koshin43.github.io/flappybird/`, deployed by a workflow on push to `master`. |

## 3. Rules

### 3.1 World

- The world is 288×512 logical pixels. x grows to the right, y grows downward.
- The ceiling is y = 0. The ground's top edge is y = 400. The ground below it is 112 px tall.
- The simulation advances in fixed ticks, 60 per second. Time enters the rules only as ticks.

### 3.2 Tuning

Every number that tunes the feel lives in this table and is defined once in code. The values are the original's commonly measured 30 fps values rescaled to 60 ticks per second.

| Value | Number |
|---|---|
| Tick rate | 60 per second |
| Gravity | +0.25 px/tick² |
| Flap | sets the bird's speed to −4.5 px/tick |
| Max fall speed | 5 px/tick |
| Bird x (centre) | 74, fixed |
| Bird start y (centre) | 256 |
| Bird hitbox | circle, radius 12 |
| Pipe width | 52 |
| Gap height | 100 |
| Gap top | a random whole number from 80 to 222 inclusive |
| Scroll speed | 2 px/tick (pipes and ground) |
| Pipe spacing | 144 px between left edges |
| First pipe | left edge at x = 488 when the run is created |
| Medals | bronze ≥ 10, silver ≥ 20, gold ≥ 30, platinum ≥ 40 |

Every position and speed stays a multiple of 0.25, so the arithmetic is exact in floating point and a run is reproducible from its seed and inputs.

### 3.3 Phases

A run is in exactly one phase:

- **ready**: the bird hovers at its start y and the ground scrolls. Pipes do not move, so waiting never changes when the first pipe arrives. No gravity, no collisions, no score.
- **playing**: the full tick (3.4) runs.
- **dying**: the bird hit a pipe. Pipes and ground are frozen. Flaps are ignored. Gravity alone moves the bird until it lands.
- **over**: the bird is on the ground. Ticks change nothing.

### 3.4 One tick

A tick takes the run and whether a flap was pressed since the previous tick.

Every tick in ready, playing and dying advances the tick counter by 1. A tick in over changes nothing.

In **ready**: if a flap was pressed, the phase becomes **playing** and this tick runs as a playing tick, applying the flap. Otherwise the scrolled distance grows by 2 and nothing else changes.

In **playing**, in this order:

1. **Bird speed.** If a flap was pressed, speed = −4.5 and the flap tick is recorded. Otherwise speed = min(speed + 0.25, 5).
2. **Bird position.** y += speed. If the top of the circle would pass the ceiling (y − 12 < 0), then y = 12 and speed = 0. The ceiling does not kill.
3. **Scroll.** Every pipe moves 2 px left. The scrolled distance grows by 2. A pipe whose right edge is at or left of x = 0 is dropped. While the last pipe's left edge + 144 ≤ 288, a new pipe enters at that position with a gap top drawn from the generator.
4. **Score.** +1 for each pipe whose centre x the bird's centre x (74) reached this tick: the pipe centre was > 74 before the scroll and ≤ 74 after it.
5. **Collision.**
   - The top pipe of each pair spans its 52 px width from y = gap top upward without limit, so flying above the screen never gets past a pipe. The bottom pipe spans from y = gap top + 100 down to the ground.
   - A **pipe hit** is when the distance from the bird's centre to the nearest point of either pipe is less than 12. A distance of exactly 12 is a graze and survives.
   - A **ground hit** is when y + 12 ≥ 400.
   - A ground hit sets y = 388 and the phase becomes **over**. Otherwise a pipe hit makes the phase **dying**.

Score is counted before collision, so a point earned on the tick of a hit counts.

In **dying**: speed = min(speed + 0.25, 5), y += speed. When y + 12 ≥ 400, y = 388 and the phase becomes **over**.

### 3.5 Events

Each tick reports what happened, in order. These events are the only source of game sound, vibration and the hit flash.

| Event | When |
|---|---|
| `flap` | a flap was applied |
| `score` | a point was scored |
| `hit` | a pipe hit or a ground hit while playing |
| `fall` | a pipe hit started the dying phase |
| `over` | the phase became over |

A ground hit while playing reports `hit` then `over` on the same tick.

### 3.6 Randomness

- Each new run gets a 32-bit seed from `crypto.getRandomValues`.
- A seeded 32-bit generator (mulberry32), written in the rules, is part of the run's state.
- When the run is created it draws, in order: the sky (day or night, equal odds), the bird colour (yellow, blue or red, equal odds), then the first pipe's gap top. Each later pipe draws its gap top when it enters.

### 3.7 Medals and best score

- `medal(score)` gives none below 10, bronze from 10, silver from 20, gold from 30, platinum from 40.
- At game over the saved best becomes max(best, score).
- NEW shows when the score is strictly greater than the best before this run. A score of 0 never shows NEW.

## 4. Game flow

### 4.1 Opening the app

The app always opens on **Title** with a fresh run in the ready phase, which supplies the sky, bird and scrolling ground behind the title.

### 4.2 Screens

There is one game screen. These states are overlays on the canvas:

1. **Title.** The "Flappy Bird" wordmark, the bird bobbing, the ground scrolling, a **Play** button and the feedback toggle (🔊/🔇). Space or Enter presses Play. If any saved data was replaced (9.2), a notice shows here until Play is pressed.
2. **Get Ready.** "Get Ready" and a tap hint, with the score showing 0. The bird bobs, the ground scrolls, no pipes are on screen yet. The first flap input starts the run and is also its first flap. Play keeps the Title's run, so its sky and bird carry over.
3. **Playing.** Only the big score at the top. It stays through Dying and is hidden on Game Over, where the panel shows the score.
4. **Dying.** On `hit`: a white flash fades out over 200 ms, the hit sound plays and the phone vibrates. On `fall`: the fall sound plays. The score stays visible. Input is ignored.
5. **Game Over.** On `over`: the "Game Over" heading and a panel with the medal (or an empty slot), the score, the best and the NEW badge when earned. Two buttons:
   - **Play again** creates a new run and goes to Get Ready.
   - **Menu** creates a new run and goes to Title.

   Both buttons enable 600 ms after the panel appears. Once enabled, Space or Enter presses Play again. If saving the best failed, the panel also says "Couldn't save your best score."
6. **Paused.** See 4.3.

### 4.3 Hiding the app

- When the page becomes hidden, the game loop stops.
- If the run was **playing** or **dying**, the screen becomes **Paused**: "Paused – tap to resume" over the frozen scene.
- In Paused, a tap on the playfield or a flap key starts a countdown showing 3, 2, 1, each for one second. When it ends, the run continues from the same tick. The countdown tap is not a flap.
- If the page is hidden during the countdown, the screen goes back to Paused.
- Hiding the app on Title, Get Ready or Game Over just stops the loop. Returning continues the same screen.

## 5. Visual language

### 5.1 Pixel art

All art is original, authored in this repository as text grids with palettes, and drawn at the world's 1:1 scale.

| Sprite | Size | Notes |
|---|---|---|
| Bird | 34×24 | Round body filling the hitbox circle, eye, beak, wing. Three wing frames (up, middle, down). One grid, three palettes: yellow, blue, red. |
| Pipe | 52 wide | A body slice repeated vertically, and a 26 px tall lip at the gap end, both the full 52 px wide so the art matches the hitbox. Green with light and dark shades. The top pipe is the bottom pipe flipped. |
| Sky | 288×400 | Day: light blue, white clouds, a pale green city skyline and bushes. Night: dark teal, a skyline with lit windows, a few stars. The sky does not scroll. |
| Ground | 288×112 | A striped green top strip over sand. Its stripe pattern repeats, and it is drawn offset by the scrolled distance. |
| Medals | 22×22 | Bronze, silver, gold, platinum. |
| Pixel font | 5×7 glyphs | A–Z, 0–9 and the punctuation the screens use, drawn with a dark outline. Rendered at scale 1 for panel text, scale 2 for headings and the wordmark, and scale 3 for the big score. It is used for the wordmark, "Get Ready", "Game Over", NEW, Paused, the countdown and the scores. |

Sprites are rasterised once at startup. The canvas draws them; overlays show them as `<img>` elements with alt text equal to the words or number they show.

### 5.2 Motion

All of this is presentation and never affects the rules:

- **Wings** cycle every 5 ticks during ready and playing, and stop in dying and over.
- **Tilt.** Let t be ticks since the last flap. The bird points 25° up for t < 24, then turns down 4° per tick to a maximum of 90° down. In ready it is level.
- **Bob.** On Title and Get Ready the bird is drawn ±4 px above and below its y on a sine wave with a 1-second period.
- **Positions** are rounded to whole world pixels. There is no interpolation between ticks.

### 5.3 Page and colours

- The canvas is 288×512 and is scaled by CSS to the largest size that fits the screen, with `image-rendering: pixelated`, centred over a dark neutral page background.
- HTML parts (page background, panel, buttons, toggle, notice) use CSS custom properties defined once in `app/`. Sprite palettes live with the sprites.
- The Game Over panel is sand-coloured with a brown border. Buttons use the same style.

### 5.4 Reduced motion

With `prefers-reduced-motion`, there is no white flash and no bob. Gameplay motion is unchanged.

## 6. Input

- **Flap**: a pointer press (`pointerdown`) on the playfield, or `keydown` of Space, ArrowUp or W. Key repeats never flap.
- A flap press sets one pending flag that the next tick consumes. Several presses between two ticks give one flap.
- Flap input only acts in Get Ready and Playing. Buttons sit in overlays that never coexist with flap input, so a tap on a button never flaps.
- The page does not scroll, zoom, select text, show a callout or pull to refresh. `touch-action: none` on the playfield.

## 7. Sound and vibration

Every sound is generated with Web Audio at runtime. There are no audio files.

| Trigger | Sound | Vibration |
|---|---|---|
| `flap` | short rising chirp | — |
| `score` | bright two-note ding | — |
| `hit` | dull thud | 40 ms |
| `fall` | descending whistle | — |
| Title → Get Ready, Game Over panel appearing | soft swoosh | — |

- The audio context is created on the first tap or key press.
- With the toggle off (🔇), nothing plays and nothing vibrates.
- Vibration is used where the device supports it. iPhones have none; that is accepted.

## 8. Data model

```ts
type Phase = 'ready' | 'playing' | 'dying' | 'over';
type Sky = 'day' | 'night';
type BirdColor = 'yellow' | 'blue' | 'red';
type Medal = 'bronze' | 'silver' | 'gold' | 'platinum';

type Pipe = { x: number; gapTop: number };        // x is the left edge

type Run = {
  phase: Phase;
  tick: number;          // ticks since the run was created; frozen in over
  flapTick: number;      // tick of the last flap (presentation: tilt)
  y: number;             // bird centre
  speed: number;         // px/tick, positive is down
  pipes: Pipe[];         // ordered left to right
  distance: number;      // px scrolled (presentation: ground offset)
  score: number;
  rng: number;           // generator state
  sky: Sky;
  bird: BirdColor;
};

type GameEvent = 'flap' | 'score' | 'hit' | 'fall' | 'over';

type Save = {
  best: number;          // safe integer ≥ 0
  feedback: boolean;     // sound and vibration on
};
```

Runs are never persisted, so they have no validation.

## 9. Storage and offline

### 9.1 Saving

- The whole `Save` lives under one `localStorage` key, `flappybird`, written in a single write.
- It is written at game over (when the best changes) and when the toggle changes. Never per tick.

### 9.2 Reading and validation

- A missing key is a first launch: best 0, feedback on, no notice.
- Unparseable JSON, a non-object, or an unknown top-level field replaces the whole save.
- Otherwise each field is validated on its own: `best` must be a safe integer ≥ 0, `feedback` a boolean. A missing or invalid field is replaced: `best` by 0, `feedback` by on.
- When anything was replaced, the Title notice says "Saved data couldn't be read and was reset." The replaced save is written back.
- If a write fails, the game continues with the in-memory values. A failed best write shows on the Game Over panel (4.2).
- There is no version field and no migration.

### 9.3 Offline and updates

- A service worker caches the app, so it opens and plays fully offline after the first visit.
- New versions install automatically when online. An update reload loses a run in progress; runs are short, and this is accepted.
- Known risk, accepted: clearing site data, or losing the device, loses the best score.

## 10. Tech stack

- React + TypeScript, built with Vite. CSS Modules beside components; HTML theme values as CSS custom properties defined once.
- The playfield is one Canvas 2D element. Score, panels, buttons and notices are HTML over it.
- One `requestAnimationFrame` loop with a fixed 60 Hz accumulator. Each frame's elapsed time is capped at 100 ms before it is added, so a stall never fast-forwards the run. A pending flap is consumed by the first tick that runs.
- No UI component library, game engine or audio library. The toggle is a styled checkbox.
- `vite-plugin-pwa` for the manifest and service worker. The manifest has an explicit `id`, `name` and `short_name` "Flappy Bird", `orientation: portrait`, and lists only PNG icons (192 and 512) showing the yellow bird on the day sky.
- `#root` fills 100% of the page; the body is not pinned.
- Hosting: GitHub Pages via a workflow on push to `master` that installs, tests, lints, builds and deploys.
- README and Apache 2.0 license, as in 2048.

## 11. Testing

There are two integration suites and no other tests (AGENTS.md, Testing). Each item is an edge case a plausible implementation gets wrong. If the code breaks one of them, at least one test must fail.

### 11.1 Rules scenarios (`game/`)

Each scenario starts from a hand-written run (or `newRun` with a fixed seed), runs a scripted list of ticks and flaps through the public `game/` API, and compares the whole resulting run and the events.

- **Speed.** Free fall from speed 0 reaches exactly 5 and stays there. A flap sets −4.5 on that tick with no gravity added. A flap from the ready phase starts playing and flaps on the same tick.
- **Ceiling.** A flap near the ceiling stops the bird at y = 12 with speed 0 and no hit. A bird at the ceiling inside a pipe's column is a pipe hit.
- **Graze table.** Bird centre exactly 12 from a pipe's corner, from its side, and from the lip's flat end survives. 0.25 px closer is a hit in each case.
- **Ground.** Reaching y + 12 = 400 while playing gives `hit`, `over` on that tick, y = 388, no dying phase.
- **Dying.** A pipe hit gives `hit`, `fall`. In the following ticks pipes and distance do not move, flaps are ignored, the bird falls to y = 388 and `over` follows. Ticks in over change nothing.
- **Score.** A point is scored exactly on the tick the pipe centre crosses x = 74. A point on the tick of a pipe hit still counts.
- **Generator.** The same seed and inputs give identical runs. A fixed seed gives a known sky, bird and first gaps. Over a long run every gap top is within 80–222, pipes stay 144 apart, and pipes are dropped once their right edge reaches 0.
- **Medals table.** 0, 9, 10, 19, 20, 29, 30, 39, 40, 100.

### 11.2 App flows (`app/`)

The whole app renders with the real game and save code over jsdom's `localStorage`. Each flow starts from a crafted save, or none, drives frames by hand, plays with keys and pointer presses, then checks what the player sees and what is saved. Only these are stubbed: `requestAnimationFrame` and the clock, the canvas context, the sound and vibration module, `crypto.getRandomValues`, and page visibility.

1. **A whole run.** Title → Play → Get Ready showing 0. A key press starts the run, flaps carry it through a pipe gap (score 1), then the bird hits a pipe. Game Over shows score, medal slot and best. The best is saved and NEW shows only when the score beat the previous best.
2. **Game Over input.** Play again ignores Space and clicks for 600 ms, then Space starts a new Get Ready. Menu returns to Title.
3. **Pause.** Hiding the page mid-run shows Paused and frames advance nothing. A tap starts 3, 2, 1. Hiding during the countdown returns to Paused. After the countdown the run continues from the same tick, and the countdown tap did not flap.
4. **Corrupt save table.** An invalid best, an invalid feedback, an unknown field, and unparseable JSON each show the notice and write the replaced save. A valid save shows no notice.
5. **Feedback toggle.** Toggled off, it is saved, survives a remount, and a run plays no sound and no vibration.
6. **Input edges.** Held-key repeats don't flap. Tapping Play doesn't flap. A failed best write shows "Couldn't save your best score."

### 11.3 Manual

On an Android phone, an iPhone and a laptop browser:

- compare feel with the original game: gravity, flap height, speed, gap
- smoothness on a 120 Hz screen and on a 60 Hz laptop
- sounds (including the first-tap audio start on iOS), and vibration on Android
- install, then offline launch
- hiding mid-run and resuming

## 12. Out of scope for v1

- A pause button; saving a run across app close.
- Stats, history, top 10; any data beyond the best score.
- Modes, power-ups, difficulty settings, ramping speed or gap.
- Choosing the sky or bird; themes; settings beyond the feedback toggle.
- Accounts, sync, backup, sharing, leaderboards, rate buttons.
- Widening the world on wide screens.
