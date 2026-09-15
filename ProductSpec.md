# Royal Combat — Product Spec

This document defines *what* Royal Combat must do and *why* each decision was made. It's written
for a reader with no coding background, so every technical or chess term is defined the first time
it's used. [FEATUREROADMAP_workplan.md](FEATUREROADMAP_workplan.md) turns this into an ordered,
buildable task list.

## 1. Vision

Royal Combat is a browser-based chess game with a Knights-and-Royalty theme. Rather than plain
flat chess symbols, each side is a small illustrated army — a king, a queen, armored foot knights,
mounted cavalry, and archers — and when one piece captures another, the board plays a short
"battle" moment instead of just making the piece vanish, echoing the enchanted chess set from
*Harry Potter*. Underneath the visuals, it is **complete, legal, standard chess** — nothing about
the theme changes how the game is actually played or decided.

It supports three independent ways to play (see Section 3), all sharing one rules engine so the
game behaves identically no matter which mode you're in.

> **Figma designs:** [Royal Combat — Figma](https://www.figma.com/design/h7v79c5tiUfKjuA9KBuEZq)
> holds the three core screens (Landing, Room Join, Chessboard), built by Claude Code directly in
> Figma via the Figma connector from the style description below. Section 2 documents exactly what
> those screens establish, so Phase 2 of the roadmap (building the board UI) has a concrete target
> to match.

## 2. The Look

### 2.0 Style spec (as built in Figma)

Revised after you shared a reference photo of the enchanted chess set from the *Harry Potter*
films — cold blue-and-white marble board, pewter/iron stone pieces, torchlit stone hall — in place
of the original warm gold-and-parchment "royal" look.

- **Palette** — a cold near-black background (`#14161B`), an icy silver-blue accent (`#A9BEDC`)
  for headings, borders, and highlights (replacing the original gold), pale stone (`#E6EAF2`) for
  body text and the White army, and dark iron (`#34363F`) for the Black army. Board squares
  alternate white marble (`#C7CDDA`) and blue marble (`#22304B`). A warm amber-red (`#B5502F`) is
  reserved specifically for the check warning, so it still reads as "danger" even though the rest
  of the palette is no longer warm-toned.
- **Type** — unchanged: **Cinzel** for all-caps titles and buttons, **Cormorant Garamond** for
  body copy and captions.
- **Piece art** — the Figma Plugin API that Claude Code uses to draw in Figma can only build with
  shapes, text, and existing images already in a file; it cannot generate original illustration or
  import the reference photo itself. So for now, each piece is a circular medallion (pale stone for
  White, iron for Black) labeled with its unit's initials (K, Q, FK, AR, CV, FS — see the roster
  below) rather than a sculpted stone figure like the reference. This is enough to build and test
  the real game against. Turning these into actual sculpted/illustrated units is a good next step
  once the game itself works, but it's a separate, later effort — see Section 6.
- **Screens built:** a landing screen with the three mode buttons, a room-code join screen for
  Online mode, and a chessboard screen showing the starting position, a turn-status bar, and a
  "New Game" button. All three are in the Figma file linked above.

### 2.1 Piece roster

Standard chess has six piece types. Each is re-skinned as a unit, chosen so the reskin still hints
at how the piece is allowed to move:

| Chess piece | Royal Combat unit | Why this pairing |
|---|---|---|
| King | King | Unchanged — the piece the whole game revolves around. |
| Queen | Queen | Unchanged — the most powerful unit on the board. |
| Rook | Foot Knight (heavy guard) | A armored, shield-and-sword unit that holds the board's back corners, like a castle guard — matches the rook's straight-line, fortress-corner role. |
| Bishop | Archer | A ranged unit, fitting the bishop's long diagonal reach. |
| Knight | Cavalry (horseback unit) | A literal horse-mounted unit — this is the one piece where the theme name and the chess name already match. |
| Pawn | Foot Soldier (spearman) | The basic infantry unit, front line of the army, exactly like the pawn's role. |

Both sides use the same six units, recolored (a pale stone army vs. a dark iron army) rather than
being different armies, so the board stays easy to read at a glance — this matches how every
version of chess keeps the two sides visually distinct but symmetrical.

### 2.2 Board and motion

- Moving a piece **slides** it smoothly from its start square to its destination square, rather
  than jumping instantly — this is what makes the board read as "alive" instead of a static
  diagram.
