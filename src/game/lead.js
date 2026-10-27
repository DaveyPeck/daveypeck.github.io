// Lead Developer minigames: typing (meetings), rhythm (back-to-back invites), snake (code review).
// Each game exposes: create(seed), step(m, dt), key(m, key), dir(m, d), lines(m), marks(m).
// Engines report progress through m.done (won) and m.fails (incremented whenever the game restarts).

function leadRng(seed) {
  var s = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
  return { v: s / 0x80000000, seed: s };
}

function markText(marks, text, x, y, cls) {
  for (var i = 0; i < text.length; i++) marks[x + i + ',' + y] = cls;
}

// ---------------------------------------------------------------- TYPING
var TYPING_PHRASES = [
  'LETS TAKE THAT OFFLINE',
  'YOU ARE ON MUTE',
  'CAN EVERYONE SEE MY SCREEN',
  'LETS CIRCLE BACK ON THAT',
  'I WILL RAISE A SPIKE',
];
var TYPING_LIMIT = 45; // seconds before the meeting overruns

var TYPING_GAME = {
  create: function () {
    return { index: 0, pos: 0, t: 0, errors: 0, flash: 0, fails: 0, done: false };
  },
  step: function (m, dt) {
    var t = m.t + dt;
    var flash = Math.max(0, m.flash - dt);
    if (t >= TYPING_LIMIT) {
      return Object.assign({}, TYPING_GAME.create(), { fails: m.fails + 1 });
    }
    return Object.assign({}, m, { t: t, flash: flash });
  },
  key: function (m, key) {
    if (m.done) return m;
    var phrase = TYPING_PHRASES[m.index];
    if (key.toUpperCase() !== phrase[m.pos]) {
      return Object.assign({}, m, { errors: m.errors + 1, flash: 0.25 });
    }
    var pos = m.pos + 1;
    if (pos < phrase.length) return Object.assign({}, m, { pos: pos });
    var index = m.index + 1;
    return Object.assign({}, m, { index: index, pos: 0, done: index >= TYPING_PHRASES.length });
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'MEETING ROOM 3 :: SPRINT PLANNING (PART 2 OF 4)');
    rows = stampText(rows, 3, 3, '*BA*  *PO*  *QA*  *DEV*  are all looking at you.');
    var left = Math.max(0, Math.ceil(TYPING_LIMIT - m.t));
    var bar = Math.round((left / TYPING_LIMIT) * 40);
    rows = stampText(rows, 3, 5, 'MEETING ENDS IN ' + (left < 10 ? '0' : '') + left + 's  [' + '='.repeat(bar) + ' '.repeat(40 - bar) + ']');
    TYPING_PHRASES.forEach(function (p, i) {
      var y = 9 + i * 2;
      var prefix = i < m.index ? '  [SAID] ' : i === m.index ? '  >>     ' : '         ';
      rows = stampText(rows, 10, y, prefix + p);
    });
    rows = stampText(rows, 10, 21, 'Mistakes: ' + m.errors);
    rows = stampText(rows, 10, 23, 'Type the highlighted phrase to keep the meeting moving.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    var left = Math.max(0, Math.ceil(TYPING_LIMIT - m.t));
    if (left <= 10) markText(marks, 'MEETING ENDS IN 00s', 3, 5, 'c-error');
    TYPING_PHRASES.forEach(function (p, i) {
      var y = 9 + i * 2;
      var x = 19;
      if (i < m.index) markText(marks, p, x, y, 'c-ok');
      if (i === m.index) {
        markText(marks, p.slice(0, m.pos), x, y, 'c-lead');
        markText(marks, p[m.pos] || '', x + m.pos, y, m.flash > 0 ? 'c-error' : 'c-action');
      }
    });
    return marks;
  },
  failLines: [
    ['SM', 'Okay we are out of time. I will book a follow-up.'],
    ['LEAD', 'For the follow-up to the follow-up?'],
    ['SM', 'Exactly. Same time. Same room. From the top.'],
  ],
};

