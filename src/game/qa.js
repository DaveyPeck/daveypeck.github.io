// QA Tester journey minigames. They plug into LEAD_GAMES so scenes can use them via scene.mini.

// ---------------------------------------------------------------- ARGUE (Battle of the Wills, reversed)
// DEV's excuses descend; QA fires testing questions back word by word.
BATTLE_ROUNDS[0].qa = ['HOW HARD CAN IT BE', "THERE ARE ONLY A FEW AC'S", "IT'S JUST ONE BUTTON"];
BATTLE_ROUNDS[1].qa = ['UNIT TESTS COVER IT', 'IT WORKS ON MY MACHINE', 'NO NEED FOR REGRESSION', 'COPY THE OTHER BUTTON'];
BATTLE_ROUNDS[2].qa = ['JUST A SMOKE TEST', 'WE CAN TEST IN PROD', 'IT WORKED LAST TIME', 'SHIP IT FRIDAY', 'THE CODE IS SELF DOCUMENTING'];
BATTLE_AMMO.qa = ['WHAT', 'ABOUT', 'AUTOMATION', 'HAS', 'NON-JS', 'BEEN', 'CONSIDERED', 'EDGE', 'CASES', 'MOBILE', 'NULL', 'ROLES', 'ACCESSIBILITY', 'REGRESSION'];

var ARGUE_GAME = {
  animateDone: true,
  create: function () {
    var b = createBattle(3, 5);
    b.mode = 'qa';
    b.enemies = battleEnemies('qa', 0);
    b.fails = 0;
    return b;
  },
  step: function (b, dt, keys) {
    var next = battleStep(b, dt, keys || {});
    next.fails = b.fails;
    return next;
  },
  lines: function (b) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'BATTLE OF THE WILLS :: *DEV* thinks it is easy  vs  *QA* knows better');
    rows = stampText(rows, COLS - 8, 2, '*DEV*');
    rows = stampText(rows, 3, 2, 'ROUND ' + (b.round + 1) + '/' + BATTLE_ROUNDS.length);
    b.enemies.forEach(function (e) {
      if (e.alive) rows = stampText(rows, e.x + b.offsetX, e.y + b.offsetY, e.text);
    });
    b.bullets.forEach(function (s) {
      rows = stampText(rows, s.x, Math.round(s.y), s.text);
    });
    rows = stampText(rows, Math.round(b.x), BATTLE_PLAYER_Y, PLAYER_GLYPH);
    if (!b.done) rows = stampText(rows, 3, 25, 'A/D move  |  SPACE ask awkward questions');
    return rows;
  },
  marks: function (b) {
    var marks = {};
    b.enemies.forEach(function (e) {
      if (e.alive) markText(marks, e.text, e.x + b.offsetX, e.y + b.offsetY, 'c-dev');
    });
    b.bullets.forEach(function (s) {
      markText(marks, s.text, s.x, Math.round(s.y), 'c-qa');
    });
    return marks;
  },
  waves: function (b, lines) {
    return battleBurstCells(b, lines);
  },
  failLines: [['DEV', 'See? Easy.']],
};

// ---------------------------------------------------------------- BREAKOUT (testing DEV's code)
// Every character of DEV's safety nets is its own brick. Deeper layers take more hits.
var BRK_TOP = 3;
var BRK_PADDLE_Y = 23;
var BRK_PADDLE = '[==*QA*==]';
var BRK_PADDLE_SPEED = 45; // cols / s
var BRK_VY = 14; // rows / s
var BRK_MAX_VX = 20; // cols / s
// Top layer first. hp = hits each character needs; cls = colour at each remaining hp (index = hp)
var BRK_LAYERS = [
  { y: 5, text: 'LGTM', hp: 1 },
  { y: 6, text: 'TRY/CATCH', hp: 1 },
  { y: 7, text: 'TRY/CATCH', hp: 1 },
  { y: 8, text: 'WORKS4ME', hp: 1 },
  { y: 9, text: 'WORKS4ME', hp: 1 },
];
var BRK_HP_CLS = [null, 'c-dev', 'c-token', 'c-error'];
var BRK_BUG = '>> NULL ROLE BUG <<';
var BRK_BUG_X = Math.floor((COLS - BRK_BUG.length) / 2);

// Fill the floor width by repeating the layer text with a single space between copies
function brkLayerRow(text) {
  var row = '';
  while (row.length < COLS - 2) row += text + ' ';
  return row.slice(0, COLS - 2);
}

function brkResetBall(m) {
  return Object.assign({}, m, {
    bx: m.px + BRK_PADDLE.length / 2,
    by: BRK_PADDLE_Y - 1,
    vx: 0,
    vy: 0,
    launched: false,
  });
}

