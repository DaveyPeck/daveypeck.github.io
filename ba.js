// Business Analyst minigames: ticket puzzles (block mover), meeting booking (Wordle) and story shaping (choices).

// ---------------------------------------------------------------- TICKET PUZZLES
// Write TICKET-1337: GIVEN AAA / WHEN LOGIN / THEN BUTTON
var BA_PUZZLE_1 = {
  width: 10,
  height: 11,
  spawn: { x: 4, y: 9 },
  submit: { x: 8, y: 9 },
  reset: { x: 1, y: 9 },
  title: 'JIRA :: TICKET-1337  "Button for AAA users. It should be good."',
  label: 'AC 1',
  goal: ['GIVEN AAA', 'WHEN LOGIN', 'THEN BUTTON'],
  targets: [
    { token: 'GIVEN', x: 1, y: 2 },
    { token: 'AAA', x: 2, y: 2 },
    { token: 'WHEN', x: 3, y: 4 },
    { token: 'LOGIN', x: 4, y: 4 },
    { token: 'THEN', x: 5, y: 6 },
    { token: 'BUTTON', x: 6, y: 6 },
  ],
  blocks: [
    { token: 'GIVEN', x: 2, y: 7 },
    { token: 'AAA', x: 3, y: 5 },
    { token: 'WHEN', x: 5, y: 8 },
    { token: 'LOGIN', x: 4, y: 6 },
    { token: 'THEN', x: 7, y: 7 },
    { token: 'BUTTON', x: 6, y: 4 },
  ],
  failText: 'Ticket rejected: the ACs do not make sense yet.',
};

// Amend TICKET-1337 with a new AC: GIVEN NULL ROLE / WHEN LOGIN / THEN NO BUTTON
var BA_PUZZLE_2 = {
  width: 10,
  height: 11,
  spawn: { x: 4, y: 9 },
  submit: { x: 8, y: 9 },
  reset: { x: 1, y: 9 },
  title: 'JIRA :: TICKET-1337 (EDITED)  "Users with no role crash the page"',
  label: 'AC 2',
  goal: ['GIVEN NULL ROLE', 'WHEN LOGIN', 'THEN NO BUTTON'],
  targets: [
    { token: 'GIVEN', x: 1, y: 2 },
    { token: 'NULL', x: 2, y: 2 },
    { token: 'ROLE', x: 3, y: 2 },
    { token: 'WHEN', x: 4, y: 4 },
    { token: 'LOGIN', x: 5, y: 4 },
    { token: 'THEN', x: 6, y: 6 },
    { token: 'NO', x: 7, y: 6 },
    { token: 'BUTTON', x: 8, y: 6 },
  ],
  blocks: [
    { token: 'GIVEN', x: 2, y: 6 },
    { token: 'NULL', x: 3, y: 8 },
    { token: 'ROLE', x: 3, y: 5 },
    { token: 'WHEN', x: 5, y: 7 },
    { token: 'LOGIN', x: 5, y: 3 },
    { token: 'THEN', x: 7, y: 4 },
    { token: 'NO', x: 7, y: 8 },
    { token: 'BUTTON', x: 8, y: 3 },
  ],
  failText: 'Ticket rejected: AC 2 does not make sense yet.',
};

// ---------------------------------------------------------------- BOOKING (Wordle)
var BK_NOW = '10:00';
var BK_SLOTS = ['1015', '1030', '1045', '1100', '1115', '1130', '1145', '1200'];
var BK_TRIES = 4;
var BK_DECLINES = ['*DEV*: in the zone', '*QA*: regression run', '*LEAD*: 1:1s', '*PO*: roadmap sync'];

function bkTime(d) {
  return d.slice(0, 2) + ':' + d.slice(2);
}

// Per digit: 'hit' (right place), 'near' (in the time, wrong place) or 'miss'
function bkScore(guess, target) {
  var res = ['miss', 'miss', 'miss', 'miss'];
  var left = {};
  for (var i = 0; i < 4; i++) {
    if (guess[i] === target[i]) res[i] = 'hit';
    else left[target[i]] = (left[target[i]] || 0) + 1;
  }
  for (var j = 0; j < 4; j++) {
    if (res[j] !== 'hit' && left[guess[j]] > 0) {
      res[j] = 'near';
      left[guess[j]]--;
    }
  }
  return res;
}

