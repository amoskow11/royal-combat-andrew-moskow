// rules.test.js — the perft ("move-count") proof that rules.js is correct.
// See ProductSpec.md Section 4.1. These three counts are universally agreed
// on for the standard chess starting position; if any don't match, a piece's
// movement rule (or check/castling/en passant handling) has a bug.
import { initialState, perft, getGameStatus, generateLegalMoves, makeMove, squareToIndex, WHITE, BLACK } from './rules.js';

const expected = { 1: 20, 2: 400, 3: 8902 };
let allPassed = true;

for (const [depthStr, expectedCount] of Object.entries(expected)) {
  const depth = Number(depthStr);
  const actual = perft(initialState(), depth);
  const passed = actual === expectedCount;
  allPassed = allPassed && passed;
  console.log(`perft(${depth}) = ${actual}  (expected ${expectedCount})  ${passed ? 'PASS' : 'FAIL'}`);
}

// A quick sanity check on game-end detection, independent of perft counts.
const foolsMateMoves = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
console.log(`\nFool's Mate status: ${playOutAndReport(foolsMateMoves)}`);

function playOutAndReport(uciMoves) {
  let state = initialState();
  for (const uci of uciMoves) {
    const from = squareToIndex(uci.slice(0, 2));
    const to = squareToIndex(uci.slice(2, 4));
    const move = generateLegalMoves(state).find(m => m.from === from && m.to === to);
    if (!move) return `FAIL — ${uci} was not found as a legal move`;
    state = makeMove(state, move);
  }
  return getGameStatus(state);
}

// Perft at depth 3 never reaches castling, en passant, or promotion (each
// needs more half-moves than that to become available) — so it proves core
// movement and check-evasion are right, but the three special rules need
// their own hand-built positions, same as ProductSpec.md Section 4.1 warns.

function buildState(pieces, turn) {
  const board = new Array(64).fill(null);
  for (const [square, piece] of Object.entries(pieces)) board[squareToIndex(square)] = piece;
  return { board, turn, castling: { wK: false, wQ: false, bK: false, bQ: false }, epTarget: null };
}

function check(label, condition) {
  console.log(`${label}: ${condition ? 'PASS' : 'FAIL'}`);
  allPassed = allPassed && condition;
}

// Stalemate: Black king boxed in on a8, not in check, no legal move.
const stalemate = buildState({ a8: 'bK', a6: 'wK', b6: 'wQ' }, BLACK);
check('Stalemate detection', getGameStatus(stalemate) === 'stalemate');

// Promotion: a lone pawn one step from the last rank must offer all four pieces.
const promotionState = buildState({ e1: 'wK', e8: 'bK', a7: 'wP' }, WHITE);
const promotionMoves = generateLegalMoves(promotionState).filter(m => m.to === squareToIndex('a8'));
check(
  'Promotion offers all four pieces',
  ['Q', 'R', 'B', 'N'].every(p => promotionMoves.some(m => m.promotion === p)),
);

// En passant: after 1.e4 a6 2.e5 d5, White's e5 pawn may capture d5 in passing.
let epState = initialState();
for (const uci of ['e2e4', 'a7a6', 'e4e5', 'd7d5']) {
  const from = squareToIndex(uci.slice(0, 2));
  const to = squareToIndex(uci.slice(2, 4));
  epState = makeMove(epState, generateLegalMoves(epState).find(m => m.from === from && m.to === to));
}
const epMove = generateLegalMoves(epState).find(m => m.from === squareToIndex('e5') && m.to === squareToIndex('d6'));
check('En passant capture is offered', Boolean(epMove?.enPassant));
if (epMove) {
  const afterEp = makeMove(epState, epMove);
  check('En passant removes the captured pawn', afterEp.board[squareToIndex('d5')] === null);
}

// Castling through check must be refused (assignment call-out): a rook on the
// f-file attacks f1, so White may not castle kingside even with full rights.
const blockedCastle = buildState({ e1: 'wK', h1: 'wR', e8: 'bK', f6: 'bR' }, WHITE);
blockedCastle.castling.wK = true;
check(
  'Castling through an attacked square is refused',
  !generateLegalMoves(blockedCastle).some(m => m.castle === 'K'),
);

// And the positive case: with the attacker gone, kingside castling is legal.
const openCastle = buildState({ e1: 'wK', h1: 'wR', e8: 'bK' }, WHITE);
openCastle.castling.wK = true;
check(
  'Castling is offered when the path is safe',
  generateLegalMoves(openCastle).some(m => m.castle === 'K'),
);

if (!allPassed) {
  console.error('\nSome checks FAILED — fix rules.js before building anything else.');
  process.exit(1);
} else {
  console.log('\nAll perft counts and rule checks pass. rules.js is verified correct.');
}
