// Product Owner journey minigames. They plug into LEAD_GAMES so scenes can use them via scene.mini.

// Tiny deterministic RNG so minigames can live in plain state objects
function poNext(seed) {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}
function poVal(seed) {
  return seed / 0x7fffffff;
}

// ---------------------------------------------------------------- STACK (shaping the ticket with BA)
// Requirements slide across; SPACE drops them onto the ticket. Overhang gets descoped.
// Red SCOPE CREEP slides past once: let it go, or the ticket gets too big.
var STK_BASE_Y = 23;
var STK_WIDTH = 26;
var STK_TARGET = 7;
var STK_MAX_SIZE = 10;
var STK_CREEP_SIZE = 3;
var STK_MIN_W = 4;
var STK_REQS = ['AAA USERS SEE BUTTON', 'BUTTON IS ACCESSIBLE', 'NULL ROLE HANDLED', 'WORKS ON MOBILE', 'CLICK OPENS FORM', 'ANALYTICS EVENT', 'UX APPROVED COPY', 'ERROR MESSAGE SHOWN'];
var STK_CREEP = ['DARK MODE TOO', 'AI CHATBOT', 'REDESIGN HOMEPAGE', 'BLOCKCHAIN?', 'MAKE IT POP'];

function stkText(label, w) {
  var inner = Math.max(0, w - 2);
  var t = label.slice(0, inner);
  var left = Math.floor((inner - t.length) / 2);
  return '[' + ' '.repeat(left) + t + ' '.repeat(inner - left - t.length) + ']';
}

function stkSpawn(m) {
  var seed = poNext(m.seed);
  var placed = m.stack.length - 1;
  var creep = !m.cur || !m.cur.creep ? poVal(seed) < 0.35 && placed > 0 : false;
  seed = poNext(seed);
  var list = creep ? STK_CREEP : STK_REQS;
  var label = creep ? list[Math.floor(poVal(seed) * list.length)] : STK_REQS[placed % STK_REQS.length];
  var top = m.stack[m.stack.length - 1];
  return Object.assign({}, m, {
    seed: seed,
    cur: { x: 1, w: creep ? 16 : top.w, label: label, creep: creep, dir: 1 },
  });
}

var STACK_GAME = {
  create: function (seed, fails) {
    var base = { x: Math.floor((COLS - STK_WIDTH) / 2), w: STK_WIDTH, label: 'TICKET-1337' };
    var m = { stack: [base], cur: null, size: 0, fails: fails || 0, done: false, prevJump: true, seed: (seed || 7) | 0, msg: '' };
    return stkSpawn(m);
  },
  step: function (m, dt, keys) {
    if (m.done) return m;
    keys = keys || {};
    var pressed = keys.jump && !m.prevJump;
    var placed = m.stack.length - 1;
    var cur = Object.assign({}, m.cur);
    var speed = 16 + placed * 3;
    cur.x += cur.dir * speed * dt;
    var maxX = COLS - 1 - cur.w;
    var next = Object.assign({}, m, { prevJump: !!keys.jump });
    if (cur.x >= maxX) {
      cur.x = maxX;
      if (cur.creep) return stkSpawn(Object.assign(next, { cur: cur, msg: 'Scope creep avoided.' }));
      cur.dir = -1;
    } else if (cur.x <= 1) {
      cur.x = 1;
      cur.dir = 1;
    }
    next.cur = cur;
    if (!pressed) return next;

    if (cur.creep) {
      var size = m.size + STK_CREEP_SIZE;
      if (size > STK_MAX_SIZE) return STACK_GAME.create(m.seed, m.fails + 1);
      return stkSpawn(Object.assign(next, { size: size, msg: cur.label + ' added. The ticket is getting big.' }));
    }
    var top = m.stack[m.stack.length - 1];
    var cx = Math.round(cur.x);
    var lo = Math.max(cx, top.x);
    var hi = Math.min(cx + cur.w, top.x + top.w);
    if (hi - lo < STK_MIN_W) return STACK_GAME.create(m.seed, m.fails + 1);
    var stack = m.stack.concat([{ x: lo, w: hi - lo, label: cur.label }]);
    var done = stack.length - 1 >= STK_TARGET;
    var trimmed = hi - lo < cur.w ? 'Some of it got descoped.' : 'Perfect fit.';
    next = Object.assign(next, { stack: stack, size: m.size + 1, done: done, msg: trimmed });
    return done ? next : stkSpawn(next);
  },
  curY: function (m) {
    return STK_BASE_Y - m.stack.length;
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'SHAPING TICKET-1337 :: Requirements: ' + (m.stack.length - 1) + '/' + STK_TARGET + '   Ticket size: ' + m.size + '/' + STK_MAX_SIZE + '   Restarts: ' + m.fails);
    rows = hWall(rows, 2, 1, COLS - 2);
    m.stack.forEach(function (b, i) {
      rows = stampText(rows, b.x, STK_BASE_Y - i, stkText(b.label, b.w));
    });
    if (!m.done && m.cur) rows = stampText(rows, Math.round(m.cur.x), STACK_GAME.curY(m), stkText(m.cur.label, m.cur.w));
    if (m.msg) rows = centerText(rows, 4, m.msg);
    rows = stampText(rows, 3, 25, 'SPACE drop requirement  |  Let red SCOPE CREEP slide past');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    m.stack.forEach(function (b, i) {
      markText(marks, stkText(b.label, b.w), b.x, STK_BASE_Y - i, i === 0 ? 'c-po' : 'c-ok');
    });
    if (!m.done && m.cur) markText(marks, stkText(m.cur.label, m.cur.w), Math.round(m.cur.x), STACK_GAME.curY(m), m.cur.creep ? 'c-error' : 'c-ba');
    return marks;
  },
  failLinesFor: function (m) {
    return [
      ['BA', 'That ticket is either too big or falling over. Start again?'],
      ['PO', 'Fine. Smaller this time.'],
    ];
  },
};