function brkKey(x, y) {
  return x + ',' + y;
}

var BREAKOUT_GAME = {
  create: function () {
    var cells = {};
    var total = 0;
    BRK_LAYERS.forEach(function (layer) {
      var row = brkLayerRow(layer.text);
      for (var i = 0; i < row.length; i++) {
        if (row[i] === ' ') continue;
        cells[brkKey(1 + i, layer.y)] = { ch: row[i], hp: layer.hp };
        total++;
      }
    });
    var m = { px: Math.floor((COLS - BRK_PADDLE.length) / 2), cells: cells, total: total, broken: 0, fails: 0, done: false };
    return brkResetBall(m);
  },
  step: function (m, dt, keys) {
    if (m.done) return m;
    keys = keys || {};
    var vxPaddle = (keys.right ? BRK_PADDLE_SPEED : 0) - (keys.left ? BRK_PADDLE_SPEED : 0);
    var px = Math.max(1, Math.min(COLS - 1 - BRK_PADDLE.length, m.px + vxPaddle * dt));
    if (!m.launched) {
      var held = Object.assign({}, m, { px: px, bx: px + BRK_PADDLE.length / 2, by: BRK_PADDLE_Y - 1 });
      if (keys.jump) {
        held.launched = true;
        held.vx = 8;
        held.vy = -BRK_VY;
      }
      return held;
    }

    var bx = m.bx;
    var by = m.by;
    var vx = m.vx;
    var vy = m.vy;
    var cells = m.cells;
    var copied = false;
    var broken = m.broken;
    var done = false;

    // Damage one character brick; copy the map once per frame on first hit
    function hitCell(key) {
      if (!copied) {
        cells = Object.assign({}, cells);
        copied = true;
      }
      var c = cells[key];
      if (c.hp <= 1) {
        delete cells[key];
        broken++;
      } else {
        cells[key] = { ch: c.ch, hp: c.hp - 1 };
      }
    }

    // Small sub-steps so the ball never skips a single character
    var n = Math.max(1, Math.ceil((Math.max(Math.abs(vx), Math.abs(vy)) * dt) / 0.4));
    var h = dt / n;
    for (var s = 0; s < n; s++) {
      var nx = bx + vx * h;
      var ny = by + vy * h;
      if (nx < 1) {
        nx = 1;
        vx = Math.abs(vx);
      }
      if (nx > COLS - 2) {
        nx = COLS - 2;
        vx = -Math.abs(vx);
      }
      if (ny < BRK_TOP) {
        ny = BRK_TOP;
        vy = Math.abs(vy);
      }
      var ox = Math.round(bx);
      var oy = Math.round(by);
      var cx = Math.round(nx);
      var cy = Math.round(ny);

      if (cy === BRK_TOP && cx >= BRK_BUG_X && cx < BRK_BUG_X + BRK_BUG.length) {
        done = true;
        bx = nx;
        by = ny;
        break;
      }

      // Per-character collision: work out which side we came in from to pick the bounce axis
      if (cells[brkKey(cx, cy)]) {
        var fromSide = cx !== ox && !cells[brkKey(ox, cy)] && cy === oy;
        var fromVert = cy !== oy && !cells[brkKey(cx, oy)];
        if (fromSide && !fromVert) {
          vx = -vx;
        } else if (fromVert && !fromSide) {
          vy = -vy;
        } else {
          vx = -vx;
          vy = -vy;
        }
        hitCell(brkKey(cx, cy));
        // Splash damage: the letters either side of the hit go too
        [brkKey(cx - 1, cy), brkKey(cx + 1, cy)].forEach(function (k) {
          if (cells[k]) hitCell(k);
        });
        if (Math.abs(vy) < BRK_VY * 2.2) {
          vx *= 1.015;
          vy *= 1.015;
        }
        continue;
      }

      if (vy > 0 && cy === BRK_PADDLE_Y && cx >= Math.round(px) - 1 && cx <= Math.round(px) + BRK_PADDLE.length) {
        var off = (nx - (px + BRK_PADDLE.length / 2)) / (BRK_PADDLE.length / 2);
        vx = Math.max(-1, Math.min(1, off)) * BRK_MAX_VX;
        if (Math.abs(vx) < 4) vx = vx < 0 ? -4 : 4;
        vy = -Math.abs(vy);
        ny = BRK_PADDLE_Y - 1;
      }

      if (ny > BRK_PADDLE_Y + 1) {
        return brkResetBall(Object.assign({}, m, { px: px, cells: cells, broken: broken, fails: m.fails + 1 }));
      }
      bx = nx;
      by = ny;
    }
    return Object.assign({}, m, { px: px, bx: bx, by: by, vx: vx, vy: vy, cells: cells, broken: broken, done: done });
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, "TESTING ON DEV'S MACHINE :: Safety nets broken: " + m.broken + '/' + m.total + '   Tests dropped: ' + m.fails);
    rows = hWall(rows, 2, 1, COLS - 2);
    rows = stampText(rows, BRK_BUG_X, BRK_TOP, BRK_BUG);
    Object.keys(m.cells).forEach(function (k) {
      var p = k.split(',');
      rows = stampText(rows, +p[0], +p[1], m.cells[k].ch);
    });
    rows = stampText(rows, Math.round(m.px), BRK_PADDLE_Y, BRK_PADDLE);
    rows = stampText(rows, Math.round(m.bx), Math.round(m.by), 'o');
    if (!m.launched) rows = centerText(rows, 15, 'Press SPACE to start testing');
    rows = stampText(rows, 3, 25, 'A/D move  |  Every hit speeds the ball up. Hit the bug behind them.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    markText(marks, BRK_BUG, BRK_BUG_X, BRK_TOP, 'c-error');
    Object.keys(m.cells).forEach(function (k) {
      marks[k] = BRK_HP_CLS[m.cells[k].hp] || 'c-dev';
    });
    markText(marks, BRK_PADDLE, Math.round(m.px), BRK_PADDLE_Y, 'c-qa');
    marks[Math.round(m.bx) + ',' + Math.round(m.by)] = 'c-action';
    return marks;
  },
  failLines: [
    ['DEV', 'See? Nothing wrong with it. Can I close the ticket?'],
    ['QA', 'No. Again.'],
  ],
};

