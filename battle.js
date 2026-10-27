// "Battle of the Wills": space-invaders style estimation argument.
// QA's arguments descend as words; DEV fires counter-arguments word by word.

// QA pointed MORE than DEV -> QA argues it's bigger; DEV fires "it's small" words
// QA pointed LESS than DEV -> QA argues it's smaller; DEV fires "it's big" words
// One entry per round; each round brings fresh arguments
var BATTLE_ROUNDS = [
  {
    more: ['WE NEED AUTOMATION TESTS', 'HOW MANY ROLES CAN A USER HAVE', 'WHAT ABOUT ACCESSIBILITY'],
    less: ["THERE'S NOT MUCH TO TEST", 'HOW LONG CAN DEV TAKE', "IT'S JUST ONE BUTTON"],
  },
  {
    more: ['REGRESSION TAKES A SPRINT', 'WHICH BROWSERS DO WE SUPPORT', "WE DON'T HAVE TEST DATA", 'WHAT ABOUT MOBILE'],
    less: ['COPY THE OTHER BUTTON', 'IT IS ONLY A FRONT END CHANGE', "ONLY A FEW AC'S", 'NO NEW BACKEND'],
  },
  {
    more: ['TEST ENV IS DOWN AGAIN', 'DO WE NEED PEN TESTING', 'WHAT IF THE API TIMES OUT', 'SIGN OFF NEEDS THREE PEOPLE', 'PERFORMANCE TESTING THOUGH'],
    less: ['WE CAN TEST IN PROD', 'JUST A SMOKE TEST', 'IT WORKED LAST TIME', 'AUTOMATION WILL CATCH IT', 'SHIP IT FRIDAY'],
  },
];
var BATTLE_SPEED = [1.5, 2.45, 3]; // formation speed multiplier per round

var BATTLE_AMMO = {
  more: ['NO', "IT'S", 'ONE', 'BUTTON', 'NO', 'UNIT', 'TEST', 'COVER', 'JUST', 'SIMPLE', 'LOGIC'],
  less: ['THERE', 'COULD', 'BE', 'OTHER', 'SCENARIOS', 'WE', 'SHOULD', 'POINT', 'FOR', 'UNCERTAINTY'],
};

var BATTLE_PLAYER_Y = 24;
var BATTLE_PLAYER_SPEED = 30; // cols / s
var BATTLE_BULLET_SPEED = 30; // rows / s
var BATTLE_FIRE_COOLDOWN = 0.3;
var BATTLE_STEP_TIME = 0.35; // formation moves one column this often
var BATTLE_MAX_DROP = 8; // formation stops descending after this many rows
var BATTLE_BURST_TIME = 0.6;

function battleEnemies(mode, round) {
  var enemies = [];
  BATTLE_ROUNDS[round][mode].forEach(function (phrase, row) {
    var words = phrase.split(' ');
    var width = phrase.length + (words.length - 1); // two spaces between words
    var x = Math.floor((COLS - width) / 2);
    words.forEach(function (w) {
      enemies.push({ text: w, x: x, y: 4 + row * 2, alive: true });
      x += w.length + 2;
    });
  });
  return enemies;
}

function createBattle(dev, qa) {
  var mode = qa > dev ? 'more' : 'less';
  return {
    mode: mode,
    dev: dev,
    qa: qa,
    round: 0,
    x: Math.floor(COLS / 2) - 2,
    enemies: battleEnemies(mode, 0),
    offsetX: 0,
    offsetY: 0,
    dir: 1,
    stepT: 0,
    bullets: [],
    ammo: 0,
    cooldown: 0,
    bursts: [],
    done: false,
  };
}

function formationFits(enemies, offsetX) {
  return enemies.every(function (e) {
    return !e.alive || (e.x + offsetX >= 2 && e.x + offsetX + e.text.length <= COLS - 2);
  });
}

function battleStep(b, dt, keys) {
  // Player movement
  var vx = (keys.right ? BATTLE_PLAYER_SPEED : 0) - (keys.left ? BATTLE_PLAYER_SPEED : 0);
  var x = Math.max(1, Math.min(COLS - 1 - PLAYER_W, b.x + vx * dt));

  // Firing (hold SPACE for auto-fire)
  var cooldown = Math.max(0, b.cooldown - dt);
  var ammo = b.ammo;
  var bullets = b.bullets
    .map(function (s) {
      return { text: s.text, x: s.x, y: s.y - BATTLE_BULLET_SPEED * dt };
    })
    .filter(function (s) {
      return s.y >= 1;
    });
  if (keys.jump && cooldown === 0) {
    var list = BATTLE_AMMO[b.mode];
    var word = list[ammo % list.length];
    bullets.push({ text: word, x: Math.round(x + PLAYER_W / 2 - word.length / 2), y: BATTLE_PLAYER_Y - 1 });
    ammo++;
    cooldown = BATTLE_FIRE_COOLDOWN;
  }

  // Formation movement: side to side, dropping a row at each edge
  var offsetX = b.offsetX;
  var offsetY = b.offsetY;
  var dir = b.dir;
  var stepT = b.stepT + dt;
  var stepTime = BATTLE_STEP_TIME / BATTLE_SPEED[b.round];
  if (stepT >= stepTime) {
    stepT -= stepTime;
    if (formationFits(b.enemies, offsetX + dir)) {
      offsetX += dir;
    } else {
      dir = -dir;
      offsetY = Math.min(BATTLE_MAX_DROP, offsetY + 1);
    }
  }

  // Collisions: a bullet hits a word on the same row with overlapping columns
  var enemies = b.enemies.map(function (e) {
    return { text: e.text, x: e.x, y: e.y, alive: e.alive };
  });
  var bursts = b.bursts
    .map(function (p) {
      return { x: p.x, y: p.y, w: p.w, t: p.t + dt };
    })
    .filter(function (p) {
      return p.t < BATTLE_BURST_TIME;
    });
  bullets = bullets.filter(function (s) {
    var by = Math.round(s.y);
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      var ex = e.x + offsetX;
      var ey = e.y + offsetY;
      if (by === ey && s.x < ex + e.text.length && s.x + s.text.length > ex) {
        e.alive = false;
        bursts.push({ x: ex, y: ey, w: e.text.length, t: 0 });
        return false;
      }
    }
    return true;
  });

  var round = b.round;
  var cleared = enemies.every(function (e) {
    return !e.alive;
  });
  var done = cleared && round >= BATTLE_ROUNDS.length - 1;
  if (cleared && !done) {
    round++;
    enemies = battleEnemies(b.mode, round);
    offsetX = 0;
    offsetY = 0;
    dir = 1;
    stepT = 0;
    bullets = [];
  }

  return {
    mode: b.mode,
    dev: b.dev,
    qa: b.qa,
    round: round,
    x: x,
    enemies: enemies,
    offsetX: offsetX,
    offsetY: offsetY,
    dir: dir,
    stepT: stepT,
    bullets: bullets,
    ammo: ammo,
    cooldown: cooldown,
    bursts: bursts,
    done: done,
  };
}

