// rules.js — the one shared chess rules engine for Royal Combat.
// Hot-seat, VS Computer, and the online Durable Object all call into this
// file for move generation and legality. See ProductSpec.md Section 4 and 7.
//
// A "state" is a plain object: { board, turn, castling, epTarget }.
//   board    — array of 64 squares, index = rank*8 + file (a1=0, h1=7, a8=56, h8=63).
//              Each square holds a piece code like "wP"/"bK", or null if empty.
//   turn     — "w" or "b": whose move it is.
//   castling — { wK, wQ, bK, bQ }: whether that side may still castle that way.
//   epTarget — the square index a pawn could capture into via en passant
//              right now, or null if none is available.
// A "move" is { from, to, captured?, promotion?, castle?, enPassant?, epCapturedSquare?, doublePawn? }.

const FILES = 'abcdefgh';
export const WHITE = 'w';
export const BLACK = 'b';

export function opponent(side) {
  return side === WHITE ? BLACK : WHITE;
}

export function squareToIndex(square) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return rank * 8 + file;
}

export function indexToSquare(index) {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return FILES[file] + (rank + 1);
}

function fileOf(index) { return index % 8; }
function rankOf(index) { return Math.floor(index / 8); }
function inBounds(file, rank) { return file >= 0 && file < 8 && rank >= 0 && rank < 8; }

export function pieceColor(piece) { return piece[0]; }
export function pieceType(piece) { return piece[1]; }

export function initialState() {
  const board = new Array(64).fill(null);
  const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let file = 0; file < 8; file++) {
    board[0 * 8 + file] = 'w' + backRank[file];
    board[1 * 8 + file] = 'wP';
    board[6 * 8 + file] = 'bP';
    board[7 * 8 + file] = 'b' + backRank[file];
  }
  return {
    board,
    turn: WHITE,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epTarget: null,
  };
}

const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_OFFSETS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];

function generateSlidingMoves(board, index, dirs, color) {
  const moves = [];
  const startFile = fileOf(index);
  const startRank = rankOf(index);
  for (const [df, dr] of dirs) {
    let file = startFile + df;
    let rank = startRank + dr;
    while (inBounds(file, rank)) {
      const target = rank * 8 + file;
      const occupant = board[target];
      if (!occupant) {
        moves.push({ from: index, to: target });
      } else {
        if (pieceColor(occupant) !== color) moves.push({ from: index, to: target, captured: occupant });
        break;
      }
      file += df;
      rank += dr;
    }
  }
  return moves;
}

function generateStepMoves(board, index, offsets, color) {
  const moves = [];
  const startFile = fileOf(index);
  const startRank = rankOf(index);
  for (const [df, dr] of offsets) {
    const file = startFile + df;
    const rank = startRank + dr;
    if (!inBounds(file, rank)) continue;
    const target = rank * 8 + file;
    const occupant = board[target];
    if (!occupant) {
      moves.push({ from: index, to: target });
    } else if (pieceColor(occupant) !== color) {
      moves.push({ from: index, to: target, captured: occupant });
    }
  }
  return moves;
}

function addPawnMove(moves, from, to, captured, isPromotion) {
  if (isPromotion) {
    for (const promotion of ['Q', 'R', 'B', 'N']) {
      moves.push({ from, to, captured: captured || null, promotion });
    }
  } else {
    moves.push({ from, to, captured: captured || null });
  }
}

function generatePawnMoves(state, index) {
  const { board, epTarget } = state;
  const color = pieceColor(board[index]);
  const direction = color === WHITE ? 1 : -1;
  const startRank = color === WHITE ? 1 : 6;
  const promotionRank = color === WHITE ? 7 : 0;
  const file = fileOf(index);
  const rank = rankOf(index);
  const moves = [];

  const oneStepRank = rank + direction;
  if (inBounds(file, oneStepRank)) {
    const oneStep = oneStepRank * 8 + file;
    if (!board[oneStep]) {
      addPawnMove(moves, index, oneStep, null, oneStepRank === promotionRank);
      const twoStepRank = rank + direction * 2;
      if (rank === startRank && inBounds(file, twoStepRank)) {
        const twoStep = twoStepRank * 8 + file;
        if (!board[twoStep]) moves.push({ from: index, to: twoStep, doublePawn: true });
      }
    }

    for (const df of [-1, 1]) {
      const captureFile = file + df;
      if (!inBounds(captureFile, oneStepRank)) continue;
      const target = oneStepRank * 8 + captureFile;
      const occupant = board[target];
      if (occupant && pieceColor(occupant) !== color) {
        addPawnMove(moves, index, target, occupant, oneStepRank === promotionRank);
      } else if (target === epTarget) {
        const epCapturedSquare = rank * 8 + captureFile;
        moves.push({ from: index, to: target, captured: board[epCapturedSquare], enPassant: true, epCapturedSquare });
      }
    }
  }

  return moves;
}