// ---------------------------------------------------------------- FROGGER (prod release regression)
// Hop *QA* up through lanes of scrolling features to the release gate. One suite.
// Safe rows ("checkpoints") break the lanes into groups of at most three.
var FROG_START_Y = 23;
var FROG_GOAL_Y = 3;
var FROG_SUITES = ['REGRESSION'];
var FROG_SAFE_ROWS = [
  { y: 19, text: '-- SAFE :: TEST DATA LOADED --' },
  { y: 15, text: '-- SAFE :: BUILD GREEN --' },
  { y: 11, text: '-- SAFE :: SMOKE PASSED --' },
  { y: 7, text: '-- SAFE :: SIGN-OFF PENDING --' },
];
var FROG_LANES = [
  { y: 22, speed: 6, labels: ['COOKIES', 'GDPR'], gap: 16 },
  { y: 21, speed: -7, labels: ['CACHE'], gap: 18 },
  { y: 20, speed: 8, labels: ['EMAILS', 'NULL ROLE'], gap: 15 },
  { y: 18, speed: -6, labels: ['EXPORT', 'REPORTS'], gap: 16 },
  { y: 17, speed: 9, labels: ['CHECKOUT'], gap: 20 },
  { y: 16, speed: -8, labels: ['SEARCH', 'PROFILE'], gap: 15 },
  { y: 14, speed: 7, labels: ['AAA BUTTON'], gap: 16 },
  { y: 13, speed: -9, labels: ['PAYMENTS', 'BASKET'], gap: 17 },
  { y: 12, speed: 6, labels: ['LOGIN', 'SSO'], gap: 16 },
  { y: 10, speed: -7, labels: ['AUDIT LOG'], gap: 18 },
  { y: 9, speed: 8, labels: ['API', 'WEBHOOKS'], gap: 16 },
  { y: 8, speed: -6, labels: ['SETTINGS'], gap: 18 },
  { y: 6, speed: 7, labels: ['FEATURE FLAG'], gap: 20 },
  { y: 5, speed: -8, labels: ['ROLLBACK'], gap: 18 },
  { y: 4, speed: 6, labels: ['HOTFIX'], gap: 18 },
];

function frogPeriod(lane) {
  var longest = 0;
  lane.labels.forEach(function (l) {
    longest = Math.max(longest, l.length + 2);
  });
  return longest + lane.gap;
}

// Items currently in a lane: [{ x, text }]. Labels stay attached to their item as it scrolls.
function frogLaneItems(lane, t, mul) {
  var period = frogPeriod(lane);
  var off = t * lane.speed * mul;
  var base = Math.floor(off / period);
  var frac = off - base * period;
  var n = lane.labels.length;
  var items = [];
  for (var j = -1; j <= Math.ceil(COLS / period) + 1; j++) {
    var idx = (((j - base) % n) + n) % n;
    items.push({ x: Math.round(j * period + frac), text: '[' + lane.labels[idx] + ']' });
  }
  return items;
}