// ---------------------------------------------------------------- RHYTHM
var RHYTHM_KEYS = ['d', 'f', 'j', 'k'];
var RHYTHM_LANE_X = [12, 28, 44, 60];
var RHYTHM_HIT_Y = 21;
var RHYTHM_SPEED = 9; // rows per second
var RHYTHM_WINDOW = 0.2; // seconds either side of the beat
var RHYTHM_PASS = 0.75;
var RHYTHM_LABELS = ['[STANDUP]', '[1:1]', '[SYNC]', '[REFINE]', '[RETRO]', '[DEMO]', '[ALL HANDS]', '[CATCH UP]'];
// [time, lane] pairs: gets busier as the day goes on
var RHYTHM_CHART = (function () {
  var chart = [];
  var t = 2;
  var pattern = [0, 1, 2, 3, 2, 1, 0, 3, 1, 2, 0, 3, 3, 2, 1, 0, 0, 2, 1, 3, 2, 0, 3, 1];
  pattern.forEach(function (lane, i) {
    chart.push({ t: t, lane: lane, label: RHYTHM_LABELS[i % RHYTHM_LABELS.length] });
    t += i < 8 ? 0.8 : i < 16 ? 0.6 : 0.45;
  });
  return chart;
})();

var RHYTHM_GAME = {
  create: function () {
    return {
      t: 0,
      notes: RHYTHM_CHART.map(function (n) {
        return { t: n.t, lane: n.lane, label: n.label, state: 'live' };
      }),
      hits: 0,
      misses: 0,
      feedback: [null, null, null, null],
      fails: 0,
      done: false,
    };
  },
  step: function (m, dt) {
    var t = m.t + dt;
    var misses = m.misses;
    var feedback = m.feedback.map(function (f) {
      return f && f.until > t ? f : null;
    });
    var notes = m.notes.map(function (n) {
      if (n.state === 'live' && t - n.t > RHYTHM_WINDOW) {
        misses++;
        feedback[n.lane] = { text: 'DOUBLE BOOKED', until: t + 0.4, ok: false };
        return Object.assign({}, n, { state: 'missed' });
      }
      return n;
    });
    var finished = notes.every(function (n) {
      return n.state !== 'live';
    });
    if (finished) {
      if (m.hits / notes.length >= RHYTHM_PASS) return Object.assign({}, m, { t: t, notes: notes, misses: misses, done: true });
      return Object.assign({}, RHYTHM_GAME.create(), { fails: m.fails + 1 });
    }
    return Object.assign({}, m, { t: t, notes: notes, misses: misses, feedback: feedback });
  },
  key: function (m, key) {
    var lane = RHYTHM_KEYS.indexOf(key.toLowerCase());
    if (lane < 0 || m.done) return m;
    var best = -1;
    m.notes.forEach(function (n, i) {
      if (n.state === 'live' && n.lane === lane && Math.abs(n.t - m.t) <= RHYTHM_WINDOW) {
        if (best < 0 || Math.abs(n.t - m.t) < Math.abs(m.notes[best].t - m.t)) best = i;
      }
    });
    var feedback = m.feedback.slice();
    if (best < 0) {
      feedback[lane] = { text: 'NO MEETING', until: m.t + 0.3, ok: false };
      return Object.assign({}, m, { feedback: feedback });
    }
    var notes = m.notes.slice();
    notes[best] = Object.assign({}, notes[best], { state: 'hit' });
    feedback[lane] = { text: 'JOINED', until: m.t + 0.3, ok: true };
    return Object.assign({}, m, { notes: notes, hits: m.hits + 1, feedback: feedback });
  },
  noteY: function (m, n) {
    return Math.round(RHYTHM_HIT_Y - (n.t - m.t) * RHYTHM_SPEED);
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'MY DESK :: BACK-TO-BACK MEETINGS  (calendar is 140% full)');
    rows = stampText(rows, 3, 2, 'Joined: ' + m.hits + '   Double booked: ' + m.misses + '   Need ' + Math.round(RHYTHM_PASS * 100) + '%');
    m.notes.forEach(function (n) {
      if (n.state !== 'live') return;
      var y = RHYTHM_GAME.noteY(m, n);
      if (y < 4 || y > RHYTHM_HIT_Y + 1) return;
      rows = stampText(rows, RHYTHM_LANE_X[n.lane] + 6 - Math.floor(n.label.length / 2), y, n.label);
    });
    rows = stampText(rows, 6, RHYTHM_HIT_Y, '-'.repeat(68));
    RHYTHM_KEYS.forEach(function (k, i) {
      var f = m.feedback[i];
      if (f) rows = stampText(rows, RHYTHM_LANE_X[i] + 6 - Math.floor(f.text.length / 2), RHYTHM_HIT_Y - 2, f.text);
      rows = stampText(rows, RHYTHM_LANE_X[i] + 4, RHYTHM_HIT_Y + 2, '( ' + k.toUpperCase() + ' )');
    });
    rows = stampText(rows, 3, 25, 'Press D / F / J / K as each invite hits the line to join it.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    m.notes.forEach(function (n) {
      if (n.state !== 'live') return;
      var y = RHYTHM_GAME.noteY(m, n);
      markText(marks, n.label, RHYTHM_LANE_X[n.lane] + 6 - Math.floor(n.label.length / 2), y, 'c-po');
    });
    m.feedback.forEach(function (f, i) {
      if (f) markText(marks, f.text, RHYTHM_LANE_X[i] + 6 - Math.floor(f.text.length / 2), RHYTHM_HIT_Y - 2, f.ok ? 'c-ok' : 'c-error');
    });
    RHYTHM_KEYS.forEach(function (k, i) {
      markText(marks, '( ' + k.toUpperCase() + ' )', RHYTHM_LANE_X[i] + 4, RHYTHM_HIT_Y + 2, 'c-action');
    });
    return marks;
  },
  failLines: [
    ['SYSTEM', 'You missed too many meetings. 6 people have messaged "you there?"'],
    ['LEAD', 'Fine. I will rejoin them all. From the top.'],
  ],
};