- **Capturing** a piece plays a short fight (roughly half a second) at the destination square: the
  attacking piece lunges and strikes (a scale/flash "impact"), and the captured piece is knocked
  backward and **topples over using real 3D rotation** (a CSS 3D transform, not just a fade),
  before it's removed and the attacker settles onto the square. Every piece token itself is also
  shaded like a carved stone figure (a lit highlight and a shadowed edge, via a radial gradient and
  layered shadows) rather than a flat-colored circle, so the board reads as three-dimensional
  pieces rather than flat icons. This is still a stylized, CSS-only effect — there are no sculpted
  3D character models (that would need a 3D art pipeline and a rendering library like Three.js,
  a much bigger addition than this project's "plain HTML/CSS/JS, no build step" constraint allows)
  — but it is a genuine fight-and-defeat animation, not a placeholder. If there's time left after
  the roadmap's required tasks, true sculpted 3D models are a natural next step beyond this
  project's scope — see the "Out of scope" list in Section 6.
- **Check** highlights the king in danger (e.g. a red glow on its square).
- **The last move made** stays highlighted (start and end square) so a second glance at the board
  shows what just happened — useful in hot-seat play when the board is shared.
- **Legal move hints**: clicking/tapping your own piece highlights every square it may legally
  move to. This is how "an illegal move must be impossible to make" (Section 4) is enforced in the
  interface — you are only ever able to click a highlighted, legal square.

## 3. The three modes

### 3.1 Hot-Seat

Two people, one screen, one browser tab, no internet connection required beyond loading the page.
Players alternate turns on the same board; there is no player-identity system — whoever's turn it
is makes the move. This mode must work entirely with files served to the browser (see Section 7);
it needs no server-side game logic once the page is loaded.

### 3.2 VS Computer

Before the game starts, the human player chooses to play **White or Black**; the computer plays
whichever color the human did not choose. (White always moves first in chess, so if the computer
is White, it makes the opening move immediately.) The computer's move-choosing logic — described
in Section 5 — runs **in the browser itself**, not on the server, so there is no server round-trip
delay and this mode also works with only static files.

### 3.3 Online

Two players on two different devices, connected through the internet, each typing the same short
**room code** to land in the same game.

- The **first** person to enter a room code becomes **White**; the **second** becomes **Black**.
- Anyone who enters the same room code after that becomes a **spectator** — they see the live game
  but cannot move pieces.
- **The server is the referee**: every move either player makes is sent to the server, checked
  against the rules engine there, and only becomes real once the server accepts it and relays it
  back out. A player's browser never decides on its own that a move happened — it just displays
  whatever the server confirmed. This is what stops one player's browser from ever showing a
  different board than the other's.
- **Refreshing the page rejoins the same game** — reloading the browser (accidentally or on
  purpose) does not lose your seat at the board or the game's progress, because the current
  position is saved on the server after every move (see "no timers" in Section 7) and the browser
  simply re-asks for the current state when it reconnects.
- **"New game" resets the board for both players** — either player starting a new game clears the
  room back to the starting position for everyone connected to that room code.

## 4. Chess rules — the non-negotiable baseline

Every mode must implement complete, standard chess. For a reader new to chess, here's what each
required rule means:

- **All six piece types**, each moving by its standard rule (e.g. a bishop only moves diagonally).
- **Check** — a position where the king is under direct attack and must be gotten out of danger on
  the very next move.
- **Checkmate** — a check that cannot be escaped by any legal move; the game ends, that player
  loses.
- **Stalemate** — the player to move has no legal move available, but their king is *not* in
  check; the game ends in a draw (a tie — nobody wins).
- **Castling** — a special one-time move where the king and a rook move together, if neither has
  moved yet, nothing sits between them, and the king doesn't pass through or land on an attacked
  square.
- **En passant** ("in passing") — a special pawn capture available for one move only, right after
  an enemy pawn advances two squares past your pawn.
- **Promotion** — when a pawn reaches the far end of the board, it must turn into a queen, rook,
  bishop, or knight (the player's choice) — it can never stay a pawn or become a king.

**An illegal move must be impossible to make** — not just rejected after the fact with an error
message. In practice this means the interface only ever highlights and accepts squares that
`rules.js` (see Section 7) confirms are legal for the selected piece, in every mode.

### 4.1 Proving the rules engine is correct

Chess move-generation code is notoriously easy to get subtly wrong (for example, forgetting that
castling is illegal while in check, or that a pinned piece can't move even if its own move pattern
looks legal). The standard way to catch these bugs is a **perft test** ("performance test", though
in practice it's a correctness test): count the total number of possible move sequences starting
from the normal opening position, going 1, 2, and 3 moves deep. Chess has known, universally
agreed-on correct answers:

| Depth | Correct count |
|---|---|
| 1 | 20 |
| 2 | 400 |
| 3 | 8,902 |

`rules.js` must reproduce these three numbers exactly before any UI or game mode is built on top of
it (Roadmap Task 1). If the numbers don't match, there is a bug in how some piece moves, and it
must be fixed before building anything else — a wrong rules engine would otherwise quietly corrupt
every mode at once, since all three modes share this one file.

## 5. The computer opponent

The computer's move-picking logic is called **minimax with alpha-beta pruning**, run at **depth 2**,
and it must always respond with a legal move within **two seconds**.

In plain terms:

- **Minimax**: the computer looks at every move it could make. For each one, it then looks at
  every move *you* could make in response, and assumes you will always pick your best possible
  reply (the reply that is worst for the computer) — chess engines call this "assuming optimal
  play from the opponent." The computer then picks whichever of its own moves leaves it best off
  *after* your best possible response, not just the move that looks best right away.
- **Depth 2** means the computer thinks two "plies" (half-moves) ahead: its move, then your
  reply — it is not planning ten moves into the future, which keeps it fast enough to respond in
  under two seconds, at the cost of not being a very strong player. That tradeoff is intentional
  for this project's scope.
- **Alpha-beta pruning** is a bookkeeping shortcut: while minimax is exploring, as soon as it can
  prove a particular branch of moves can't possibly be chosen (because the computer already found
  something at least as good elsewhere), it stops exploring that branch early instead of finishing
  it out. This produces the *exact same* final choice as plain minimax, just faster — which is why
  it's used rather than lowering the depth.
- **Board evaluation**: at the bottom of the search, positions are scored mainly by material (each
  captured piece is worth points — pawn=1, knight/bishop=3, rook=5, queen=9 — standard values used
  across chess programming) so the computer prefers positions where it has won more material than
  it's lost.
- **Runs in the browser**: this logic executes as JavaScript in the player's own browser tab, not
  on the Cloudflare Worker server — so there's no network delay, and it works even if Hot-Seat/VS
  Computer are opened without any online room. This also means it reuses `rules.js` directly, the
  same way the UI does.

## 6. Out of scope

These are explicitly **not** being built, so time isn't spent on them by accident:

- User accounts or logins of any kind
- Chess clocks / time controls
- Player ratings or rankings
- Draw by threefold repetition or the fifty-move rule (draws only happen here via stalemate)
- Opening books (pre-programmed "best" opening moves for the computer)
- Move export (e.g. PGN notation files)
- React or any other frontend framework — plain HTML, CSS, and JavaScript only
- Full animated battle sequences beyond the short capture effect in Section 2.2

## 7. Technical architecture

This section explains the required technology choices in plain English; the roadmap turns these
into build tasks.

- **Cloudflare Workers (Free plan)** — the whole game (both the static files the browser loads and
  the backend logic for online rooms) runs on Cloudflare's Workers platform, which is free at this
  project's scale. "Static site via assets" means the HTML/CSS/JS files are served directly and
  fast; `not_found_handling: "single-page-application"` means any URL that isn't a real file still
  loads `index.html` (so refreshing or sharing a link never 404s); `run_worker_first` is turned on
  specifically for the WebSocket connection path, so *that* one path always runs our backend code
  instead of being treated as a static file request.
- **`compatibility_date`** is set to the day the Worker is first configured, and `observability` is
  turned on — this gives built-in logging inside the Cloudflare dashboard so problems in the live
  game can be diagnosed without adding a separate logging tool.
- **One shared rules module (`rules.js`)** — written from scratch, with no outside chess library.
  Hot-Seat, VS Computer, and the Online server all import and call this same file, so "what counts
  as a legal move" is defined in exactly one place and can never drift between modes.
- **Online rooms use one SQLite-backed Durable Object per room**, created with
  `env.ROOM.getByName(roomCode)`. A Durable Object is a Cloudflare Worker that *persists* — unlike
  a normal Worker, which forgets everything between requests, a Durable Object keeps its own
  private state and its own small SQLite database (`new_sqlite_classes`), so it can act as the one
  authoritative referee for a single room's game, no matter how many messages come in. Using a
  *separate* Durable Object per room (via the room code) means every game is fully isolated from
  every other game automatically.
- **No timers of any kind** — instead of periodically auto-saving on a schedule, the Durable Object
  saves the full position to its SQLite storage after *every single move*. Combined with "refresh
  rejoins the same game" (Section 3.3), this means there's never a window where a move could be
  lost if a player's browser or the Durable Object restarts.
- **Native WebSockets** — the live "see the opponent's move instantly" connection uses the
  WebSocket support built directly into Cloudflare Workers (`ctx.acceptWebSocket()`), not a
  separate library like Socket.IO. Messages sent over the socket are plain JSON objects shaped
  like `{ "type": "...", "payload": {...} }` (e.g. `{"type": "move", "payload": {"from": "e2",
  "to": "e4"}}`), which keeps the protocol easy to read and extend.
- **Player identity via `ws.serializeAttachment()`** — when a player connects and is assigned
  White or Black (or spectator), that assignment is stored directly on their WebSocket connection
  object using this built-in method, so the Durable Object always knows which color sent which
  message without needing a separate login system (which is explicitly out of scope).

## 8. Definition of "done"

Royal Combat is complete when:

1. All three modes are playable start-to-finish with full legal chess rules, including check,
   checkmate, stalemate, castling, en passant, and promotion with a piece choice.
2. No illegal move can be made in any mode.
3. `rules.js` passes the perft test (20 / 400 / 8,902) and is the only rules implementation used
   anywhere in the project.
4. The computer opponent always replies with a legal move within two seconds.
5. Two devices can join the same online room by room code, see each other's moves live, survive a
   page refresh without losing the game, and reset the game for both players via "New game."
6. The game is deployed and reachable on the public internet via Cloudflare Workers.
7. The chosen optional extra — **captured pieces + a running material count** — is implemented
   last, after everything above is working.
