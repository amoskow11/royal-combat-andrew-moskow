# Royal Combat

A browser chess game with a Knights-and-Royalty theme — pieces are illustrated as a king, queen,
foot knights, cavalry, and archers, and captures play out as a short "battle" animation, in the
spirit of the enchanted chess set in *Harry Potter*.

Three ways to play, all in one app:

1. **Hot-Seat** — two people share one screen and one keyboard, taking turns.
2. **VS Computer** — you play White or Black; the browser calculates the other side's moves.
3. **Online** — two players each type the same room code on their own device and watch each
   other's moves appear live.

By Andrew Moskow.

## What this project is built on (plain-English glossary)

You don't need a coding background to follow this — every technical term below is one you'll see
again in [ProductSpec.md](ProductSpec.md) and [FEATUREROADMAP_workplan.md](FEATUREROADMAP_workplan.md).

| Term | What it means here |
|---|---|
| **Cloudflare Workers** | The hosting service that runs this game. Instead of renting a traditional server, small pieces of our code run on Cloudflare's network worldwide. The **Free plan** means this costs nothing, within generous usage limits. |
| **Durable Object** | A special Cloudflare Worker that *remembers things between visits* — normal Workers forget everything after each request. We use one Durable Object per online game room, so it acts like a dedicated referee for that room: it holds the current board, knows whose turn it is, and is the single source of truth both players' browsers check against. |
| **SQLite** | A small, file-based database format. Each room's Durable Object saves the game into SQLite storage after every move, so the game survives even if Cloudflare restarts that Durable Object in the background. |
| **WebSocket** | A live, two-way phone line between a browser and the server that stays open, instead of the browser having to ask "anything new?" over and over. This is what lets an online opponent's move appear on your screen instantly. |
| **`rules.js`** | One JavaScript file that contains *all* the chess rules (how each piece moves, check, checkmate, castling, etc.), written from scratch. Every mode — hot-seat, computer, and online — calls into this same file, so the rules can never disagree with each other. |
| **Minimax with alpha-beta pruning** | The algorithm behind the computer opponent. Minimax looks a few moves ahead and assumes you'll always play your best response, then picks the move that's best for the computer even against that. Alpha-beta pruning is a shortcut that skips exploring moves that can't possibly change the decision, so the computer can think through more positions in the same two-second budget. See [ProductSpec.md](ProductSpec.md) for the full explanation. |
| **Perft test** ("move-count test") | A standard way to prove a chess rules engine is correct: count every possible sequence of moves 1, 2, and 3 moves deep from the starting position. The correct answers are always 20, 400, and 8,902 — if our code doesn't produce those numbers, a rule is implemented wrong. We run this test before building anything else. |

## Project structure (planned)

This repository does not have game code yet — see
[FEATUREROADMAP_workplan.md](FEATUREROADMAP_workplan.md) for the build order. Once underway, the
layout will be:

```
royal-combat/
├── rules.js              # The one shared chess-rules module (no external chess libraries)
├── rules.test.js         # The perft test and other rules tests
├── public/                # Static files served directly to the browser
│   ├── index.html
│   ├── style.css
│   └── app.js             # Board rendering, click/drag handling, animations
├── worker.js              # Cloudflare Worker entry point (routes the WebSocket path)
├── room.js                # The Durable Object class — one instance per online game room
├── wrangler.jsonc          # Cloudflare Workers configuration
├── README.md
├── ProductSpec.md
└── FEATUREROADMAP_workplan.md
```

## Running this project (once code exists)

This project will use [Wrangler](https://developers.cloudflare.com/workers/wrangler/), Cloudflare's
command-line tool for Workers. Two commands will matter:

```bash
npx wrangler dev
```
Runs the whole game on your own computer at a local web address, for testing before it's live.

```bash
npx wrangler deploy
```
Publishes the game to the real internet, on Cloudflare's servers.

## Documentation

- **[ProductSpec.md](ProductSpec.md)** — what the game must do, mode by mode, including the chess
  rules, the AI opponent, and the online-room design.
- **[FEATUREROADMAP_workplan.md](FEATUREROADMAP_workplan.md)** — the build order, broken into
  checkbox tasks with dependencies, the files each task touches, and how to know each one is done.

## Scope

Out of scope for this project: accounts/logins, chess clocks, ratings, draw by repetition or the
fifty-move rule, opening books, move export (like PGN files), and React. Everything is plain HTML,
CSS, and JavaScript.