// Castling: the king must not currently be in check, the squares between king
// and rook must be empty, and the squares the king actually passes through or
// lands on must not be attacked. The rook's own path (e.g. b1 on queenside)
// does NOT need to be safe — only the king's path does.
function generateCastlingMoves(state, index) {
  const { board, castling } = state;
  const color = pieceColor(board[index]);
  const rank = rankOf(index);
  const homeSquare = rank * 8 + 4;
  const moves = [];
  if (index !== homeSquare) return moves;
  if (isSquareAttacked(board, index, opponent(color))) return moves;

  const fSquare = rank * 8 + 5;
  const gSquare = rank * 8 + 6;
  const rookHSquare = rank * 8 + 7;
  if (
    castling[color + 'K'] &&
    !board[fSquare] && !board[gSquare] &&
    board[rookHSquare] === color + 'R' &&
    !isSquareAttacked(board, fSquare, opponent(color)) &&
    !isSquareAttacked(board, gSquare, opponent(color))
  ) {
    moves.push({ from: index, to: gSquare, castle: 'K' });
  }

  const dSquare = rank * 8 + 3;
  const cSquare = rank * 8 + 2;
  const bSquare = rank * 8 + 1;
  const rookASquare = rank * 8 + 0;
  if (
    castling[color + 'Q'] &&
    !board[dSquare] && !board[cSquare] && !board[bSquare] &&
    board[rookASquare] === color + 'R' &&
    !isSquareAttacked(board, dSquare, opponent(color)) &&
    !isSquareAttacked(board, cSquare, opponent(color))
  ) {
    moves.push({ from: index, to: cSquare, castle: 'Q' });
  }

  return moves;
}

export function isSquareAttacked(board, index, bySide) {
  const file = fileOf(index);
  const rank = rankOf(index);

  const pawnRank = rank + (bySide === WHITE ? -1 : 1);
  if (inBounds(file - 1, pawnRank) && board[pawnRank * 8 + (file - 1)] === bySide + 'P') return true;
  if (inBounds(file + 1, pawnRank) && board[pawnRank * 8 + (file + 1)] === bySide + 'P') return true;

  for (const [df, dr] of KNIGHT_OFFSETS) {
    const f = file + df, r = rank + dr;
    if (inBounds(f, r) && board[r * 8 + f] === bySide + 'N') return true;
  }

  for (const [df, dr] of KING_OFFSETS) {
    const f = file + df, r = rank + dr;
    if (inBounds(f, r) && board[r * 8 + f] === bySide + 'K') return true;
  }

  for (const [df, dr] of BISHOP_DIRS) {
    let f = file + df, r = rank + dr;
    while (inBounds(f, r)) {
      const occupant = board[r * 8 + f];
      if (occupant) {
        if (pieceColor(occupant) === bySide && (pieceType(occupant) === 'B' || pieceType(occupant) === 'Q')) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  for (const [df, dr] of ROOK_DIRS) {
    let f = file + df, r = rank + dr;
    while (inBounds(f, r)) {
      const occupant = board[r * 8 + f];
      if (occupant) {
        if (pieceColor(occupant) === bySide && (pieceType(occupant) === 'R' || pieceType(occupant) === 'Q')) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  return false;
}

function generatePseudoLegalMoves(state) {
  const { board, turn } = state;
  const moves = [];
  for (let index = 0; index < 64; index++) {
    const piece = board[index];
    if (!piece || pieceColor(piece) !== turn) continue;
    switch (pieceType(piece)) {
      case 'P': moves.push(...generatePawnMoves(state, index)); break;
      case 'N': moves.push(...generateStepMoves(board, index, KNIGHT_OFFSETS, turn)); break;
      case 'B': moves.push(...generateSlidingMoves(board, index, BISHOP_DIRS, turn)); break;
      case 'R': moves.push(...generateSlidingMoves(board, index, ROOK_DIRS, turn)); break;
      case 'Q': moves.push(...generateSlidingMoves(board, index, QUEEN_DIRS, turn)); break;
      case 'K':
        moves.push(...generateStepMoves(board, index, KING_OFFSETS, turn));
        moves.push(...generateCastlingMoves(state, index));
        break;
    }
  }
  return moves;
}

const ROOK_HOME_SQUARES = { 0: 'wQ', 7: 'wK', 56: 'bQ', 63: 'bK' };

export function makeMove(state, move) {
  const board = state.board.slice();
  const piece = board[move.from];
  const color = pieceColor(piece);
  const type = pieceType(piece);

  board[move.from] = null;
  if (move.enPassant) board[move.epCapturedSquare] = null;
  board[move.to] = move.promotion ? color + move.promotion : piece;

  if (move.castle === 'K') {
    const rank = rankOf(move.from);
    board[rank * 8 + 7] = null;
    board[rank * 8 + 5] = color + 'R';
  } else if (move.castle === 'Q') {
    const rank = rankOf(move.from);
    board[rank * 8 + 0] = null;
    board[rank * 8 + 3] = color + 'R';
  }

  const castling = { ...state.castling };
  if (type === 'K') {
    castling[color + 'K'] = false;
    castling[color + 'Q'] = false;
  }
  if (type === 'R' && ROOK_HOME_SQUARES[move.from]) castling[ROOK_HOME_SQUARES[move.from]] = false;
  if (move.captured && ROOK_HOME_SQUARES[move.to]) castling[ROOK_HOME_SQUARES[move.to]] = false;

  const epTarget = move.doublePawn ? (move.from + move.to) / 2 : null;

  return { board, turn: opponent(state.turn), castling, epTarget };
}

export function isInCheck(state, side = state.turn) {
  const kingSquare = state.board.indexOf(side + 'K');
  return isSquareAttacked(state.board, kingSquare, opponent(side));
}

export function generateLegalMoves(state) {
  const pseudoLegal = generatePseudoLegalMoves(state);
  const legal = [];
  for (const move of pseudoLegal) {
    const next = makeMove(state, move);
    if (!isInCheck(next, state.turn)) legal.push(move);
  }
  return legal;
}

export function getGameStatus(state) {
  const legalMoves = generateLegalMoves(state);
  if (legalMoves.length > 0) return 'ongoing';
  return isInCheck(state) ? 'checkmate' : 'stalemate';
}

export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = generateLegalMoves(state);
  if (depth === 1) return moves.length;
  let count = 0;
  for (const move of moves) count += perft(makeMove(state, move), depth - 1);
  return count;
}
