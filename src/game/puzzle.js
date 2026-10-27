// Sokoban-style coding puzzle. Grid is measured in cells; each cell renders as CELL_W x CELL_H chars.
var CELL_W = 8;
var CELL_H = 2;
var PUZZLE_TOP = 3; // screen rows reserved for header above the grid

// Puzzle 1: IF ROLE EQUALS AAA / SHOW BUTTON
var PUZZLE_1 = {
  width: 10,
  height: 11,
  spawn: { x: 4, y: 9 },
  submit: { x: 8, y: 9 },
  reset: { x: 1, y: 9 },
  goal: ['IF ROLE EQUALS AAA', 'SHOW BUTTON'],
  targets: [
    { token: 'IF', x: 2, y: 2 },
    { token: 'ROLE', x: 3, y: 2 },
    { token: 'EQUALS', x: 4, y: 2 },
    { token: 'AAA', x: 5, y: 2 },
    { token: 'SHOW', x: 2, y: 4 },
    { token: 'BUTTON', x: 3, y: 4 },
  ],
  blocks: [
    { token: 'IF', x: 3, y: 6 },
    { token: 'ROLE', x: 4, y: 7 },
    { token: 'EQUALS', x: 6, y: 6 },
    { token: 'AAA', x: 5, y: 8 },
    { token: 'SHOW', x: 6, y: 8 },
    { token: 'BUTTON', x: 7, y: 4 },
  ],
};

// Puzzle 2: IF ROLE IS NOT NULL AND EQUALS AAA / SHOW BUTTON
var PUZZLE_2 = {
  width: 10,
  height: 11,
  spawn: { x: 4, y: 9 },
  submit: { x: 8, y: 9 },
  reset: { x: 1, y: 9 },
  goal: ['IF ROLE IS NOT NULL AND EQUALS AAA', 'SHOW BUTTON'],
  targets: [
    { token: 'IF', x: 1, y: 2 },
    { token: 'ROLE', x: 2, y: 2 },
    { token: 'IS', x: 3, y: 2 },
    { token: 'NOT', x: 4, y: 2 },
    { token: 'NULL', x: 5, y: 2 },
    { token: 'AND', x: 6, y: 2 },
    { token: 'EQUALS', x: 7, y: 2 },
    { token: 'AAA', x: 8, y: 2 },
    { token: 'SHOW', x: 1, y: 4 },
    { token: 'BUTTON', x: 2, y: 4 },
  ],
  blocks: [
    { token: 'IF', x: 1, y: 7 },
    { token: 'SHOW', x: 2, y: 6 },
    { token: 'ROLE', x: 3, y: 7 },
    { token: 'IS', x: 4, y: 8 },
    { token: 'NOT', x: 5, y: 6 },
    { token: 'NULL', x: 6, y: 8 },
    { token: 'AND', x: 7, y: 7 },
    { token: 'EQUALS', x: 7, y: 5 },
    { token: 'AAA', x: 8, y: 6 },
    { token: 'BUTTON', x: 5, y: 4 },
  ],
};

function cloneBlocks(blocks) {
  return blocks.map(function (b) {
    return { token: b.token, x: b.x, y: b.y };
  });
}

function puzzleWall(def, x, y) {
  return x <= 0 || y <= 0 || x >= def.width - 1 || y >= def.height - 1;
}

function isSubmitCell(def, x, y) {
  return (
    (def.submit.x === x && def.submit.y === y) || (def.reset.x === x && def.reset.y === y)
  );
}

function blockIndexAt(blocks, x, y) {
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].x === x && blocks[i].y === y) return i;
  }
  return -1;
}

function targetAt(def, x, y) {
  for (var i = 0; i < def.targets.length; i++) {
    if (def.targets[i].x === x && def.targets[i].y === y) return def.targets[i];
  }
  return null;
}

function cellFree(def, blocks, x, y) {
  return !puzzleWall(def, x, y) && !isSubmitCell(def, x, y) && blockIndexAt(blocks, x, y) === -1;
}