// ---------------------------------------------------------------- SNAKE
var SNAKE_TOP = 3;
var SNAKE_BOTTOM = 24;
var SNAKE_LEFT = 2;
var SNAKE_RIGHT = 77;
var SNAKE_TARGET = 10;
var SNAKE_STEP = 0.075;
var SNAKE_ON_SCREEN = 4; // issues visible at once
var SNAKE_ISSUES = ['BUG', 'NULL', 'EDGE-CASE', 'TODO', 'MAGIC-NUMBER', 'NO-TESTS', 'HARDCODED', 'TYPO', 'N+1', 'RACE', 'SQL-INJECT', 'DEAD-CODE'];
var SNAKE_PUSHBACK = [
  ['DEV', 'Are you sure? It works on my machine.'],
  ['DEV', 'Resolved. (No changes made.)'],
  ['DEV', 'Can you clarify what you mean by "no"?'],
  ['DEV', 'I replied to your comment with a comment.'],
  ['DEV', 'Out of scope. Raising a ticket. Maybe.'],
];

// Place a new issue somewhere not touching the snake or other issues
function snakePlaceFood(m, seed, index) {
  var r;
  var text = SNAKE_ISSUES[index % SNAKE_ISSUES.length];
  var others = m.foods || [];
  for (var tries = 0; tries < 200; tries++) {
    r = leadRng(seed);
    seed = r.seed;
    var x = SNAKE_LEFT + 1 + Math.floor(r.v * (SNAKE_RIGHT - SNAKE_LEFT - text.length - 1));
    r = leadRng(seed);
    seed = r.seed;
    var y = SNAKE_TOP + 1 + Math.floor(r.v * (SNAKE_BOTTOM - SNAKE_TOP - 1));
    var clash = m.body.some(function (s) {
      return Math.abs(s.y - y) <= 1 && s.x >= x - 2 && s.x <= x + text.length + 1;
    }) || others.some(function (f) {
      return f.y === y && x < f.x + f.text.length + 2 && x + text.length + 2 > f.x;
    });
    if (!clash) return { food: { x: x, y: y, text: text }, seed: seed };
  }
  return { food: { x: SNAKE_LEFT + 2, y: SNAKE_TOP + 2, text: text }, seed: seed };
}