function bkCellX(k) {
  return 30 + k * 3 + (k >= 2 ? 1 : 0);
}

var BOOK_GAME = {
  create: function (seed) {
    var r = leadRng(seed || 1);
    return {
      seed: r.seed,
      target: BK_SLOTS[Math.floor(r.v * BK_SLOTS.length)],
      input: '',
      guesses: [],
      msg: 'Find the one slot that works for everyone.',
      fails: 0,
      done: false,
    };
  },
  step: function (m) {
    return m;
  },
  key: function (m, key) {
    if (m.done) return m;
    if (key === 'x' || key === 'X') return Object.assign({}, m, { input: m.input.slice(0, -1) });
    if (!/^[0-9]$/.test(key) || m.input.length >= 4) return m;
    var input = m.input + key;
    if (input.length < 4) return Object.assign({}, m, { input: input });
    if (BK_SLOTS.indexOf(input) === -1) {
      return Object.assign({}, m, { input: '', msg: bkTime(input) + ' is not a slot in the next two hours (15 min steps).' });
    }
    var guesses = m.guesses.concat([{ digits: input, score: bkScore(input, m.target) }]);
    if (input === m.target) {
      return Object.assign({}, m, { input: '', guesses: guesses, done: true, msg: bkTime(input) + ': everyone accepted!' });
    }
    if (guesses.length >= BK_TRIES) {
      return Object.assign({}, BOOK_GAME.create(m.seed), { fails: m.fails + 1 });
    }
    var decline = BK_DECLINES[(guesses.length + m.seed) % BK_DECLINES.length];
    return Object.assign({}, m, { input: '', guesses: guesses, msg: bkTime(input) + ' declined by ' + decline + '.' });
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'OUTLOOK :: NEW MEETING :: "Story shaping: TICKET-1337"');
    rows = stampText(rows, 3, 3, 'Current time: ' + BK_NOW + '. Book it within the next two hours.');
    rows = stampText(rows, 3, 4, 'Attendees: *PO* *DEV* *QA* *LEAD*  - only one slot works for everyone.');
    rows = stampText(rows, 3, 6, 'Slots: ' + BK_SLOTS.map(bkTime).join(' '));
    for (var i = 0; i < BK_TRIES; i++) {
      var y = 9 + i * 2;
      var g = m.guesses[i];
      var d = g ? g.digits : i === m.guesses.length ? (m.input + '____').slice(0, 4) : '____';
      rows = stampText(rows, 18, y, i === m.guesses.length ? 'NEXT >>' : 'TRY ' + (i + 1));
      for (var k = 0; k < 4; k++) rows = stampText(rows, bkCellX(k), y, '[' + d[k] + ']');
      rows = stampText(rows, bkCellX(2) - 1, y, ':');
    }
    rows = stampText(rows, 3, 19, m.msg);
    rows = stampText(rows, 3, 21, 'Tries left: ' + (BK_TRIES - m.guesses.length));
    rows = stampText(rows, 3, 23, 'Type 4 digits (e.g. 1030). X deletes. GREEN right place, YELLOW wrong');
    rows = stampText(rows, 3, 24, 'place, GREY not in the time at all.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    var cls = { hit: 'c-ok', near: 'c-near', miss: 'c-other' };
    m.guesses.forEach(function (g, i) {
      for (var k = 0; k < 4; k++) markText(marks, '[' + g.digits[k] + ']', bkCellX(k), 9 + i * 2, cls[g.score[k]]);
    });
    markText(marks, 'NEXT >>', 18, 9 + m.guesses.length * 2, 'c-ba');
    return marks;
  },
  failLines: [
    ['SYSTEM', 'Out of tries. Everyone has moved their calendars around.'],
    ['BA', 'Right. New availability. Let us try that again.'],
  ],
};

