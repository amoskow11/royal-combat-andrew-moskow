import {
  initialState,
  generateLegalMoves,
  makeMove,
  getGameStatus,
  isInCheck,
  pieceColor,
  pieceType,
} from './rules.js';

const PIECE_NAME = { K: 'King', Q: 'Queen', R: 'Foot Knight', B: 'Archer', N: 'Cavalry', P: 'Foot Soldier' };
const SQUARE_PX = 64;
const CAPTURE_ANIMATION_MS = 450;

// Same icon shapes as the Figma chessboard screen — a crown, a castle
// tower, a bow, a horseshoe, and a simple soldier — instead of letter
// abbreviations. `currentColor` follows the .piece element's CSS `color`.
const PIECE_ICON = {
  K: '<path d="M5 19h14"/><path d="M6 19L7 11L9.5 15L12 8L14.5 15L17 11L18 19"/><path d="M12 7V4M10.5 5.5h3"/>',
  Q: '<path d="M5 19h14"/><path d="M6 19L7 11L9.5 15L12 8L14.5 15L17 11L18 19"/><circle cx="7" cy="9.3" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="6.3" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="9.3" r="1" fill="currentColor" stroke="none"/>',
  R: '<path d="M6 20h12"/><path d="M7 20V10"/><path d="M17 20V10"/><path d="M7 10V6h2v3h2V6h2v3h2V6h2v4"/>',
  B: '<path d="M7 4C13 6 13 18 7 20"/><path d="M7 4V20"/><path d="M5 12h12"/><path d="M14 9l3 3-3 3"/>',
  N: '<path d="M8 20v-7a4 4 0 0 1 8 0v7"/><circle cx="7" cy="20" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1" fill="currentColor" stroke="none"/>',
  P: '<circle cx="12" cy="7" r="2.6"/><path d="M9 20c0-5 1-9 3-9s3 4 3 9"/><path d="M7 20h10"/>',
};