var SNAKE_GAME = {
  create: function (seed, fails) {
    var m = {
      body: [
        { x: 20, y: 14 },
        { x: 19, y: 14 },
        { x: 18, y: 14 },
        { x: 17, y: 14 },
      ],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      grow: 0,
      eaten: 0,
      spawned: 0,
      stepT: 0,
      fails: fails || 0,
      done: false,
      seed: seed || 12345,
      foods: [],
    };
    for (var i = 0; i < SNAKE_ON_SCREEN; i++) {
      var placed = snakePlaceFood(m, m.seed, m.spawned);
      m.foods = m.foods.concat([placed.food]);
      m.seed = placed.seed;
      m.spawned++;
    }
    return m;
  },
  dir: function (m, d) {
    if (d.x === -m.dir.x && d.y === -m.dir.y) return m;
    return Object.assign({}, m, { nextDir: d });
  },
  step: function (m, dt) {
    if (m.done) return m;
    var stepT = m.stepT + dt;
    var stepTime = SNAKE_STEP * Math.max(0.6, 1 - m.eaten * 0.025);
    if (stepT < stepTime) return Object.assign({}, m, { stepT: stepT });
    stepT -= stepTime;
    var dir = m.nextDir;
    var head = { x: m.body[0].x + dir.x, y: m.body[0].y + dir.y };
    var hitWall = head.x < SNAKE_LEFT || head.x > SNAKE_RIGHT || head.y < SNAKE_TOP || head.y > SNAKE_BOTTOM;
    var hitSelf = m.body.slice(0, -1).some(function (s) {
      return s.x === head.x && s.y === head.y;
    });
    if (hitWall || hitSelf) return SNAKE_GAME.create(m.seed, m.fails + 1);

    var body = [head].concat(m.body);
    var grow = m.grow;
    if (grow > 0) grow--;
    else body.pop();

    var next = Object.assign({}, m, { body: body, dir: dir, grow: grow, stepT: stepT });
    var eatenIdx = -1;
    m.foods.forEach(function (f, i) {
      if (head.y === f.y && head.x >= f.x && head.x < f.x + f.text.length) eatenIdx = i;
    });
    if (eatenIdx < 0) return next;

    next.eaten = m.eaten + 1;
    next.grow = grow + 2;
    next.foods = m.foods.filter(function (_, i) {
      return i !== eatenIdx;
    });
    if (next.eaten >= SNAKE_TARGET) {
      next.done = true;
      return next;
    }
    // Keep the board topped up until there are only enough issues left to finish
    if (next.spawned < SNAKE_TARGET) {
      var placed = snakePlaceFood(next, m.seed, next.spawned);
      next.foods = next.foods.concat([placed.food]);
      next.seed = placed.seed;
      next.spawned++;
    }
    return next;
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'CODE REVIEW :: PR #42 "Add AAA button"   Issues found: ' + m.eaten + '/' + SNAKE_TARGET + '   Re-reviews: ' + m.fails);
    rows = hWall(rows, 2, 1, COLS - 2);
    if (!m.done) {
      m.foods.forEach(function (f) {
        rows = stampText(rows, f.x, f.y, f.text);
      });
    }
    m.body.forEach(function (s, i) {
      rows = stampText(rows, s.x, s.y, i === 0 ? '@' : '/');
    });
    rows = stampText(rows, 3, 25, 'WASD steer your review comments. Hit a wall or yourself and DEV pushes back.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    if (!m.done) {
      m.foods.forEach(function (f) {
        markText(marks, f.text, f.x, f.y, 'c-error');
      });
    }
    m.body.forEach(function (s, i) {
      marks[s.x + ',' + s.y] = i === 0 ? 'c-action' : 'c-lead';
    });
    return marks;
  },
  failLinesFor: function (m) {
    return [SNAKE_PUSHBACK[(m.fails - 1) % SNAKE_PUSHBACK.length], ['LEAD', 'Sigh. Re-reviewing from the top.']];
  },
};

