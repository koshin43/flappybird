# Flappy Bird Repository Policy

## Authority

- `docs/superpowers/specs/2026-10-02-flappybird-design.md` is the sole product and design authority.
- This file defines how changes must be made.
- Tests describe only the current contract. Existing code, old plans, and Git history are not requirements.
- When code and the spec disagree, change the code. Never weaken the spec to preserve an old implementation.
- A product change starts as a spec change. Update the spec first, then code, tests, and docs together.
- Every number that tunes the feel (gravity, flap impulse, scroll speed, pipe gap and spacing, tick rate) lives in the spec and is defined once in code.

## Greenfield Only

- Treat this repository as a greenfield system.
- Never add backward compatibility, compatibility shims, legacy aliases, fallback readers, dual reads or writes, migrations, version bridges, deprecation periods, or support for obsolete saved formats or workflows.
- The save has exactly one shape, defined once in `save/`. Changing it changes that single definition.
- Reject malformed or obsolete saved state. Never interpret it as current state.
- Update code, tests, fixtures, and documentation together.
- Delete superseded behavior. Do not retain dormant branches, flags, aliases, components, or tests.

## Every Line Must Earn Its Place

- Solve the current requirement directly. Do not build speculative extension points.
- Prefer deletion and simplification over another layer.
- Introduce an abstraction only for a real external boundary (`localStorage`, the frame clock, the canvas, randomness, input events) or a required test seam.
- Do not create pass-through wrappers, generic repository layers, service locators, registries, event buses, plugin systems, entity-component systems, scene graphs, or generic `Base*` components.
- Do not create `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `lib/`, or generic `manager.ts` dumping grounds.
- Do not duplicate types, validation rules, world dimensions, physics constants, hitboxes, or palette values. Each has one owner.
- Write one general mechanism and drive it with data instead of writing special cases. One step function advances every tick; one collision test handles every pipe, the ground and the ceiling. Tuning values, score thresholds and event feedback are tables, not branches.
- Derive values instead of tracking them. The medal, the NEW badge and whether the run is over are each computed by one function where needed. They are never stored, cached, or mirrored in React state.
- Implement a rule by its spec definition when that is cheap. The bird is dead when its hitbox overlaps a pipe or the ground. A point is scored on the tick the bird's centre crosses a pipe's centre.
- The engine's tick events (`flap`, `score`, `hit`, `fall`, `over`) are the only source for game sound, vibration and the hit flash. The swoosh belongs to screen changes. Screens and the renderer never work out collisions or scoring for themselves.
- Validate once, at the save boundary. Runs are never persisted, so they have no validation. Code behind that boundary trusts its types: no defensive checks, fallbacks, or branches for impossible cases inside rules or screens.
- Build the UI around the canvas from React, semantic HTML, and CSS Modules. Do not add a UI kit or game engine: dialogs are native `<dialog>` elements, toggles are styled checkboxes.
- Beyond React, use the browser platform: Canvas 2D, `requestAnimationFrame`, Pointer Events, `KeyboardEvent`, `<dialog>`, Web Audio, the Vibration API, the Page Visibility API, and `crypto.getRandomValues` over libraries.
- Game rules are pure functions over immutable values. They import no React, touch no DOM or canvas, and read no storage or clock. Time enters only as the fixed tick. Every random number comes from the seeded generator whose state is part of the game; rules never call `Math.random` or `crypto`.
- The running simulation is owned by the game loop in `play/`, not React state. React re-renders on phase changes and events (start, score, death), never once per frame. Do not add a global state library or context-as-store.
- Catch errors only at real boundaries (storage reads and writes, the top-level error boundary). Never silently guess or continue with corrupted state.

### Dependency Budget

Runtime: `react`, `react-dom`.
Build and test: `typescript`, `@types/react`, `@types/react-dom`, `vite`, `vite-plugin-pwa`, `vitest`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `jsdom`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`.

Adding any other dependency requires a stated reason tied to a spec requirement. No game engines, physics engines, canvas wrappers, UI kits, CSS frameworks, animation libraries, gesture libraries, routers, state managers, storage wrappers, audio libraries, or random-number libraries.

## Fixed Product Boundary

Flappy Bird is a single-player, on-device, installable web app for personal use. It works offline after the first load. The hosted site serves static files only.

All art and sound are original: drawn in code, authored in this repository, or generated with Web Audio. Never copy sprites, sounds, or fonts from the original game or any other game.

Do not add a backend, accounts, authentication, sync, backup or export, online leaderboards, sharing, multiplayer, analytics, telemetry, remote logging, ads, in-app purchases, feature flags, AI players, or any network request beyond loading the app itself. Do not add birds, worlds, modes, power-ups, difficulty levels, themes, or settings beyond what the spec defines.

## Required Package Shape

Use feature-first folders. The spec decides which features exist; the shape below is the default and changes only through the spec.

```text
src/
├── game/       pure rules: the run, seeded random, the fixed-tick step (phases, gravity, flap, ceiling, scrolling, pipe spawning), collision, scoring, tick events, medals
├── save/       the single `localStorage` key and its shape (best score, feedback toggle): read, validate each field, replace failing fields, write
├── play/       the game screen: game loop, canvas renderer, sprites and pixel font, keyboard and pointer input, Title, Get Ready, score, Game Over, Paused and countdown overlays, sound and vibration
├── app/        app shell, theme variables, top-level error boundary
└── main.tsx    the only composition root
```

