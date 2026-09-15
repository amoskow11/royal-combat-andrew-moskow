# Royal Combat — Feature Roadmap / Work Plan

Every task below is a checkbox. Work top to bottom — later tasks depend on earlier ones, as noted.
Each task lists which files it touches and its **Definition of Done (DoD)** — the specific,
checkable condition that means the task is actually finished, not just "looks right."

Build order, as specified: the rules engine first (nothing else can be trusted until it's
correct), then **Hot-Seat live on the internet**, then **VS Computer**, then **Online rooms**,
then the optional extra.

---

## Phase 0 — Repository setup

- [x] **Task 0.1 — Create the GitHub repository and initial commit**
  - Dependencies: none
  - Files: `.gitignore`
  - DoD: Repo `royal-combat-andrew-moskow` exists on GitHub under account `amoskow11`, with an
    initial commit on `main`.
- [x] **Task 0.2 — Write the foundational docs**
  - Dependencies: 0.1
  - Files: `README.md`, `ProductSpec.md`, `FEATUREROADMAP_workplan.md`
  - DoD: All three files exist, describe the full project, and this roadmap is what you're reading
    right now. (You're here — this is the task that produced this document.)

---

## Phase 1 — Rules engine (`rules.js`)

**Nothing in Phase 2, 3, or 4 may start until every task in this phase is checked off and the
perft numbers match exactly.** This is the "fix the rules before building anything else" rule from
the spec — every mode shares this one file, so a bug here would quietly break all three at once.

- [ ] **Task 1.1 — Board representation**
  - Dependencies: none
  - Files: `rules.js`
  - What it is: the data structure that stores a chess position — where every piece is, whose turn
    it is, whether each side can still castle, and the "en passant target square" (the square a
    pawn could capture into, if a special en-passant capture is available this move).
  - DoD: A function exists that produces the standard starting position in this format, and it's
    checked by a simple test that counts exactly 32 pieces (16 per side) placed correctly.

- [ ] **Task 1.2 — Pseudo-legal move generation, per piece**
  - Dependencies: 1.1
  - Files: `rules.js`
  - What it is: "pseudo-legal" means *a move follows that piece's movement pattern*, without yet
    checking whether it would leave your own king in check (that check happens in Task 1.3). Every
    piece type needs its own logic: pawn (forward one, forward two from the start rank, diagonal
    capture only, reaching the last rank), knight (L-shape), bishop (diagonals), rook
    (horizontal/vertical), queen (bishop + rook combined), king (one square any direction).
  - DoD: For the starting position, generating pseudo-legal moves for White produces exactly 20
    moves (16 pawn moves + 4 knight moves) — this is the same number the perft test checks in Task
    1.6, so getting it right here is what makes that test pass later.

- [ ] **Task 1.3 — Legal move filtering (check detection)**
  - Dependencies: 1.2
  - Files: `rules.js`
  - What it is: a move is only truly *legal* if making it does not leave your own king under
    attack. This requires an "is this square under attack by the other side" helper, which is then
    used to (a) filter the pseudo-legal move list and (b) detect check itself.
  - DoD: A hand-built test position where a piece is "pinned" (moving it would expose the king to
    attack) correctly shows that piece has zero or fewer legal moves than its raw movement pattern
    would suggest.

- [ ] **Task 1.4 — Special moves: castling, en passant, promotion**
  - Dependencies: 1.3
  - Files: `rules.js`
  - What it is: three rule exceptions described in [ProductSpec.md](ProductSpec.md) Section 4.
    Castling and en passant each have their own legality conditions beyond normal movement;
    promotion means a pawn move can produce a choice (queen/rook/bishop/knight) rather than a
    single result.
  - DoD: Three hand-built test positions — one where castling is legal, one where it's illegal
    because the king would pass through check, and one where en passant is available — all produce
    the correct legal-move list. A promotion move returns all four possible resulting pieces as
    separate options rather than picking one automatically.

- [ ] **Task 1.5 — Game-end detection: checkmate and stalemate**
  - Dependencies: 1.4
  - Files: `rules.js`
  - What it is: after filtering to legal moves, if the side to move has zero legal moves, the game
    is over — checkmate if their king is in check, stalemate (a draw) if it isn't.
  - DoD: A known checkmate position (e.g. "Fool's Mate") and a known stalemate position each
    correctly report zero legal moves and the correct end-game result.

- [ ] **Task 1.6 — Perft test**
  - Dependencies: 1.1–1.5
  - Files: `rules.js`, `rules.test.js`
  - What it is: the move-count proof described in ProductSpec Section 4.1 — from the starting
    position, count every possible sequence of moves 1, 2, and 3 moves deep.
  - DoD: Running the test produces **exactly** 20 at depth 1, 400 at depth 2, and 8,902 at depth 3.
    No task in Phase 2 or later begins until this passes.

---

## Phase 2 — Hot-Seat, live on the internet

Goal: the simplest mode, fully playable, actually deployed and reachable on the public internet —
proving the whole Cloudflare Workers pipeline works before anything else is layered on top.

- [ ] **Task 2.1 — Cloudflare project scaffolding**
  - Dependencies: Phase 1 complete
  - Files: `package.json`, `wrangler.jsonc`, `worker.js`, `public/index.html` (placeholder)
  - What it is: the minimum configuration for Cloudflare Workers to serve static files, as
    described in ProductSpec Section 7 — `assets` pointing at the `public/` folder,
    `not_found_handling: "single-page-application"`, today's date as `compatibility_date`, and
    `observability` turned on.
  - DoD: `npx wrangler dev` serves the placeholder page on your own computer with no errors.

- [ ] **Task 2.2 — Board rendering**
  - Dependencies: 2.1
  - Files: `public/index.html`, `public/style.css`, `public/app.js`
  - What it is: draw an 8x8 board and place every piece from `rules.js`'s starting position onto
    it, using the piece roster from ProductSpec Section 2.1 (placeholder art is fine until the
    Figma file is linked — see the note at the top of ProductSpec.md).
  - DoD: Loading the page in a browser shows a correctly arranged starting chess position, matching
    the standard layout square-for-square.

- [ ] **Task 2.3 — Move interaction**
  - Dependencies: 2.2
  - Files: `public/app.js`
  - What it is: clicking/tapping a piece calls `rules.js` for that piece's legal destination
    squares and highlights them; clicking a highlighted square applies the move, re-renders the
    board, and hands the turn to the other player. Clicking anywhere else must do nothing.
  - DoD: Playing manually, it is impossible to move a piece to a non-highlighted square, and the
    turn correctly alternates White/Black after every move.

- [ ] **Task 2.4 — Special-move UI**
  - Dependencies: 2.3
  - Files: `public/app.js`, `public/index.html`
  - What it is: a popup/menu for choosing the promotion piece when a pawn reaches the last rank;
    castling and en passant need no extra UI beyond being selectable like any other legal move
    (Task 2.3 already highlights them because `rules.js` includes them in the legal-move list).
  - DoD: Manually reaching a promotion square shows a choice of queen/rook/bishop/knight and the
    chosen piece appears on the board; castling and en passant can both be performed by clicking
    the highlighted destination square.

- [ ] **Task 2.5 — Game-status UI**
  - Dependencies: 2.4
  - Files: `public/app.js`, `public/index.html`, `public/style.css`
  - What it is: visible feedback for check (Section 2.2 of ProductSpec), and an end-of-game banner
    for checkmate/stalemate that names the result; a "New Game" button that resets the board to the
    starting position.
  - DoD: Manually playing into checkmate and separately into stalemate each show the correct banner
    with no further moves possible; "New Game" returns the board to the starting position at any
    point in a game.

- [ ] **Task 2.6 — Capture animation and last-move highlight**
  - Dependencies: 2.5
  - Files: `public/app.js`, `public/style.css`
  - What it is: THE LOOK requirement from ProductSpec Section 2.2 — a short battle-style effect
    when a piece is captured, a smooth slide for normal moves, and the most recent move's start/end
    squares staying visibly marked.
  - DoD: Manually capturing a piece shows the battle effect before the captured piece disappears;
    the previous move's two squares stay highlighted until the next move is made.

- [ ] **Task 2.7 — Deploy Hot-Seat live**
  - Dependencies: 2.1–2.6
  - Files: `wrangler.jsonc`
  - What it is: publish the app with `npx wrangler deploy` so it's reachable at a real
    `*.workers.dev` URL (or custom domain, if one is set up later).
  - DoD: A full hot-seat game — including at least one castle, one promotion, and a checkmate —
    can be played start-to-finish from the public URL, not just `wrangler dev` on your own machine.

---

## Phase 3 — VS Computer

- [ ] **Task 3.1 — Color-choice screen**
  - Dependencies: Phase 2 complete
  - Files: `public/index.html`, `public/app.js`
  - What it is: before a VS Computer game starts, let the player pick White or Black (ProductSpec
    Section 3.2). If the computer is White, it must make the opening move immediately.
  - DoD: Choosing either color correctly assigns the human to that side, and choosing Black
    immediately triggers a computer move before the human can act.

- [ ] **Task 3.2 — Position evaluation function**
  - Dependencies: Phase 1 complete
  - Files: `rules.js` or a new `ai.js` (only file to add outside `rules.js`'s reuse rule — the AI
    logic itself is not "rules," so it can live in its own module, but it must call into `rules.js`
    for legality)
  - What it is: a function that scores any given board position using the standard piece values
    from ProductSpec Section 5 (pawn=1, knight/bishop=3, rook=5, queen=9), from the computer's
    point of view.
  - DoD: A test position with an extra queen for one side scores strongly in that side's favor; the
    starting position scores at (or extremely near) zero, since material is equal.
  - Depends on: Phase 1 (uses `rules.js`'s move generator).

- [ ] **Task 3.3 — Minimax with alpha-beta pruning, depth 2**
  - Dependencies: 3.2
  - Files: `ai.js`
  - What it is: the search algorithm from ProductSpec Section 5 — try every legal move, assume the
    opponent's best reply, and pick the move with the best guaranteed outcome, using alpha-beta
    pruning to skip branches that can't matter.
  - DoD: Given several hand-picked test positions with an obvious best move (e.g. "capture the
    undefended queen"), the function returns that move every time.

- [ ] **Task 3.4 — Wire the computer into the game loop**
  - Dependencies: 3.1, 3.3
  - Files: `public/app.js`
  - What it is: after the human's move, automatically call the AI, apply its returned move to the
    board, and re-render — reusing the same move-application code Hot-Seat already has.
  - DoD: A full VS Computer game can be played to checkmate or stalemate; timing it over 20 sample
    computer moves shows every single one returned in under two seconds.

- [ ] **Task 3.5 — Deploy VS Computer update**
  - Dependencies: 3.1–3.4
  - Files: `wrangler.jsonc`
  - DoD: VS Computer is playable start-to-finish from the public URL, both playing as White and as
    Black.

---

## Phase 4 — Online rooms

- [ ] **Task 4.1 — Durable Object configuration**
  - Dependencies: Phase 2 complete
  - Files: `wrangler.jsonc`
  - What it is: add the Durable Object binding (`ROOM`) with `new_sqlite_classes` so each online
    room gets its own persistent, SQLite-backed instance (ProductSpec Section 7), and turn on
    `run_worker_first` specifically for the WebSocket connection path.
  - DoD: `npx wrangler dev` starts with no configuration errors and the Durable Object binding is
    visible in Wrangler's startup output.

- [ ] **Task 4.2 — Room Durable Object: connection and identity**
  - Dependencies: 4.1
  - Files: `room.js`
  - What it is: the Durable Object class that accepts WebSocket connections via
    `ctx.acceptWebSocket()`, and assigns each connecting player White (first), Black (second), or
    spectator (third and later) using `ws.serializeAttachment()` to remember that assignment.
  - DoD: Connecting three separate test WebSocket clients to the same room code results in the
    first being told it's White, the second Black, and the third spectator.

- [ ] **Task 4.3 — Routing room codes to Durable Objects**
  - Dependencies: 4.2
  - Files: `worker.js`
  - What it is: the main Worker reads the room code from the connection request and looks up (or
    creates) that room's Durable Object with `env.ROOM.getByName(roomCode)`, then hands off the
    WebSocket upgrade to it.
  - DoD: Two different room codes, connected to at the same time, produce two completely separate
    games that never see each other's moves.

- [ ] **Task 4.4 — Client: join screen and live connection**
  - Dependencies: 4.3
  - Files: `public/index.html`, `public/app.js`
  - What it is: a screen to type/enter a room code, open a WebSocket to the server, and handle the
    JSON messages described in ProductSpec Section 7 (`{"type": ..., "payload": ...}`).
  - DoD: Entering the same room code in two separate browser windows connects both to the same
    room and each is told its correct role (White/Black/spectator).

- [ ] **Task 4.5 — Server-authoritative move validation**
  - Dependencies: 4.4
  - Files: `room.js`
  - What it is: when a move message arrives, the Durable Object — not the browser — calls
    `rules.js` to check it's legal for the player who sent it and for the current turn, applies it
    if valid, and broadcasts the resulting board to every connected socket in the room (including
    spectators). Invalid or out-of-turn moves are rejected and not broadcast.
  - DoD: Attempting to move out of turn, or move an illegal move, from one browser window produces
    no change on either window; a legal move made in one window appears in the other within about a
    second.

- [ ] **Task 4.6 — Persistence and rejoin**
  - Dependencies: 4.5
  - Files: `room.js`
  - What it is: after every accepted move, save the full position to the Durable Object's SQLite
    storage (no timers — save happens as part of handling the move itself, per ProductSpec Section
    7). When any client (re)connects, send it the current saved state.
  - DoD: Mid-game, closing and reopening (or simply refreshing) one player's browser tab reconnects
    them to the same game at the exact position it was left at, with their same color assignment.

- [ ] **Task 4.7 — New Game (online)**
  - Dependencies: 4.6
  - Files: `room.js`, `public/app.js`
  - What it is: either player triggering "New Game" resets the room's saved position to the
    starting position and broadcasts that reset to everyone connected.
  - DoD: Clicking "New Game" in one browser window resets the board in both connected windows
    simultaneously.

- [ ] **Task 4.8 — Deploy and two-device test**
  - Dependencies: 4.1–4.7
  - Files: `wrangler.jsonc`
  - DoD: A full game, including at least one castle/promotion/checkmate, is played to completion
    using the same room code entered on two genuinely separate devices (e.g. laptop + phone) over
    the public internet.

---

## Phase 5 — Optional extra: Captured pieces + material count

- [ ] **Task 5.1 — Track captures**
  - Dependencies: Phase 2, 3, and 4 all complete
  - Files: `public/app.js` (and `room.js` for the online case)
  - What it is: whenever a move captures a piece, record which piece and which side lost it, in
    every mode (hot-seat, vs computer, and online — where this must be derived from the
    server-confirmed move, not guessed client-side).
  - DoD: Playing a short game with several captures in each mode produces an accurate list of what
    was captured, in order, in all three modes.

- [ ] **Task 5.2 — Captured-pieces display**
  - Dependencies: 5.1
  - Files: `public/index.html`, `public/style.css`, `public/app.js`
  - What it is: show each side's captured pieces as small icons alongside the board.
  - DoD: The display visibly updates immediately after every capture, correctly grouped by which
    side lost the piece.

- [ ] **Task 5.3 — Material count**
  - Dependencies: 5.1, reuses the scoring values from Task 3.2
  - Files: `public/app.js`
  - What it is: a running total, using the same piece values as the AI's evaluation function
    (pawn=1, knight/bishop=3, rook=5, queen=9), showing which side is ahead in material and by how
    much.
  - DoD: The displayed material difference matches a hand-calculated total at several points
    through a test game.

- [ ] **Task 5.4 — Final deploy**
  - Dependencies: 5.1–5.3
  - Files: `wrangler.jsonc`
  - DoD: The captured-pieces display and material count are visible and correct on the public URL,
    in all three modes.

---

## Git workflow used for every task above

Per the project rules: each task gets its own branch, is committed once complete, pushed, and
opened as a pull request for review — nothing is force-pushed, and the rules engine (Phase 1) is
never bypassed or skipped for a later phase.