// ---------------------------------------------------------------- CATCH (replaces the rhythm lanes)
// Meeting invites fall from the top; slide *LEAD* left/right with A/D to join them.
var CATCH_Y = 22;
var CATCH_PADDLE = '\\_*LEAD*_/';
var CATCH_MOVE = 45; // cols per second
var CATCH_PASS = 0.75;
var CATCH_CHART = (function () {
  var chart = [];
  var t = 1.5;
  for (var i = 0; i < 20; i++) {
    var label = RHYTHM_LABELS[i % RHYTHM_LABELS.length];
    chart.push({
      t: t,
      x: 3 + ((i * 37 + 11) % (COLS - 6 - label.length)),
      v: 6 + i * 0.3, // rows per second, speeds up through the day
      label: label,
    });
    t += Math.max(0.7, 1.4 - i * 0.04);
  }
  return chart;
})();

var CATCH_GAME = {
  create: function () {
    return {
      t: 0,
      x: Math.floor((COLS - CATCH_PADDLE.length) / 2),
      notes: CATCH_CHART.map(function (n) {
        return { t: n.t, x: n.x, v: n.v, label: n.label, state: 'live' };
      }),
      hits: 0,
      misses: 0,
      feedback: null,
      fails: 0,
      done: false,
    };
  },
  noteY: function (m, n) {
    return 3 + (m.t - n.t) * n.v;
  },
  step: function (m, dt, keys) {
    keys = keys || {};
    var t = m.t + dt;
    var vx = (keys.right ? CATCH_MOVE : 0) - (keys.left ? CATCH_MOVE : 0);
    var x = Math.max(1, Math.min(COLS - 1 - CATCH_PADDLE.length, m.x + vx * dt));
    var px = Math.round(x);
    var hits = m.hits;
    var misses = m.misses;
    var feedback = m.feedback && m.feedback.until > t ? m.feedback : null;
    var probe = { t: t };
    var notes = m.notes.map(function (n) {
      if (n.state !== 'live' || t < n.t) return n;
      if (CATCH_GAME.noteY(probe, n) < CATCH_Y) return n;
      var caught = n.x < px + CATCH_PADDLE.length && n.x + n.label.length > px;
      if (caught) {
        hits++;
        feedback = { text: 'JOINED ' + n.label, until: t + 0.6, ok: true };
      } else {
        misses++;
        feedback = { text: 'MISSED ' + n.label, until: t + 0.6, ok: false };
      }
      return Object.assign({}, n, { state: caught ? 'hit' : 'missed' });
    });
    var finished = notes.every(function (n) {
      return n.state !== 'live';
    });
    if (finished) {
      if (hits / notes.length >= CATCH_PASS) {
        return Object.assign({}, m, { t: t, x: x, notes: notes, hits: hits, misses: misses, done: true });
      }
      return Object.assign({}, CATCH_GAME.create(), { fails: m.fails + 1 });
    }
    return Object.assign({}, m, { t: t, x: x, notes: notes, hits: hits, misses: misses, feedback: feedback });
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'LEAD DESK :: BACK-TO-BACK MEETINGS  (calendar is 140% full)');
    rows = stampText(rows, 3, 2, 'Joined: ' + m.hits + '   Missed: ' + m.misses + '   Need ' + Math.round(CATCH_PASS * 100) + '%');
    m.notes.forEach(function (n) {
      if (n.state !== 'live' || m.t < n.t) return;
      var y = Math.round(CATCH_GAME.noteY(m, n));
      if (y >= 3 && y < CATCH_Y) rows = stampText(rows, n.x, y, n.label);
    });
    if (m.feedback) rows = stampText(rows, Math.floor((COLS - m.feedback.text.length) / 2), CATCH_Y + 2, m.feedback.text);
    rows = stampText(rows, Math.round(m.x), CATCH_Y, CATCH_PADDLE);
    rows = stampText(rows, 3, 25, 'A/D to slide under each invite and join it.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    m.notes.forEach(function (n) {
      if (n.state !== 'live' || m.t < n.t) return;
      var y = Math.round(CATCH_GAME.noteY(m, n));
      if (y >= 3 && y < CATCH_Y) markText(marks, n.label, n.x, y, 'c-po');
    });
    if (m.feedback) {
      markText(marks, m.feedback.text, Math.floor((COLS - m.feedback.text.length) / 2), CATCH_Y + 2, m.feedback.ok ? 'c-ok' : 'c-error');
    }
    markText(marks, CATCH_PADDLE, Math.round(m.x), CATCH_Y, 'c-lead');
    return marks;
  },
  failLines: [
    ['SYSTEM', 'You missed too many meetings. 6 people have messaged "you there?"'],
    ['LEAD', 'Fine. I will rejoin them all. From the top.'],
  ],
};