Rules:

- Each feature owns its model, behavior, screens, and styles. The save is two plain values, so `save/` defines and validates its whole shape.
- Each feature exposes its public API through its `index.ts`. Cross-feature callers import only from that file. Never deep-import another feature's internals.
- Dependency direction: `play` → `save`, `game`. `save` and `game` import no feature, and `game` imports no React. `app` composes features and is imported by none. A feature the spec adds slots into this order explicitly.
- Only `save/` touches `localStorage`. Only the renderer and the sprite rasteriser touch canvases. Web Audio and vibration live behind one module in `play/`.
- HTML theme values (page background, panel, button and toggle colors, radii, transition durations) are defined once as CSS custom properties in `app/`; components never use literal palette values. Pixel-art palettes are defined once, beside their sprite grids in `play/`.
- CSS lives beside the component that needs it, as a CSS Module.
- Filenames describe one concrete capability. Components use `PascalCase.tsx`; other modules use `camelCase.ts`.

## Storage Rules

- `localStorage` is the only persistent store. Everything lives under one key, in the shape the spec defines, written in a single write. Nothing else is persisted.
- Saved state is strictly validated on write and on read. Unknown and missing fields and broken invariants are errors.
- A field that fails validation is replaced, never repaired. The spec defines the replacements and what the player sees.
- Do not store what can be derived (medal, NEW, game over). Runs are never stored.
- Do not add schema-version fields or migration machinery.
- The save is written when a run ends and when a setting changes, never per frame.

## Rendering, Time and Input

- The playfield (sky, pipes, ground, bird) is drawn on a single `<canvas>` with Canvas 2D. The score, panels, buttons and notices are DOM over the canvas, so they are accessible and testable. Pixel lettering in the DOM is `<img>` with alt text.
- One `requestAnimationFrame` loop in `play/` drives the simulation with a fixed-timestep accumulator. The display refresh rate never changes the physics: a run plays identically at 60 Hz, 120 Hz and on a dropped frame. After a long gap (tab hidden, debugger) the loop discards the backlog instead of fast-forwarding.
- The renderer reads game state and never changes it. It rounds positions to whole world pixels and does not interpolate between ticks. The bird's tilt, wing flaps and bob are presentation only.
- The canvas is exactly the world's logical size, defined once, and CSS scales it to fit with `image-rendering: pixelated`.
- When the page is hidden the loop stops and the run pauses as the spec defines.
- Controls are exactly those the spec defines. Flaps register on `pointerdown` and `keydown`, not `click`, so input lands on the next tick. Key repeat never flaps. The page does not scroll, zoom, select text, or pull-to-refresh while playing.
- Respect `prefers-reduced-motion` as the spec defines (for example, no screen shake or flash).

## Trust Model

- Saved state is untrusted on read and passes its owning feature's validation before it is used.
- The only other input is the player's keys, taps, and clicks.

## Testing

Tests exist to catch bugs. A test earns its place only if it would fail on a plausible bug that no other test catches. A few broad tests built around edge cases beat many narrow ones.

- There are exactly two suites, both integration-level. The spec's Testing section lists the edge cases each suite must catch.
  - **Rules scenarios** (`game/game.test.ts`) call only the public `game/` API. Each starts from a hand-written world and a fixed generator state, runs a scripted sequence of ticks and flaps, then compares bird position and velocity, pipes, score and events. Edge cases sit on exact boundaries: grazing a pipe's corner, scoring and dying on the same tick, touching the ground, flapping at the ceiling.
  - **App flows** (`app/App.test.tsx`) render the whole app with the real game and save code over jsdom's `localStorage`. They drive the frame clock by hand and play with keys and pointer presses, and assert only on what the player sees, in the DOM and in what the canvas was asked to draw, and what gets saved. A flow sets up its starting situation by writing a crafted save before rendering.
- Prefer one table-driven test over several near-identical tests.
- What not to test:
  - private helpers, constants, defaults, type shapes, or styles
  - that a component merely renders
  - snapshots, canvas pixels, or draw calls
  - internals, call counts of our own code, or animation timing

  Delete any test whose cases another test already covers.
- Do not mock our own modules. Stub only real boundaries: `requestAnimationFrame` and the clock, the canvas context, the sound and vibration module, `crypto.getRandomValues`, `matchMedia`, and page visibility.
- A bug fix starts with a failing scenario that reproduces the bug.
- Coverage percentage is not a goal.
- Tests are deterministic, offline, and hermetic. Clear `localStorage` before each test.
- Run tests outside the sandbox by default, requesting execution approval when required.
- Never retain tests for superseded behavior.
- A change is incomplete until focused tests, the full test suite, `tsc --noEmit`, and ESLint pass.

## Change Discipline

Before finishing a change:

1. Remove the superseded implementation.
2. Search for stale names, types, CSS classes, CSS variables, and documentation.
3. Confirm dependency direction, public feature boundaries, and that `game/` rules are still pure.
4. Confirm no compatibility code, speculative infrastructure, or unbudgeted dependency was introduced.
5. Report intentionally unsupported behavior plainly.