function frogMul(m) {
  return 1 + Math.min(m.crossings, FROG_SUITES.length - 1) * 0.25;
}

// The last safe row at or below the player (where a hit sends you back to)
function frogCheckpoint(m) {
  var best = FROG_START_Y;
  FROG_SAFE_ROWS.forEach(function (r) {
    if (r.y >= m.py && r.y < best) best = r.y;
  });
  return best;
}

function frogCheck(m) {
  if (m.py <= FROG_GOAL_Y) {
    var crossings = m.crossings + 1;
    if (crossings >= FROG_SUITES.length) return Object.assign({}, m, { crossings: crossings, done: true });
    return Object.assign({}, m, { crossings: crossings, py: FROG_START_Y, t: 0 });
  }
  var lane = null;
  FROG_LANES.forEach(function (l) {
    if (l.y === m.py) lane = l;
  });
  if (!lane) return m;
  var hit = frogLaneItems(lane, m.t, frogMul(m)).some(function (it) {
    return m.px < it.x + it.text.length && m.px + PLAYER_W > it.x;
  });
  if (!hit) return m;
  // Hit: back to the last safe row you reached, not the very start
  var back = m.py;
  while (back < FROG_START_Y && !FROG_SAFE_ROWS.some(function (r) { return r.y === back; })) back++;
  return Object.assign({}, m, { py: back, fails: m.fails + 1 });
}

var FROGGER_GAME = {
  create: function () {
    return { px: Math.floor(COLS / 2) - 2, py: FROG_START_Y, t: 0, crossings: 0, fails: 0, done: false };
  },
  dir: function (m, d) {
    if (m.done) return m;
    var px = Math.max(1, Math.min(COLS - 1 - PLAYER_W, m.px + d.x * 2));
    var py = Math.max(FROG_GOAL_Y, Math.min(FROG_START_Y, m.py + d.y));
    return frogCheck(Object.assign({}, m, { px: px, py: py }));
  },
  step: function (m, dt) {
    if (m.done) return m;
    return frogCheck(Object.assign({}, m, { t: m.t + dt }));
  },
  lines: function (m) {
    var rows = emptyRoom();
    var suite = FROG_SUITES[Math.min(m.crossings, FROG_SUITES.length - 1)];
    rows = stampText(rows, 3, 1, 'PROD RELEASE REGRESSION :: Suite: ' + suite + '   Passed: ' + m.crossings + '/' + FROG_SUITES.length + '   Regressions hit: ' + m.fails);
    rows = hWall(rows, 2, 1, COLS - 2);
    rows = centerText(rows, FROG_GOAL_Y, '>>> RELEASE GATE <<<');
    FROG_SAFE_ROWS.forEach(function (r) {
      rows = centerText(rows, r.y, r.text);
    });
    rows = centerText(rows, FROG_START_Y + 1, '-- START :: TEST ENV --');
    FROG_LANES.forEach(function (lane) {
      frogLaneItems(lane, m.t, frogMul(m)).forEach(function (it) {
        rows = stampText(rows, it.x, lane.y, it.text);
      });
    });
    rows = emptyRoomBorders(rows);
    rows = stampText(rows, Math.round(m.px), m.py, PLAYER_GLYPH);
    rows = stampText(rows, 3, 25, 'WASD hop. Get hit and you go back to the last SAFE row.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    var gate = '>>> RELEASE GATE <<<';
    markText(marks, gate, Math.floor((COLS - gate.length) / 2), FROG_GOAL_Y, 'c-ok');
    FROG_SAFE_ROWS.forEach(function (r) {
      markText(marks, r.text, Math.floor((COLS - r.text.length) / 2), r.y, 'c-ok');
    });
    FROG_LANES.forEach(function (lane) {
      frogLaneItems(lane, m.t, frogMul(m)).forEach(function (it) {
        for (var i = 0; i < it.text.length; i++) {
          var x = it.x + i;
          if (x > 0 && x < COLS - 1) marks[x + ',' + lane.y] = 'c-error';
        }
      });
    });
    markText(marks, PLAYER_GLYPH, Math.round(m.px), m.py, 'c-qa');
    return marks;
  },
  failLines: [
    ['SYSTEM', 'Regression found. Back to the last safe checkpoint.'],
    ['QA', 'Who changed the login page. WHO.'],
  ],
};

LEAD_GAMES.argue = ARGUE_GAME;
LEAD_GAMES.breakout = BREAKOUT_GAME;
LEAD_GAMES.frogger = FROGGER_GAME;
