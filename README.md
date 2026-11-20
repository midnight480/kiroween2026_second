# 灯 Tomoshibi: The Candle Ledger

[日本語](README_ja.md)

A Japanese-horror to-do app where every deadline is a candle. Every scary effect helps you see what is urgent, and Safe mode turns them all off.

Built for the **Costume Contest** of [Kiroween 2026](https://kiroween.devpost.com/).

- Live: https://tomoshibi.midnight480.com (works as a guest, no account needed)
- Demo video: `video/out/tomoshibi-demo.mp4` (made with `npm run video`, see [docs/video.md](docs/video.md))

## Idea

Most to-do apps show a deadline as a date. Tomoshibi shows it as a candle. The candle is full when you create the task and burns down toward the deadline, so you see what is urgent without reading a date.

The one rule: **every scary thing must help you manage your tasks.** Japanese horror is quiet. Nothing jumps at you; something moves at the edge of the screen.

| Japanese element | Meaning in Japan | What it does in the app |
|---|---|---|
| Ofuda (御札) | A paper talisman that seals evil away | Each task. Press and hold to peel the seal and finish it, so nothing is completed by accident. |
| Mori-shio (盛り塩) | A cone of salt that keeps unwanted things out | Form validation. Leave the title empty and the salt crumbles. |
| Kehai (気配) | Feeling a presence you cannot see | Rare, quiet signs (a passing shadow, a shifted card) that keep the board alive. |
| Kazoe-uta (数え歌) | A children's counting song | Counts down the last ten seconds of a candle. |
| 遅 (oso) | "Late", as a red seal | Marks an overdue task. The English UI adds "overdue". |

After a missed deadline, the nearest candle looks shorter than its clock says. This is visual only. The real deadline, the time shown in text and the saved data never change.

There is **one jump scare**: when a candle burns out, once per task. **Safe mode** turns off flashes, figures and the woman, and shows the same information with text and color. **Mute** and `prefers-reduced-motion` are respected.

The origin of the ghost is never explained.

## Features

- Three-column board (To do / In progress / Done) with drag and drop, undo, keyboard shortcuts
- Multiple projects with custom fields, team roster with roles, links to GitHub and Google Docs
- English and Japanese, light and dark themes, 360px phone layout, PWA
- Optional sign-in (Clerk). Signed-in data syncs across devices through Neon
- Public REST API with API keys (`/api/v1/*`, see `api.html` and [docs/api.md](docs/api.md))
- All sound is generated with Web Audio. No audio files, no external images

## Tech

- Vite 8 and strict TypeScript, no framework. DOM, CSS and Canvas
- Cloudflare Workers serve the app and the API. Neon Postgres through Hyperdrive. Clerk for sign-in and API keys
- Guests store data in `localStorage`

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in values, see below
npm run dev                  # http://localhost:5173/?debug
npm run build                # type check and build
```

Settings are passed by environment variables. The list is in `.env.example`; real values go in git-ignored files (`.env.local`, `.env.development.local`, `.env.production.local`). Without Clerk keys the app runs as guest only. `/api/*` needs a Neon connection (see [docs/deploy.md](docs/deploy.md)).

Debug helpers with `?debug`: `__t.curse()` plays the overdue curse, `__t.fire(0..5)` triggers one presence effect.

Deploy and other commands: see [AGENTS.md](AGENTS.md) and [docs/deploy.md](docs/deploy.md).

## How Kiro was used

- **Steering** (`.kiro/steering/`): `product.md`, `tech.md` and `structure.md` are always included. `horror-design.md` is included when an effect file is open, and lists the checks for any new effect (which function it helps, Safe mode, Mute, readability in both themes, docs).
- **Specs** (`.kiro/specs/`): `expiry-curse` and `kamikakushi-404`.
- **Hooks** (`.kiro/hooks/`): build on save, English/Japanese i18n parity, a Safe mode guard on effect files, and a manual docs sync.
- **Kiro CLI**: deployment with Cloudflare's `cf` CLI and Neon setup.

## Documents

Design documents are in [docs/](docs/README.md) (written in Japanese). Start from [AGENTS.md](AGENTS.md).

## License

MIT. See [LICENSE](LICENSE).