// Returns { player, blocks } after attempting a move (unchanged references if blocked)
function puzzleMove(def, player, blocks, d) {
  var nx = player.x + d.x;
  var ny = player.y + d.y;
  if (puzzleWall(def, nx, ny) || isSubmitCell(def, nx, ny)) return null;

  var bi = blockIndexAt(blocks, nx, ny);
  if (bi === -1) return { player: { x: nx, y: ny }, blocks: blocks };

  var bx = nx + d.x;
  var by = ny + d.y;
  if (!cellFree(def, blocks, bx, by)) return null;

  var moved = blocks.slice();
  moved[bi] = { token: blocks[bi].token, x: bx, y: by };
  return { player: { x: nx, y: ny }, blocks: moved };
}

function puzzleSolved(def, blocks) {
  return def.targets.every(function (t) {
    var i = blockIndexAt(blocks, t.x, t.y);
    return i !== -1 && blocks[i].token === t.token;
  });
}

function nextToCell(cell, p) {
  return Math.abs(p.x - cell.x) <= 1 && Math.abs(p.y - cell.y) <= 1;
}

function nextToSubmit(def, p) {
  return nextToCell(def.submit, p);
}

// Current code as written by the blocks in target slots, one string per goal line
function currentCode(def, blocks) {
  var rows = {};
  def.targets.forEach(function (t) {
    var i = blockIndexAt(blocks, t.x, t.y);
    (rows[t.y] = rows[t.y] || []).push(i === -1 ? '____' : blocks[i].token);
  });
  return Object.keys(rows)
    .sort(function (a, b) {
      return a - b;
    })
    .map(function (y) {
      return rows[y].join(' ');
    });
}

function padCell(text, fill) {
  var total = CELL_W - text.length;
  var left = Math.floor(total / 2);
  return (fill || ' ').repeat(left) + text + (fill || ' ').repeat(total - left);
}

// Two text lines for a single cell
function puzzleCell(def, state, x, y) {
  if (puzzleWall(def, x, y)) return ['########', '########'];
  if (def.submit.x === x && def.submit.y === y) return ['[SUBMIT]', '========'];
  if (def.reset.x === x && def.reset.y === y) return ['[RESET] ', '======= '];

  var target = targetAt(def, x, y);
  var bi = blockIndexAt(state.blocks, x, y);
  var under = target ? '~~~~~~~~' : '        ';

  if (state.player.x === x && state.player.y === y) {
    return [padCell(PLAYER_GLYPH), under];
  }
  if (bi !== -1) {
    var token = state.blocks[bi].token;
    var correct = target && target.token === token;
    return [padCell('[' + token + ']'), correct ? '^^ OK ^^' : under];
  }
  if (target) return ['  ....  ', under];
  return ['        ', '        '];
}

function buildPuzzleLines(def, state) {
  var rows = emptyRoom().map(function () {
    return ' '.repeat(COLS);
  });
  rows = stampText(rows, 1, 0, def.title || 'CODE EDITOR :: TICKET-1337  "Show a button for AAA users"');
  rows = stampText(rows, 1, 1, 'GOAL: ' + def.goal.join(' / '));
  rows = stampText(rows, 1, 2, (def.label || 'CODE') + ': ' + currentCode(def, state.blocks).join(' / '));

  for (var cy = 0; cy < def.height; cy++) {
    var a = '';
    var b = '';
    for (var cx = 0; cx < def.width; cx++) {
      var cell = puzzleCell(def, state, cx, cy);
      a += cell[0];
      b += cell[1];
    }
    rows = stampText(rows, 0, PUZZLE_TOP + cy * CELL_H, a);
    rows = stampText(rows, 0, PUZZLE_TOP + cy * CELL_H + 1, b);
  }

  var footer = puzzleSolved(def, state.blocks)
    ? 'All tokens in place! Walk to [SUBMIT] and press E.'
    : 'Push tokens into the .... slots. Stuck? Walk to [RESET] and press E.';
  rows = stampText(rows, 1, PUZZLE_TOP + def.height * CELL_H, footer);
  return rows;
}
