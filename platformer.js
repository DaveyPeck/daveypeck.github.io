// Side-on platformer for the debugging phase. Units are screen characters.
var PLAT_GRAVITY = 60; // rows / s^2
var PLAT_JUMP = 22; // initial upward speed (rows / s) -> ~4 rows jump height
var PLAT_SPEED = 18; // cols / s
var PLAT_MAX_FALL = 30;
var PLAT_W = 5; // "*DEV*"
var PLAT_LABEL = '*DEV*';

// Build a level map from a list of [row, fromCol, toCol] platforms
function buildLevelMap(title, platforms, logs) {
  var rows = emptyRoom();
  rows = stampText(rows, 3, 1, title);
  platforms.forEach(function (p) {
    rows = stampText(rows, p[1], p[0], '#'.repeat(p[2] - p[1] + 1));
  });
  // Label sits one row above the standing spot so *DEV* never overwrites it
  return stampText(rows, logs.x, logs.y - 1, '[LOGS]');
}

function logPanel(entries) {
  var bar = '+' + '-'.repeat(44) + '+';
  var body = entries.map(function (e) {
    return '| ' + e.padEnd(42).slice(0, 42) + ' |';
  });
  return [bar].concat(body, [bar]);
}

// Platforms are 3 rows apart (jump height ~4). Later levels have narrower ledges and longer gaps.
var PLATFORM_LEVELS = [
  {
    title: 'DEBUGGING :: /var/log/app.log  (1/3)',
    spawn: { x: 3, y: 25 },
    logs: { x: 57, y: 4 },
    platforms: [
      [23, 12, 19],
      [20, 25, 31],
      [17, 37, 42],
      [14, 48, 53],
      [11, 59, 64],
      [8, 68, 74],
      [5, 56, 63],
    ],
    panelAt: { x: 6, y: 3 },
    panel: [
      '[INFO]  Health check OK',
      '[INFO]  Health check OK',
      '[DEBUG] User clicked a thing',
      '[INFO]  Logging information',
      '[INFO]  Health check OK',
    ],
    lines: [
      ['LOGS', 'INFO: Health check OK. INFO: Health check OK. INFO: Health...'],
      ['LOGS', 'Thank you DEV! But your exception is in another log file!'],
      ['DEV', '...of course it is.'],
    ],
  },
  {
    title: 'DEBUGGING :: /var/log/app.log.1.gz  (2/3)',
    spawn: { x: 3, y: 25 },
    logs: { x: 61, y: 4 },
    platforms: [
      [23, 8, 11],
      [20, 16, 18],
      [17, 8, 11],
      [14, 16, 19],
      [14, 28, 31],
      [14, 40, 43],
      [14, 52, 55],
      [11, 62, 65],
      [8, 71, 75],
      [5, 60, 66],
    ],
    panelAt: { x: 8, y: 3 },
    panel: [
      '[DEBUG] Entering method DoThing()',
      '[DEBUG] Exiting method DoThing()',
      '[DEBUG] Entering method DoThing()',
      '[WARN]  Method DoThing() is deprecated',
      '[DEBUG] Exiting method DoThing()',
    ],
    lines: [
      ['LOGS', 'DEBUG: Entering method. DEBUG: Exiting method. DEBUG: ...'],
      ['LOGS', 'Thank you DEV! But your stack trace was rotated into another archive!'],
      ['DEV', 'Who set log retention to five minutes?'],
      ['LEAD', '(from far away) Me. Disk space is expensive.'],
    ],
  },
  {
    title: 'DEBUGGING :: PROD LOGS (ACCESS GRANTED, FINALLY)  (3/3)',
    spawn: { x: 73, y: 25 },
    logs: { x: 33, y: 4 },
    final: true,
    platforms: [
      [23, 62, 67],
      [20, 52, 56],
      [17, 42, 45],
      [14, 50, 53],
      [11, 60, 63],
      [8, 48, 52],
      [5, 30, 41],
    ],
    panelAt: { x: 30, y: 9 },
    panel: [
      '[ERROR] AAA-Button render failed',
      '',
      '  NullReferenceException',
      '  at Role.Name',
      '',
      '  Object reference not set to an instance.',
    ],
    lines: [
      ['LOGS', 'NullReferenceException'],
      ['LOGS', 'at Role.Name'],
      ['LOGS', 'Object reference not set to an instance.'],
      ['DEV', 'Role is null for users with no role assigned. Classic.'],
      ['SYSTEM', 'New tokens unlocked: [IS] [NOT] [NULL] [AND]'],
    ],
  },
];

PLATFORM_LEVELS.forEach(function (lvl) {
  lvl.map = buildLevelMap(lvl.title, lvl.platforms, lvl.logs);
});

function platSolid(map, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  return map[row][col] === '#';
}

// Does a PLAT_W x 1 box at (x, y) overlap any solid cell?
function platCollides(map, x, y) {
  var c0 = Math.floor(x);
  var c1 = Math.floor(x + PLAT_W - 0.001);
  var r0 = Math.floor(y);
  var r1 = Math.floor(y + 1 - 0.001);
  for (var r = r0; r <= r1; r++) {
    for (var c = c0; c <= c1; c++) {
      if (platSolid(map, c, r)) return true;
    }
  }
  return false;
}

function createPlatformer(level) {
  level = level || 0;
  var spawn = PLATFORM_LEVELS[level].spawn;
  return { level: level, x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: true, reachedLogs: false };
}

// Advance physics by dt seconds with the given held keys
function platformerStep(p, dt, keys) {
  var lvl = PLATFORM_LEVELS[p.level];
  var map = lvl.map;
  var vx = (keys.right ? PLAT_SPEED : 0) - (keys.left ? PLAT_SPEED : 0);
  var vy = p.vy;
  var onGround = p.onGround;

  if (keys.jump && onGround) {
    vy = -PLAT_JUMP;
    onGround = false;
  }
  vy = Math.min(vy + PLAT_GRAVITY * dt, PLAT_MAX_FALL);

  // Horizontal
  var x = p.x + vx * dt;
  if (platCollides(map, x, p.y)) {
    x = vx > 0 ? Math.ceil(p.x + PLAT_W) - PLAT_W : Math.floor(p.x);
    if (platCollides(map, x, p.y)) x = p.x;
  }

  // Vertical
  var y = p.y + vy * dt;
  onGround = false;
  if (platCollides(map, x, y)) {
    if (vy > 0) {
      y = Math.floor(y + 1) - 1; // land on top of the platform
      onGround = true;
    } else {
      y = Math.floor(y) + 1; // bonk head
    }
    if (platCollides(map, x, y)) y = p.y;
    vy = 0;
  }

  var px = Math.round(x);
  var reached = Math.round(y) === lvl.logs.y && px + PLAT_W > lvl.logs.x && px < lvl.logs.x + 6;

  return {
    level: p.level,
    x: x,
    y: y,
    vx: vx,
    vy: vy,
    onGround: onGround,
    reachedLogs: p.reachedLogs || reached,
  };
}

// Level + log panel, without the player (used for colouring what the player overlaps)
function buildPlatformerBase(p) {
  var lvl = PLATFORM_LEVELS[p.level];
  var rows = lvl.map.slice();
  if (p.reachedLogs) {
    var panel = logPanel(lvl.panel);
    for (var i = 0; i < panel.length; i++) {
      rows = stampText(rows, lvl.panelAt.x, lvl.panelAt.y + i, panel[i]);
    }
  }
  return rows;
}

function buildPlatformerLines(p) {
  return stampText(buildPlatformerBase(p), Math.round(p.x), Math.round(p.y), PLAT_LABEL);
}