// ---------------------------------------------------------------- RUNNER (back-to-back meetings)
// Five tracks. Blockers and side tracks come down; switch to a clear track and let them pass.
var RUN_LANES = 5;
var RUN_LANE_W = 14;
var RUN_X0 = Math.floor((COLS - RUN_LANES * RUN_LANE_W) / 2);
var RUN_PLAYER_Y = 22;
var RUN_TARGET = 18;
var RUN_BLOCKERS = ['BLOCKER', 'DEPENDENCY', 'SIGN-OFF?', 'LEGAL REVIEW', 'BUDGET'];
var RUN_SIDETRACKS = ['QUICK CHAT?', 'ALL HANDS', 'OFFSITE', 'RE-ORG', 'TEAM PHOTO'];

function runLaneX(lane, w) {
  return RUN_X0 + lane * RUN_LANE_W + Math.floor((RUN_LANE_W - w) / 2);
}

function runSpawn(m) {
  var seed = poNext(m.seed);
  var r = poVal(seed);
  var items = m.items.slice();
  var wave = m.wave + 1;
  if (r < 0.45) {
    // Two blockers: one safe track
    seed = poNext(seed);
    var safe = Math.floor(poVal(seed) * RUN_LANES);
    for (var l = 0; l < RUN_LANES; l++) {
      if (l === safe) continue;
      seed = poNext(seed);
      items.push({ lane: l, y: 2, text: '[' + RUN_BLOCKERS[Math.floor(poVal(seed) * RUN_BLOCKERS.length)] + ']', side: 0, wave: wave });
    }
  } else {
    // One side track that may drift into a neighbouring track halfway down
    seed = poNext(seed);
    var lane = Math.floor(poVal(seed) * RUN_LANES);
    seed = poNext(seed);
    var side = lane === 0 ? 1 : lane === RUN_LANES - 1 ? -1 : poVal(seed) < 0.5 ? -1 : 1;
    seed = poNext(seed);
    items.push({ lane: lane, y: 2, text: '[' + RUN_SIDETRACKS[Math.floor(poVal(seed) * RUN_SIDETRACKS.length)] + ']', side: side, wave: wave });
  }
  return Object.assign({}, m, { seed: seed, items: items, wave: wave });
}

function runHit(m) {
  return m.items.some(function (it) {
    return it.lane === m.lane && Math.round(it.y) === RUN_PLAYER_Y;
  });
}