function pieceIconSvg(type) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PIECE_ICON[type]}</svg>`;
}

const app = document.getElementById('app');

let screen = 'landing'; // 'landing' | 'game'
let gameState = null;
let selected = null;
let legalTargets = [];
let lastMove = null;
let pendingPromotion = null; // { moves: [move, move, move, move] }
let pieceInstances = []; // [{ id, square, code }]
let nextInstanceId = 0;
const pieceElements = new Map(); // id -> DOM node, kept across renders so CSS transitions animate

function startNewHotSeatGame() {
  gameState = initialState();
  selected = null;
  legalTargets = [];
  lastMove = null;
  pendingPromotion = null;
  pieceElements.clear();
  nextInstanceId = 0;
  pieceInstances = [];
  for (let square = 0; square < 64; square++) {
    const code = gameState.board[square];
    if (code) pieceInstances.push({ id: nextInstanceId++, square, code });
  }
  screen = 'game';
  render();
}

function backToMenu() {
  screen = 'landing';
  render();
}

function instanceAt(square) {
  return pieceInstances.find((instance) => instance.square === square);
}

function onSquareClick(square) {
  if (pendingPromotion) return;
  const piece = gameState.board[square];

  if (selected === null) {
    if (piece && pieceColor(piece) === gameState.turn) {
      selected = square;
      legalTargets = generateLegalMoves(gameState).filter((m) => m.from === square);
      render();
    }
    return;
  }

  if (square === selected) {
    selected = null;
    legalTargets = [];
    render();
    return;
  }

  if (piece && pieceColor(piece) === gameState.turn) {
    selected = square;
    legalTargets = generateLegalMoves(gameState).filter((m) => m.from === square);
    render();
    return;
  }

  const candidates = legalTargets.filter((m) => m.to === square);
  if (candidates.length === 0) {
    selected = null;
    legalTargets = [];
    render();
    return;
  }

  if (candidates.length > 1) {
    pendingPromotion = { moves: candidates };
    render();
    return;
  }

  commitMove(candidates[0]);
}

function commitMove(move) {
  selected = null;
  legalTargets = [];
  pendingPromotion = null;

  const movedInstance = instanceAt(move.from);
  const capturedSquare = move.enPassant ? move.epCapturedSquare : move.to;
  const capturedInstance = move.captured ? instanceAt(capturedSquare) : null;

  // Slide the moving piece (and the rook, on castling) into place now, so the
  // CSS transition on the piece's position animates — this is the "pieces
  // glide across the board" requirement from ProductSpec Section 2.2.
  movedInstance.square = move.to;
  if (move.castle) {
    const rank = Math.floor(move.from / 8);
    const rookFrom = move.castle === 'K' ? rank * 8 + 7 : rank * 8 + 0;
    const rookTo = move.castle === 'K' ? rank * 8 + 5 : rank * 8 + 3;
    instanceAt(rookFrom).square = rookTo;
  }

  if (capturedInstance) {
    capturedInstance.defeated = true;
    movedInstance.attacking = true;
    render();
    window.setTimeout(() => {
      pieceInstances = pieceInstances.filter((i) => i !== capturedInstance);
      pieceElements.get(capturedInstance.id)?.remove();
      pieceElements.delete(capturedInstance.id);
      movedInstance.attacking = false;
      finishMove(move, movedInstance);
    }, CAPTURE_ANIMATION_MS);
  } else {
    finishMove(move, movedInstance);
  }
}

function finishMove(move, movedInstance) {
  lastMove = { from: move.from, to: move.to };
  gameState = makeMove(gameState, move);
  if (move.promotion) movedInstance.code = pieceColor(movedInstance.code) + move.promotion;
  render();
}

function render() {
  app.replaceChildren();
  if (screen === 'landing') renderLanding();
  else renderGame();
}

function renderLanding() {
  const title = document.createElement('h1');
  title.className = 'landing-title';
  title.textContent = 'Royal Combat';
  app.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'landing-subtitle';
  subtitle.textContent = 'A chessboard where every capture is a battle won.';
  app.appendChild(subtitle);

  const row = document.createElement('div');
  row.className = 'mode-row';

  row.appendChild(modeButton('Hot-Seat', 'Two players, one screen', () => startNewHotSeatGame(), false));
  row.appendChild(modeButton('vs Computer', 'Coming in Phase 3', null, true));
  row.appendChild(modeButton('Online', 'Coming in Phase 4', null, true));

  app.appendChild(row);
}

function modeButton(label, sub, onClick, disabled) {
  const btn = document.createElement('button');
  btn.className = 'mode-button cinzel';
  btn.disabled = disabled;
  btn.textContent = label;
  const subEl = document.createElement('div');
  subEl.className = 'sub';
  subEl.textContent = sub;
  btn.appendChild(subEl);
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

function renderGame() {
  const status = document.createElement('div');
  const state = getGameStatus(gameState);
  const inCheck = isInCheck(gameState);
  status.className = 'status-bar cinzel' + (inCheck && state === 'ongoing' ? ' check' : '');
  status.textContent = statusText(state, inCheck);
  app.appendChild(status);

  const board = document.createElement('div');
  board.className = 'board';
  board.style.position = 'relative';
  board.style.width = `${SQUARE_PX * 8}px`;
  board.style.height = `${SQUARE_PX * 8}px`;
  board.style.display = 'block';

  for (let square = 0; square < 64; square++) {
    board.appendChild(renderSquare(square));
  }
  for (const instance of pieceInstances) {
    board.appendChild(renderPiece(instance));
  }
  app.appendChild(board);

  const legend = document.createElement('p');
  legend.className = 'legend';
  legend.textContent = 'King · Queen · Foot Knight · Archer · Cavalry · Foot Soldier';
  app.appendChild(legend);

  const controls = document.createElement('div');
  controls.className = 'controls';

  const newGameBtn = document.createElement('button');
  newGameBtn.className = 'btn cinzel';
  newGameBtn.textContent = 'New Game';
  newGameBtn.addEventListener('click', startNewHotSeatGame);
  controls.appendChild(newGameBtn);

  const backBtn = document.createElement('button');
  backBtn.className = 'btn link';
  backBtn.textContent = '← back to the hall';
  backBtn.addEventListener('click', backToMenu);
  controls.appendChild(backBtn);

  app.appendChild(controls);

  if (pendingPromotion) app.appendChild(renderPromotionOverlay());
}

function statusText(state, inCheck) {
  const side = gameState.turn === 'w' ? "White's" : "Black's";
  if (state === 'checkmate') {
    const winner = gameState.turn === 'w' ? 'Black' : 'White';
    return `Checkmate — ${winner} wins the field`;
  }
  if (state === 'stalemate') return 'Stalemate — the court is deadlocked';
  return inCheck ? `${side} Court to Move — in Check!` : `${side} Court to Move`;
}

function squareCoords(square) {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  return { left: file * SQUARE_PX, top: (7 - rank) * SQUARE_PX };
}

function renderSquare(square) {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  const { left, top } = squareCoords(square);
  const el = document.createElement('div');
  const isLight = (file + rank) % 2 === 1;
  const classes = ['square', isLight ? 'light' : 'dark'];
  if (selected === square) classes.push('selected');
  if (lastMove && (lastMove.from === square || lastMove.to === square)) classes.push('last-move');
  const legalMove = legalTargets.find((m) => m.to === square);
  if (legalMove) classes.push(legalMove.captured ? 'legal-capture' : 'legal-move');
  el.className = classes.join(' ');
  el.style.position = 'absolute';
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.addEventListener('click', () => onSquareClick(square));
  return el;
}

function renderPiece(instance) {
  let el = pieceElements.get(instance.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'piece arrive';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    pieceElements.set(instance.id, el);
  }
  const color = pieceColor(instance.code);
  const type = pieceType(instance.code);
  const { left, top } = squareCoords(instance.square);
  el.style.left = `${left + 8}px`;
  el.style.top = `${top + 8}px`;
  let classes = 'piece ' + (color === 'w' ? 'white' : 'black');
  if (instance.defeated) classes += ' defeated';
  if (instance.attacking) classes += ' attacking';
  el.className = classes;
  el.innerHTML = pieceIconSvg(type);
  el.title = `${color === 'w' ? 'White' : 'Black'} ${PIECE_NAME[type]}`;
  return el;
}

function renderPromotionOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const panel = document.createElement('div');
  panel.className = 'promotion-panel';

  const heading = document.createElement('h2');
  heading.textContent = 'Choose your unit';
  panel.appendChild(heading);

  const choices = document.createElement('div');
  choices.className = 'promotion-choices';
  for (const move of pendingPromotion.moves) {
    const btn = document.createElement('button');
    btn.className = 'btn cinzel';
    btn.textContent = PIECE_NAME[move.promotion];
    btn.addEventListener('click', () => commitMove(move));
    choices.appendChild(btn);
  }
  panel.appendChild(choices);
  overlay.appendChild(panel);
  return overlay;
}

render();
