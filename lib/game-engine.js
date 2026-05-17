// Seeded 2048 game engine — shared between client and server.
// Deterministic: same seed + moves = same outcome. Enables server-side anti-cheat replay.

export function seededRng(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  }
  return function next() {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function createBoard() {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
}

export function getEmpty(board) {
  const cells = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (board[r][c] === 0) cells.push([r, c]);
  return cells;
}

export function spawnTile(board, rng) {
  const empty = getEmpty(board);
  if (empty.length === 0) return false;
  const idx = Math.floor(rng() * empty.length);
  const [r, c] = empty[idx];
  board[r][c] = rng() < 0.9 ? 2 : 4;
  return true;
}

function slideRow(row) {
  const filtered = row.filter(v => v !== 0);
  let score = 0;
  const merged = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  while (merged.length < 4) merged.push(0);
  return { row: merged, score };
}

function rotateBoard(board) {
  const n = [];
  for (let c = 0; c < 4; c++) {
    n.push([board[3][c], board[2][c], board[1][c], board[0][c]]);
  }
  return n;
}

export function move(board, direction) {
  let b = board.map(r => [...r]);
  let rotations = { L: 0, U: 3, R: 2, D: 1 }[direction];
  for (let i = 0; i < rotations; i++) b = rotateBoard(b);

  let totalScore = 0;
  let moved = false;
  const newBoard = [];
  for (let r = 0; r < 4; r++) {
    const { row, score } = slideRow(b[r]);
    if (row.some((v, c) => v !== b[r][c])) moved = true;
    newBoard.push(row);
    totalScore += score;
  }

  let result = newBoard;
  const back = (4 - rotations) % 4;
  for (let i = 0; i < back; i++) result = rotateBoard(result);

  return { board: result, score: totalScore, moved };
}

export function canMove(board) {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0) return true;
      if (c < 3 && board[r][c] === board[r][c + 1]) return true;
      if (r < 3 && board[r][c] === board[r + 1][c]) return true;
    }
  return false;
}

export function hasWon(board) {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (board[r][c] >= 2048) return true;
  return false;
}

export function replayGame(seed, moveString) {
  const rng = seededRng(seed);
  let board = createBoard();
  spawnTile(board, rng);
  spawnTile(board, rng);

  let score = 0;
  let moveCount = 0;

  for (const dir of moveString) {
    if (!"UDLR".includes(dir)) return { valid: false, reason: "invalid move character" };
    const result = move(board, dir);
    if (!result.moved) return { valid: false, reason: `move ${moveCount}: ${dir} did not change board` };
    board = result.board;
    score += result.score;
    moveCount++;
    spawnTile(board, rng);
  }

  return { valid: true, score, moveCount, board, gameOver: !canMove(board), won: hasWon(board) };
}

export function initGame(seed) {
  const rng = seededRng(seed);
  const board = createBoard();
  spawnTile(board, rng);
  spawnTile(board, rng);
  return { board, rng };
}