var RUNNER_GAME = {
  create: function (seed, fails) {
    return { lane: 1, items: [], t: 0, spawnT: 0.5, wave: 0, passed: 0, seed: (seed || 11) | 0, fails: fails || 0, done: false };
  },
  dir: function (m, d) {
    if (m.done || !d.x) return m;
    var lane = Math.max(0, Math.min(RUN_LANES - 1, m.lane + d.x));
    var next = Object.assign({}, m, { lane: lane });
    return runHit(next) ? RUNNER_GAME.create(m.seed, m.fails + 1) : next;
  },
  step: function (m, dt) {
    if (m.done) return m;
    var progress = Math.min(1, m.passed / RUN_TARGET);
    var speed = 9 + progress * 6;
    var passed = m.passed;
    var seen = {};
    var items = [];
    m.items.forEach(function (it) {
      var y = it.y + speed * dt;
      var lane = it.lane;
      var side = it.side;
      if (side && y >= 11) {
        lane += side;
        side = 0;
      }
      if (y > RUN_PLAYER_Y + 1) {
        if (!seen[it.wave]) passed++;
        seen[it.wave] = true;
        return;
      }
      items.push({ lane: lane, y: y, text: it.text, side: side, wave: it.wave });
    });
    var next = Object.assign({}, m, { items: items, passed: passed, t: m.t + dt, spawnT: m.spawnT - dt });
    if (runHit(next)) return RUNNER_GAME.create(m.seed, m.fails + 1);
    if (passed >= RUN_TARGET) return Object.assign(next, { done: true, items: [] });
    if (next.spawnT <= 0 && next.wave < RUN_TARGET) {
      next = runSpawn(next);
      next.spawnT = 1.5 - progress * 0.5;
    }
    return next;
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'BACK-TO-BACK :: Meetings survived: ' + m.passed + '/' + RUN_TARGET + '   Derailed: ' + m.fails);
    for (var y = 2; y < ROWS - 2; y++) {
      for (var l = 0; l <= RUN_LANES; l++) rows = stampText(rows, RUN_X0 + l * RUN_LANE_W - 1, y, ':');
    }
    m.items.forEach(function (it) {
      rows = stampText(rows, runLaneX(it.lane, it.text.length), Math.round(it.y), it.text);
    });
    rows = stampText(rows, runLaneX(m.lane, PLAYER_W), RUN_PLAYER_Y, PLAYER_GLYPH);
    rows = stampText(rows, 3, 25, 'A/D switch track  |  Let blockers and side tracks pass you by');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    m.items.forEach(function (it) {
      markText(marks, it.text, runLaneX(it.lane, it.text.length), Math.round(it.y), it.side || RUN_SIDETRACKS.indexOf(it.text.slice(1, -1)) >= 0 ? 'c-token' : 'c-error');
    });
    markText(marks, PLAYER_GLYPH, runLaneX(m.lane, PLAYER_W), RUN_PLAYER_Y, 'c-po');
    return marks;
  },
  failLines: [
    ['SM', 'Quick one, PO. Can we take this offline? Right now?'],
    ['PO', 'And I am back in another meeting. From the top.'],
  ],
};

// ---------------------------------------------------------------- WHACK (checking prod)
// Green requirements are working: collect them. Red ones are broken: keep them out of your blast.
var WHK_TOP = 3;
var WHK_BOTTOM = 23;
var WHK_TARGET = 12;
var WHK_STRIKES = 3;
var WHK_RADIUS = 3;
var WHK_GOOD = ['LOGIN OK', 'BUTTON OK', 'A11Y OK', 'MOBILE OK', 'EMAILS OK', 'SEARCH OK'];
var WHK_BAD = ['500 ERROR', 'NULL ROLE', 'BROKEN CSS', 'TIMEOUT', '404'];

function whkCentre(x, y, w) {
  return { x: x + w / 2, y: y };
}

function whkNear(m, it) {
  var a = whkCentre(m.px, m.py, PLAYER_W);
  var b = whkCentre(it.x, it.y, it.text.length);
  var dx = Math.max(0, Math.abs(a.x - b.x) - it.text.length / 2) / 2;
  var dy = Math.abs(a.y - b.y);
  return dx * dx + dy * dy <= WHK_RADIUS * WHK_RADIUS;
}

