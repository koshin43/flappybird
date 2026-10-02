# Flappy Bird

A personal Flappy Bird: the classic one-tap game, with the original feel and difficulty, in original pixel art. No ads, popups or tracking.

**Play:** https://koshin43.github.io/flappybird/

It is an installable web app (PWA). Add it to your home screen and it opens instantly and works offline. Each device keeps its own best score; nothing leaves the device.

## How to play

Tap the screen, or press Space, ↑ or W, to flap. Fly through the gaps between the pipes; each one cleared is a point. Touching a pipe or the ground ends the run.

| Score | Medal |
|---|---|
| 10 | Bronze |
| 20 | Silver |
| 30 | Gold |
| 40 | Platinum |

Each run picks a day or night sky and a yellow, blue or red bird at random. Hiding the app mid-run pauses it; tap to resume after a 3-2-1 countdown. **SOUND ON / OFF** on the title screen switches sound and vibration together.

The full rules live in the [design spec](docs/superpowers/specs/2026-10-02-flappybird-design.md).

## Development

Requires Node 22.

```sh
npm install
npm run dev        # local dev server
npm test           # rules scenarios and app flows (Vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # type-check and production build into dist/
```

Built with React, TypeScript and Vite; `vite-plugin-pwa` provides the manifest and offline service worker. The game runs on a fixed 60 Hz tick and draws to one canvas; all art is drawn in code and all sound is generated with Web Audio. The best score and the sound setting are saved in one `localStorage` key and validated whenever it is read or written.

| Folder | Contents |
|---|---|
| `src/game/` | Pure game rules: seeded random, physics, pipes, scoring, collisions, medals |
| `src/save/` | Reading and writing the saved best score and sound setting |
| `src/play/` | The game screen: loop, canvas renderer, pixel art and font, input, overlays, sound and vibration |
| `src/app/` | App shell, theme, error boundary |

How changes are made is described in [AGENTS.md](AGENTS.md).

## Deployment

Every push to `master` runs the tests, lint and build, then deploys `dist/` to GitHub Pages ([workflow](.github/workflows/deploy.yml)).

## License

[Apache License 2.0](LICENSE)
