var CHAR_WIDTH_RATIO = 0.6; // monospace glyph width / height

var viewportEl = document.getElementById('viewport');
var screenEl = document.getElementById('screen');

// Scale font so the COLS x ROWS grid always fits the 16:9 viewport
function fitScreen() {
  var rect = viewportEl.getBoundingClientRect();
  var size = Math.min(rect.width / (COLS * CHAR_WIDTH_RATIO), rect.height / ROWS) * 0.98;
  screenEl.style.fontSize = Math.floor(size) + 'px';
}

new ResizeObserver(fitScreen).observe(viewportEl);

function centerText(rows, y, text) {
  return stampText(rows, Math.floor((COLS - text.length) / 2), y, text);
}

// Split text into lines no longer than width, breaking on spaces
function wrapText(text, width) {
  var lines = [];
  var line = '';
  text.split(' ').forEach(function (word) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function buildEstimationLines(state) {
  var rows = emptyRoom();
  rows = stampText(rows, 4, 2, 'SPRINT PLANNING :: ESTIMATION POKER');
  var card = [
    '+--------------------------------------------+',
    '| TICKET-1337                     [STORY]    |',
    '|                                            |',
    '|   "Show a button for AAA users."           |',
    '|                                            |',
    '|   Reporter: *BA*      Priority: URGENT     |',
    '|   Acceptance criteria: "You will know."    |',
    '+--------------------------------------------+',
  ];
  card.forEach(function (line, i) {
    rows = centerText(rows, 5 + i, line);
  });

  rows = stampText(rows, 10, 9, '*BA*');
  rows = stampText(rows, 10, 11, '*PO*');
  rows = stampText(rows, 65, 9, '*QA*');
  rows = stampText(rows, 64, 11, '*LEAD*');

  var opts = ESTIMATE_OPTIONS.map(function (v, i) {
    return i === state.estimateIndex ? '>[' + v + ']<' : '  ' + v + '  ';
  }).join('   ');
  rows = centerText(rows, 17, 'YOUR ESTIMATE (story points):');
  rows = centerText(rows, 19, opts);
  rows = centerText(rows, 21, '*DEV*');
  if (!state.talking) rows = centerText(rows, 23, 'A/D to choose, E to flip your card');
  return rows;
}

function buildRoleSelectLines(state) {
  var rows = emptyRoom();
  rows = centerText(rows, 3, '=== TICKET TO PROD ===');
  rows = centerText(rows, 5, 'CHOOSE YOUR ROLE');
  var done = loadCompletedRoles();
  ROLES.forEach(function (r, i) {
    var y = 7 + i * 3;
    var sel = i === state.roleIndex;
    var open = roleAvailable(r);
    rows = stampText(rows, 14, y, (sel ? '>[' : '  ') + r.glyph + (sel ? ']<' : '  '));
    rows = stampText(rows, 28, y, r.name + (open ? '' : '  (LOCKED)') + (done[r.id] ? '  [DONE]' : ''));
    wrapText(open ? r.blurb : (r.lockedBlurb || r.blurb), COLS - 30).slice(0, 2).forEach(function (line, j) {
      rows = stampText(rows, 28, y + 1 + j, line);
    });
  });
  rows = centerText(rows, 25, 'W/S to choose, E to start');
  return rows;
}

function buildLines(state) {
  var scene = SCENES[state.scene];

  if (scene.placeholder) {
    var rows = emptyRoom();
    rows = centerText(rows, 10, '=== ' + scene.phase.toUpperCase() + ' ===');
    var introLines = wrapText(scene.intro, COLS - 10);
    introLines.forEach(function (line, j) {
      rows = centerText(rows, 13 + j, line);
    });
    rows = centerText(rows, 15 + introLines.length, '[ Press E ]');
    return rows;
  }

  if (scene.roleSelect) return buildRoleSelectLines(state);
  if (scene.mini) return LEAD_GAMES[scene.mini].lines(state.mini);
  if (scene.estimation) return buildEstimationLines(state);
  if (scene.battle) return buildBattleLines(state.battle);
  if (scene.puzzle) return buildPuzzleLines(scene.puzzle, state);
  if (scene.platformer) return buildPlatformerLines(state.plat);

  var lines = labelMyDesk(scene.map.slice(), (state.flags || {}).role);
  // Behind the time wave the office is empty: rooms unbooked, doors open, people gone
  var front = timeWaveFront(state, scene);
  if (front > 0) {
    var cut = Math.min(front, COLS);
    lines = lines.map(function (row, y) {
      return OFFICE_FLOOR_EMPTY[y].slice(0, cut) + row.slice(cut);
    });
  }
  (scene.npcs || []).forEach(function (n) {
    if (n.hidden && n.hidden(state)) return;
    if (n.x < front && n.id !== 'po' && !(['po', 'ba'].indexOf((state.flags || {}).role) !== -1 && n.id === 'lead')) return;
    lines = stampText(lines, n.x, n.y, n.label);
  });
  if (state.player) lines = stampText(lines, state.player.x, state.player.y, PLAYER_GLYPH);

  // Interaction hint near the player, only on empty floor so it never covers an NPC's name
  if (!state.talking && !state.cutscene &&
      (adjacentNpc(scene.npcs, state.player, state) || (scene.desk && nextToRect(scene.deskRect || MY_DESK, state.player)))) {
    var spots = [
      { x: state.player.x + 1, y: state.player.y - 1 },
      { x: state.player.x + 1, y: state.player.y + 1 },
      { x: state.player.x + PLAYER_W + 1, y: state.player.y },
      { x: state.player.x - 4, y: state.player.y },
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      if (s.y >= 0 && s.y < ROWS && s.x >= 0 && lines[s.y].substr(s.x, 3) === '   ') {
        lines = stampText(lines, s.x, s.y, '[E]');
        break;
      }
    }
  }
  return lines;
}

// Deterministic pseudo-random 0..1 for a cell, so waves flicker without storing state
function cellNoise(x, y, seed) {
  var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

var WAVE_START = 1.5; // seconds into QA cutscene
var WAVE_END = 3.5;
var WAVE_SPEED = 45; // cols / s
var WAVE_TRAIL = 6;
var WAVE_SYMBOLS = '*#%&@$!?^';

var TIME_WAVE_SPEED = 22; // cols / s
var TIME_WAVE_TRAIL = 10;
var TIME_WAVE_DURATION = (COLS + TIME_WAVE_TRAIL) / TIME_WAVE_SPEED + 0.3;
var TIME_WAVE_SYMBOLS = '~~~=:.oO';

// Column the Lead time wave has reached (-1 = not started, past the screen once the day is over)
function timeWaveFront(state, scene) {
  if (!scene.timeWave) return -1;
  if (state.flags.dayOver) return COLS + TIME_WAVE_TRAIL;
  if (state.cutscene && state.cutscene.kind === 'time') return Math.floor(state.cutscene.t * TIME_WAVE_SPEED);
  return -1;
}

// Blue wave rolling in from the left; its leading edge is where people vanish
function timeWaveCells(state, lines) {
  var cells = {};
  if (!state.cutscene || state.cutscene.kind !== 'time') return cells;
  var t = state.cutscene.t;
  var tick = Math.floor(t * 12);
  for (var y = 1; y < ROWS - 1; y++) {
    var front = t * TIME_WAVE_SPEED + Math.sin(y * 0.5 + t * 6) * 2;
    var end = Math.round(front);
    for (var x = end - TIME_WAVE_TRAIL; x <= end; x++) {
      if (x < 1 || x > COLS - 2 || lines[y][x] !== ' ') continue;
      var fade = (front - x) / TIME_WAVE_TRAIL;
      if (cellNoise(x, y, tick) >= 1 - fade * 0.8) {
        cells[x + ',' + y] = TIME_WAVE_SYMBOLS[Math.floor(cellNoise(y, x, tick * 3) * 97) % TIME_WAVE_SYMBOLS.length];
      }
    }
  }
  return cells;
}

// Red waves rolling in from the right (where QA left). Returns { "x,y": char }
function waveCells(state, lines) {
  var cells = {};
  if (!state.cutscene || state.cutscene.kind === 'time') return cells;
  var t = state.cutscene.t;
  if (t < WAVE_START || t >= WAVE_END) return cells;
  var elapsed = t - WAVE_START;
  var tick = Math.floor(t * 12);

  for (var k = 0; k < 3; k++) {
    var age = elapsed - k * 0.45;
    if (age < 0) continue;
    var life = Math.min(age / 1.5, 1); // waves fade out as they travel
    for (var y = 1; y < ROWS - 1; y++) {
      var front = COLS - 2 - age * WAVE_SPEED + Math.sin(y * 0.6 + t * 7) * 2;
      var start = Math.round(front);
      for (var x = start; x <= start + WAVE_TRAIL; x++) {
        if (x < 1 || x > COLS - 2 || lines[y][x] !== ' ') continue;
        var fade = (x - front) / WAVE_TRAIL;
        var keep = (1 - fade * 0.6) * (1 - life);
        if (cellNoise(x, y, tick + k) >= keep) continue;
        var pick = cellNoise(y, x, tick * 3 + k);
        cells[x + ',' + y] =
          pick < 0.6 ? '~' : WAVE_SYMBOLS[Math.floor(pick * 97) % WAVE_SYMBOLS.length];
      }
    }
  }
  return cells;
}

// Colour rules, applied in order (later rules override earlier ones).
// Each rule maps a regex match on a screen row to a CSS class.
var COLOUR_RULES = [
  { re: /[#]+/g, cls: 'c-wall' },
  { re: /[+|]|-{2,}|={2,}/g, cls: 'c-wall' },
  { re: /~+|\.{4}/g, cls: 'c-slot' },
  { re: /\^\^ OK \^\^/g, cls: 'c-ok' },
  { re: /\[(IF|ROLE|IS|EQUALS|NOT|NULL|AND|AAA|SHOW|BUTTON|GIVEN|WHEN|THEN|LOGIN|NO)\]/g, cls: 'c-token' },
  { re: /\[(SUBMIT|RESET)\]|\[E\]|>\[\d\]</g, cls: 'c-action' },
  { re: /\[LOGS\]|\*LOGS\*/g, cls: 'c-logs' },
  { re: /NullReferenceException|\[ERROR\]/g, cls: 'c-error' },
  { re: /\*BA\*/g, cls: 'c-ba' },
  { re: /\*PO\*/g, cls: 'c-po' },
  { re: /\*QA\*/g, cls: 'c-qa' },
  { re: /\*LEAD\*/g, cls: 'c-lead' },
  { re: /\*(SALES|HR|FINANCE|CEO|ARCHITECT|SM|DEV2|QA2|UX)\*/g, cls: 'c-other' },
  { re: /\*CONTRACTOR\*/g, cls: 'c-contractor' },
  { re: /\*DEV\*/g, cls: 'c-dev' },
];

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Per-character class array for a row
function classifyRow(row) {
  var classes = new Array(row.length);
  COLOUR_RULES.forEach(function (rule) {
    rule.re.lastIndex = 0;
    var m;
    while ((m = rule.re.exec(row)) !== null) {
      for (var i = m.index; i < m.index + m[0].length; i++) classes[i] = rule.cls;
    }
  });
  return classes;
}

// Emit HTML, grouping runs of the same class into one span
function rowToHtml(chars, classes) {
  var out = '';
  var run = '';
  var runCls = null;
  for (var i = 0; i <= chars.length; i++) {
    var cls = i < chars.length ? classes[i] || null : undefined;
    if (cls !== runCls || i === chars.length) {
      if (run) out += runCls ? '<span class="' + runCls + '">' + escapeHtml(run) + '</span>' : escapeHtml(run);
      run = '';
      runCls = cls;
    }
    if (i < chars.length) run += chars[i];
  }
  return out;
}

function colourize(text) {
  return rowToHtml(text.split(''), classifyRow(text));
}

// "base" (optional) is the screen without moving sprites; characters still visible from it keep
// their colour even when a sprite covers part of a label (e.g. *DEV* jumping through [LOGS]).
function drawScreen(lines, waves, base, marks, waveCls) {
  screenEl.innerHTML = lines
    .map(function (row, y) {
      var chars = row.split('');
      var classes = classifyRow(row);
      if (marks) {
        for (var m = 0; m < chars.length; m++) {
          if (marks[m + ',' + y]) classes[m] = marks[m + ',' + y];
        }
      }
      if (base) {
        var baseClasses = classifyRow(base[y]);
        for (var b = 0; b < chars.length; b++) {
          if (!classes[b] && chars[b] === base[y][b]) classes[b] = baseClasses[b];
        }
      }
      for (var x = 0; x < chars.length; x++) {
        var w = waves[x + ',' + y];
        if (w) {
          chars[x] = w;
          classes[x] = waveCls || 'wave';
        }
      }
      return rowToHtml(chars, classes);
    })
    .join('\n');
}

var dialogueEl = document.getElementById('status-dialogue');

function render(state) {
  var scene = SCENES[state.scene];
  var lines = buildLines(state);
  var base = scene.platformer ? buildPlatformerBase(state.plat) : null;
  if (scene.battle) {
    drawScreen(lines, battleBurstCells(state.battle, lines), null, battleMarks(state.battle));
  } else if (scene.mini) {
    var mg = LEAD_GAMES[scene.mini];
    drawScreen(lines, mg.waves ? mg.waves(state.mini, lines) : {}, null, mg.marks(state.mini));
  } else if (scene.timeWave) {
    drawScreen(lines, timeWaveCells(state, lines), base, null, 'wave-time');
  } else {
    drawScreen(lines, waveCells(state, lines), base);
  }
  document.getElementById('status-controls').textContent = state.talking ? 'E Continue' : scene.controls;
  document.getElementById('status-objective').textContent = state.objective;
  document.getElementById('status-phase').textContent = scene.phase;
  dialogueEl.innerHTML =
    colourize(state.dialogue) + (state.talking ? ' <span class="c-action">[E \u25B6]</span>' : '');
  dialogueEl.parentElement.classList.toggle('active', !!state.talking);
}