function whkSpawn(m) {
  var seed = poNext(m.seed);
  var bad = poVal(seed) < 0.55;
  seed = poNext(seed);
  var list = bad ? WHK_BAD : WHK_GOOD;
  var text = (bad ? '[' : '(') + list[Math.floor(poVal(seed) * list.length)] + (bad ? ']' : ')');
  for (var tries = 0; tries < 8; tries++) {
    seed = poNext(seed);
    var x = 2 + Math.floor(poVal(seed) * (COLS - 4 - text.length));
    seed = poNext(seed);
    var y = WHK_TOP + Math.floor(poVal(seed) * (WHK_BOTTOM - WHK_TOP + 1));
    var clash = m.items.some(function (o) {
      return Math.abs(o.y - y) < 2 && x < o.x + o.text.length + 2 && x + text.length + 2 > o.x;
    });
    var onPlayer = Math.abs(y - m.py) < 2 && x < m.px + PLAYER_W + 2 && x + text.length + 2 > m.px;
    if (!clash && !onPlayer) {
      return Object.assign({}, m, { seed: seed, items: m.items.concat([{ x: x, y: y, text: text, bad: bad, life: bad ? 6 : 6.5 }]) });
    }
  }
  return Object.assign({}, m, { seed: seed });
}

var WHACK_GAME = {
  create: function (seed, fails) {
    return {
      px: Math.floor(COLS / 2) - 2,
      py: 13,
      items: [],
      spawnT: 0.4,
      fixed: 0,
      strikes: 0,
      blast: 0,
      seed: (seed || 23) | 0,
      fails: fails || 0,
      done: false,
    };
  },
  dir: function (m, d) {
    if (m.done) return m;
    var px = Math.max(1, Math.min(COLS - 1 - PLAYER_W, m.px + d.x * 4));
    var py = Math.max(WHK_TOP, Math.min(WHK_BOTTOM, m.py + d.y * 2));
    return Object.assign({}, m, { px: px, py: py });
  },
  interact: function (m) {
    if (m.done) return m;
    var fixed = m.fixed;
    var strikes = m.strikes;
    var items = m.items.filter(function (it) {
      if (!whkNear(m, it)) return true;
      if (it.bad) strikes++;
      else fixed++;
      return false;
    });
    if (strikes >= WHK_STRIKES) return WHACK_GAME.create(m.seed, m.fails + 1);
    return Object.assign({}, m, { items: items, fixed: fixed, strikes: strikes, blast: 0.35, done: fixed >= WHK_TARGET });
  },
  step: function (m, dt) {
    if (m.done) return m;
    var items = m.items
      .map(function (it) {
        return Object.assign({}, it, { life: it.life - dt });
      })
      .filter(function (it) {
        return it.life > 0;
      });
    var next = Object.assign({}, m, { items: items, blast: Math.max(0, m.blast - dt), spawnT: m.spawnT - dt });
    if (next.spawnT <= 0 && items.length < 7) {
      next = whkSpawn(next);
      next.spawnT = 0.75;
    }
    return next;
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'PROD CHECK :: Features checked: ' + m.fixed + '/' + WHK_TARGET + '   Bugs triggered: ' + m.strikes + '/' + WHK_STRIKES + '   Rollbacks: ' + m.fails);
    rows = hWall(rows, 2, 1, COLS - 2);
    m.items.forEach(function (it) {
      rows = stampText(rows, it.x, it.y, it.text);
    });
    rows = stampText(rows, m.px, m.py, PLAYER_GLYPH);
    rows = stampText(rows, 3, 25, 'WASD move  |  E check nearby (GREEN) features. Keep [RED] bugs out of range.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    m.items.forEach(function (it) {
      markText(marks, it.text, it.x, it.y, it.bad ? 'c-error' : 'c-ok');
    });
    markText(marks, PLAYER_GLYPH, m.px, m.py, 'c-po');
    return marks;
  },
  waves: function (m, lines) {
    var cells = {};
    if (!m.blast) return cells;
    var c = whkCentre(m.px, m.py, PLAYER_W);
    for (var y = m.py - WHK_RADIUS; y <= m.py + WHK_RADIUS; y++) {
      for (var x = Math.floor(c.x - WHK_RADIUS * 2); x <= Math.ceil(c.x + WHK_RADIUS * 2); x++) {
        if (y < WHK_TOP || y > WHK_BOTTOM || x < 1 || x > COLS - 2 || lines[y][x] !== ' ') continue;
        var dx = (x - c.x) / 2;
        var dy = y - m.py;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d <= WHK_RADIUS && d >= WHK_RADIUS - 1.2) cells[x + ',' + y] = '*';
      }
    }
    return cells;
  },
  failLines: [
    ['DEVOPS', 'Too much is broken. Rolling the release back.'],
    ['LEAD', 'Redeploying. Please be gentle this time.'],
  ],
};

LEAD_GAMES.stack = STACK_GAME;
LEAD_GAMES.runner = RUNNER_GAME;
LEAD_GAMES.whack = WHACK_GAME;