// ---------------------------------------------------------------- RELEASE (flappy style)
// Tap SPACE to keep the release in the air and fly through the gaps between problems.
var FLAP_TOP = 3;
var FLAP_BOTTOM = 24;
var FLAP_X = 10;
var FLAP_GLYPH = '*LEAD*';
var FLAP_GRAVITY = 70; // rows / s^2
var FLAP_KICK = -13; // rows / s (about one row of lift per tap)
var FLAP_SPEED = 13; // cols / s
var FLAP_SPACING = 34;
var FLAP_GAP = 9;
var FLAP_LABELS = [
  'API ISSUE',
  'CALL DEVOPS',
  'PIPELINE IS DOWN',
  'CERT EXPIRED',
  'MERGE CONFLICT',
  'DB LOCKED',
  'CACHE NOT CLEARED',
  'CHANGE FREEZE',
  'VPN DROPPED',
  'FEATURE FLAG OFF',
];

var FLAP_FINISH_TEXT = [
  '*  .  *  .  *  .  *  .  *',
  '',
  '  SUCCESSFUL  RELEASE  ',
  '',
  '*  .  *  .  *  .  *  .  *',
];
var FLAP_EXIT_SPEED = 30; // cols / s once the release is through
var FLAP_RAINBOW = ['c-error', 'c-token', 'c-ok', 'c-qa', 'c-po', 'c-lead', 'c-ba'];
var FLAP_GAME = {
  create: function () {
    return {
      y: 13,
      vy: 0,
      px: FLAP_X,
      exiting: false,
      started: false,
      prevJump: false,
      towers: FLAP_LABELS.map(function (label, i) {
        return { x: COLS + i * FLAP_SPACING, gapY: 6 + ((i * 5 + 2) % 9), label: label };
      }),
      finishX: COLS + FLAP_LABELS.length * FLAP_SPACING,
      fails: 0,
      done: false,
    };
  },
  towerW: function (tw) {
    return tw.label.length + 2;
  },
  step: function (m, dt, keys) {
    keys = keys || {};
    // Past the finish line: *LEAD* cruises off the right of the screen
    if (m.exiting) {
      var px = m.px + FLAP_EXIT_SPEED * dt;
      return Object.assign({}, m, { px: px, done: px >= COLS });
    }
    var flap = !!keys.jump && !m.prevJump;
    if (!m.started) {
      return Object.assign({}, m, { started: flap, vy: flap ? FLAP_KICK : 0, prevJump: !!keys.jump });
    }
    var vy = flap ? FLAP_KICK : m.vy + FLAP_GRAVITY * dt;
    var y = m.y + vy * dt;
    var towers = m.towers.map(function (tw) {
      return { x: tw.x - FLAP_SPEED * dt, gapY: tw.gapY, label: tw.label };
    });
    var ry = Math.round(y);
    var crashed = ry < FLAP_TOP || ry > FLAP_BOTTOM;
    var passed = 0;
    towers.forEach(function (tw) {
      var w = FLAP_GAME.towerW(tw);
      var tx = Math.round(tw.x);
      if (tx + w <= FLAP_X) passed++;
      var overlap = tx < FLAP_X + FLAP_GLYPH.length && tx + w > FLAP_X;
      if (overlap && (ry < tw.gapY || ry >= tw.gapY + FLAP_GAP)) crashed = true;
    });
    if (crashed) return Object.assign({}, FLAP_GAME.create(), { fails: m.fails + 1 });
    var finishX = m.finishX - FLAP_SPEED * dt;
    return Object.assign({}, m, {
      y: y,
      vy: vy,
      towers: towers,
      finishX: finishX,
      prevJump: !!keys.jump,
      exiting: passed >= towers.length && Math.round(finishX) <= FLAP_X + FLAP_GLYPH.length,
    });
  },
  passed: function (m) {
    return m.towers.filter(function (tw) {
      return Math.round(tw.x) + FLAP_GAME.towerW(tw) <= FLAP_X;
    }).length;
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'PROD RELEASE :: 23:47 :: Problems cleared: ' + FLAP_GAME.passed(m) + '/' + m.towers.length);
    rows = hWall(rows, 2, 1, COLS - 2);
    m.towers.forEach(function (tw) {
      var tx = Math.round(tw.x);
      var w = FLAP_GAME.towerW(tw);
      if (tx >= COLS - 1 || tx + w <= 1) return;
      for (var y = FLAP_TOP; y <= FLAP_BOTTOM; y++) {
        if (y >= tw.gapY && y < tw.gapY + FLAP_GAP) continue;
        var edge = y === tw.gapY - 1 || y === tw.gapY + FLAP_GAP;
        var text = edge ? '[' + tw.label + ']' : '[' + '='.repeat(w - 2) + ']';
        rows = stampText(rows, tx, y, text);
      }
    });
    var fx = Math.round(m.finishX);
    if (fx < COLS - 1) {
      for (var fy = FLAP_TOP; fy <= FLAP_BOTTOM; fy++) {
        rows = stampText(rows, fx, fy, fy % 2 ? '#' : ' ');
        rows = stampText(rows, fx + 1, fy, fy % 2 ? ' ' : '#');
      }
      FLAP_FINISH_TEXT.forEach(function (t, i) {
        rows = stampText(rows, fx + 4, 11 + i, t);
      });
    }
    rows = stampText(rows, Math.round(m.px), Math.round(m.y), FLAP_GLYPH);
    rows = emptyRoomBorders(rows);
    if (!m.started) rows = stampText(rows, 22, 13, 'Press SPACE to start the release');
    rows = stampText(rows, 3, 25, 'SPACE to keep the release flying. Hit a problem and it rolls back.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    m.towers.forEach(function (tw) {
      var tx = Math.round(tw.x);
      [tw.gapY - 1, tw.gapY + FLAP_GAP].forEach(function (y) {
        if (y >= FLAP_TOP && y <= FLAP_BOTTOM) {
          for (var i = 0; i < tw.label.length; i++) {
            var x = tx + 1 + i;
            if (x > 0 && x < COLS - 1) marks[x + ',' + y] = 'c-error';
          }
        }
      });
    });
    var fx = Math.round(m.finishX);
    if (fx < COLS - 1) {
      for (var fy = FLAP_TOP; fy <= FLAP_BOTTOM; fy++) {
        [fx, fx + 1].forEach(function (x) {
          if (x > 0 && x < COLS - 1) marks[x + ',' + fy] = 'c-ok';
        });
      }
      FLAP_FINISH_TEXT.forEach(function (t, i) {
        for (var c = 0; c < t.length; c++) {
          var x = fx + 4 + c;
          if (x > 0 && x < COLS - 1 && t[c] !== ' ') {
            marks[x + ',' + (11 + i)] = i === 2 ? FLAP_RAINBOW[c % FLAP_RAINBOW.length] : 'c-ok';
          }
        }
      });
    }
    markText(marks, FLAP_GLYPH, Math.round(m.px), Math.round(m.y), 'c-lead');
    return marks;
  },
  failLines: [
    ['SYSTEM', 'Deployment failed. Rolling back...'],
    ['DEVOPS', 'Have you tried running the pipeline again?'],
    ['LEAD', 'From the top. Again.'],
  ],
};

// Keep the outer border intact when sprites scroll over the edge
function emptyRoomBorders(rows) {
  return rows.map(function (row, y) {
    if (y === 0 || y === ROWS - 1) return '#'.repeat(COLS);
    return '#' + row.slice(1, COLS - 1) + '#';
  });
}

var LEAD_GAMES = { typing: TYPING_GAME, rhythm: CATCH_GAME, snake: SNAKE_GAME, flappy: FLAP_GAME };

function miniFailLines(game, m) {
  return game.failLinesFor ? game.failLinesFor(m) : game.failLines;
}