// ---------------------------------------------------------------- STORY SHAPING (choices)
var SHAPE_MAX_BAD = 2;
var SHAPE_QUESTIONS = [
  {
    who: 'QA',
    q: 'How many ACs are there?',
    options: [
      { text: 'How many whats are what?', reply: 'Acceptance criteria. On the ticket. That you wrote.' },
      { text: 'There is 1 AC - you can see it on my screen right now.', good: true, reply: 'Great, thanks.' },
      { text: '1.', reply: '1 what? Where? Can you share your screen?' },
    ],
  },
  {
    who: 'DEV',
    q: 'What does the button actually do?',
    options: [
      { text: 'It should be good.', reply: 'Good how? Good at what?' },
      { text: 'Whatever you think. You are the developer.', reply: 'So I am designing it now as well?' },
      { text: 'It takes AAA users to their account page - see the description.', good: true, reply: 'Okay, that is clear.' },
    ],
  },
  {
    who: 'LEAD',
    q: 'Have you considered edge cases?',
    options: [
      { text: 'Not that we know of yet - QA, can you explore those when testing?', good: true, reply: 'Sensible.' },
      { text: 'Edge cases are a dev problem.', reply: 'They are a ticket problem.' },
      { text: 'What is an edge?', reply: '...' },
    ],
  },
  {
    who: 'PO',
    q: 'Is the design signed off?',
    options: [
      { text: 'Design? It is a button.', reply: 'A GOOD button. With a design.' },
      { text: 'Yes - you approved the mockup today. It is linked in the ticket.', good: true, reply: 'Oh yes. I did.' },
      { text: 'You said it should be good, so... probably?', reply: 'That is not a sign off.' },
    ],
  },
];

var SHAPE_GAME = {
  create: function () {
    return { index: 0, bad: 0, last: null, fails: 0, done: false };
  },
  step: function (m) {
    return m;
  },
  key: function (m, key) {
    if (m.done) return m;
    var q = SHAPE_QUESTIONS[m.index];
    var opt = q.options[parseInt(key, 10) - 1];
    if (!opt) return m;
    var last = { who: q.who, text: opt.reply, good: !!opt.good };
    if (!opt.good) {
      var bad = m.bad + 1;
      if (bad >= SHAPE_MAX_BAD) return Object.assign({}, SHAPE_GAME.create(), { fails: m.fails + 1 });
      return Object.assign({}, m, { bad: bad, last: last });
    }
    var index = m.index + 1;
    return Object.assign({}, m, { index: index, last: last, done: index >= SHAPE_QUESTIONS.length });
  },
  lines: function (m) {
    var rows = emptyRoom();
    rows = stampText(rows, 3, 1, 'MEETING ROOM 3 :: STORY SHAPING :: TICKET-1337 (you are leading)');
    rows = stampText(rows, 3, 3, '*PO*  *DEV*  *QA*  *LEAD*  are waiting for you to share your screen.');
    rows = stampText(rows, 3, 4, 'Uncertainty: ' + '#'.repeat(m.bad) + '.'.repeat(SHAPE_MAX_BAD - m.bad) + '   Question ' + Math.min(m.index + 1, SHAPE_QUESTIONS.length) + ' of ' + SHAPE_QUESTIONS.length);
    if (m.last) rows = stampText(rows, 3, 6, '*' + m.last.who + '*: "' + m.last.text + '"');
    var q = SHAPE_QUESTIONS[Math.min(m.index, SHAPE_QUESTIONS.length - 1)];
    if (!m.done) {
      rows = stampText(rows, 3, 9, '*' + q.who + '*: "' + q.q + '"');
      q.options.forEach(function (o, i) {
        rows = stampText(rows, 5, 12 + i * 3, '[' + (i + 1) + '] ' + o.text);
      });
    }
    rows = stampText(rows, 3, 23, 'Press 1, 2 or 3 to answer. Too many bad answers and nobody can point it.');
    return rows;
  },
  marks: function (m) {
    var marks = {};
    if (m.last) markText(marks, m.last.text, 7 + m.last.who.length, 6, m.last.good ? 'c-ok' : 'c-error');
    if (m.bad > 0) markText(marks, '#'.repeat(m.bad), 16, 4, 'c-error');
    return marks;
  },
  failLines: [
    ['QA', 'I do not know what to point this.'],
    ['DEV', 'There is too much uncertainty. 13? 21? A spike?'],
    ['BA', 'Okay... let me start again from the top.'],
  ],
};

LEAD_GAMES.book = BOOK_GAME;
LEAD_GAMES.shape = SHAPE_GAME;