function buildBattleLines(b) {
  var rows = emptyRoom();
  rows = stampText(rows, 3, 1, 'BATTLE OF THE WILLS :: *DEV* says ' + b.dev + '  vs  *QA* says ' + b.qa);
  rows = stampText(rows, COLS - 7, 2, '*QA*');
  rows = stampText(rows, 3, 2, 'ROUND ' + (b.round + 1) + '/' + BATTLE_ROUNDS.length);
  b.enemies.forEach(function (e) {
    if (e.alive) rows = stampText(rows, e.x + b.offsetX, e.y + b.offsetY, e.text);
  });
  b.bullets.forEach(function (s) {
    rows = stampText(rows, s.x, Math.round(s.y), s.text);
  });
  rows = stampText(rows, Math.round(b.x), BATTLE_PLAYER_Y, PLAYER_GLYPH);
  if (!b.done) rows = stampText(rows, 3, 25, 'A/D move  |  SPACE argue back');
  return rows;
}

// Colour classes for QA's words and DEV's counter-arguments: { "x,y": cls }
function battleMarks(b) {
  var marks = {};
  function mark(text, x, y, cls) {
    for (var i = 0; i < text.length; i++) marks[x + i + ',' + y] = cls;
  }
  b.enemies.forEach(function (e) {
    if (e.alive) mark(e.text, e.x + b.offsetX, e.y + b.offsetY, 'c-qa');
  });
  b.bullets.forEach(function (s) {
    mark(s.text, s.x, Math.round(s.y), 'c-dev');
  });
  return marks;
}

// Small red wave bursts where words were destroyed: { "x,y": char }
function battleBurstCells(b, lines) {
  var cells = {};
  b.bursts.forEach(function (p, k) {
    var keep = (1 - p.t / BATTLE_BURST_TIME) * 0.8;
    var tick = Math.floor(p.t * 15);
    for (var y = p.y - 1; y <= p.y + 1; y++) {
      for (var x = p.x - 2; x < p.x + p.w + 2; x++) {
        if (y < 1 || y > ROWS - 2 || x < 1 || x > COLS - 2 || lines[y][x] !== ' ') continue;
        if (cellNoise(x, y, tick + k * 31) >= keep) continue;
        var pick = cellNoise(y, x, tick * 3 + k);
        cells[x + ',' + y] = pick < 0.6 ? '~' : WAVE_SYMBOLS[Math.floor(pick * 97) % WAVE_SYMBOLS.length];
      }
    }
  });
  return cells;
}

// QA always disagrees by one step
function qaCounterIndex(index, rand) {
  if (index === 0) return 1;
  if (index === ESTIMATE_OPTIONS.length - 1) return index - 1;
  return rand < 0.5 ? index - 1 : index + 1;
}

function estimationReveal(dev, qa) {
  var lines = [
    ['BA', 'Everyone flip your cards in 3... 2... 1...'],
    ['DEV', dev + '.'],
    ['QA', qa + '.'],
  ];
  if (qa > dev) {
    lines.push(['QA', dev + '? You forgot about testing. Again.']);
    lines.push(['DEV', 'It is ONE button.']);
  } else {
    lines.push(['QA', 'It is just a button. ' + qa + ' tops.']);
    lines.push(['DEV', 'Says the person who will not be writing it.']);
  }
  lines.push(['BA', 'Okay... let\'s discuss.']);
  lines.push(['SYSTEM', 'A BATTLE OF THE WILLS BEGINS. Shoot down QA\'s arguments!']);
  return lines;
}

function battleOutcome(dev, qa, rand) {
  var lines = [
    ['QA', 'Fine. FINE. But it is going in the test plan.'],
    ['BA', 'PO, you have the casting vote.'],
  ];
  var final;
  if (rand < 0.5) {
    final = dev;
    lines.push(['PO', 'DEV\'s ' + dev + '. They have to build it.']);
    lines.push(['QA', '(writes something in a notebook)']);
  } else {
    final = qa;
    lines.push(['PO', 'QA\'s ' + qa + '. I did not follow any of that, but QA looked confident.']);
    lines.push(['DEV', '...']);
  }
  return lines.concat([
    ['BA', final + ' points it is!'],
    ['SYSTEM', 'TICKET-1337 created and assigned to DEV.'],
    ['LEAD', 'Aligned. Ship it by Friday.'],
    ['BA', 'Great session everyone! Back to your desks.'],
  ]);
}
