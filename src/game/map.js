// Screen grid: 80 x 27 characters. With a ~0.6 char aspect ratio this is ~16:9.
var COLS = 80;
var ROWS = 27;

var PLAYER_GLYPH = '*DEV*';
var PLAYER_W = PLAYER_GLYPH.length;

// Empty bordered room
function emptyRoom() {
  var rows = [];
  for (var y = 0; y < ROWS; y++) {
    if (y === 0 || y === ROWS - 1) rows.push('#'.repeat(COLS));
    else rows.push('#' + ' '.repeat(COLS - 2) + '#');
  }
  return rows;
}

// Write text into a map copy (returns new rows). Text partly off the left/right edge is clipped.
function stampText(rows, x, y, text) {
  if (y < 0 || y >= rows.length) return rows;
  if (x < 0) {
    text = text.slice(-x);
    x = 0;
  }
  if (!text || x >= COLS) return rows;
  var copy = rows.slice();
  var row = copy[y];
  copy[y] = (row.slice(0, x) + text + row.slice(x + text.length)).slice(0, COLS);
  return copy;
}

// Horizontal wall from x1..x2 (inclusive) with optional door gap [doorFrom, doorTo]
function hWall(rows, y, x1, x2, door) {
  for (var x = x1; x <= x2; x++) {
    if (door && x >= door[0] && x <= door[1]) continue;
    rows = stampText(rows, x, y, '#');
  }
  return rows;
}

// Vertical wall from y1..y2 (inclusive) with optional door gap [doorFrom, doorTo]
function vWall(rows, x, y1, y2, door) {
  for (var y = y1; y <= y2; y++) {
    if (door && y >= door[0] && y <= door[1]) continue;
    rows = stampText(rows, x, y, '#');
  }
  return rows;
}

// 3-row piece of furniture: +----+ / | LABEL | / +----+
function furniture(rows, x, y, w, label) {
  var inner = w - 2;
  var left = Math.floor((inner - label.length) / 2);
  var mid = ' '.repeat(left) + label + ' '.repeat(inner - left - label.length);
  rows = stampText(rows, x, y, '+' + '-'.repeat(inner) + '+');
  rows = stampText(rows, x, y + 1, '|' + mid + '|');
  return stampText(rows, x, y + 2, '+' + '-'.repeat(inner) + '+');
}

// Anything that isn't floor (space) is solid
function isWall(map, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return map[y][x] !== ' ';
}

// The one office floor used by all top-down scenes
var OFFICE_FLOOR = (function () {
  var r = emptyRoom();

  // Meeting Room 3 (top right), door on its left wall
  r = vWall(r, 39, 1, 12, [7, 9]);
  r = hWall(r, 12, 40, 78);
  r = stampText(r, 40, 1, 'MEETING ROOM 3 (BOOKED BY SOMEONE ELSE)');
  r = furniture(r, 52, 6, 20, 'TABLE');

  // Meeting Room 2 (bottom right), booked and door closed
  r = vWall(r, 39, 13, 25);
  for (var dy = 17; dy <= 19; dy++) r = stampText(r, 39, dy, '|');
  r = stampText(r, 40, 13, 'MEETING ROOM 2 (BOOKED BY SOMEONE ELSE)');
  r = furniture(r, 52, 18, 20, 'TABLE');
  r = stampText(r, 54, 17, '*SALES*');
  r = stampText(r, 64, 17, '*HR*');
  r = stampText(r, 55, 21, '*FINANCE*');
  r = stampText(r, 47, 19, '*CEO*');
  r = furniture(r, 67, 23, 11, 'PRINTER');

  // Open plan (left) with everyone's desks
  r = stampText(r, 3, 1, 'OPEN PLAN');
  r = furniture(r, 4, 4, 12, 'LEAD DESK');
  r = furniture(r, 22, 4, 11, 'QA DESK');
  r = furniture(r, 4, 13, 12, 'HOT DESK');
  r = furniture(r, 22, 13, 10, 'HOT DESK');
  r = furniture(r, 22, 20, 10, 'HOT DESK');
  r = furniture(r, 4, 20, 12, 'DEV DESK');

  return r;
})();

// Same floor once the people who actually booked Meeting Room 3 turn up (door shut)
var OFFICE_FLOOR_BOOKED = (function () {
  var r = OFFICE_FLOOR;
  for (var dy = 7; dy <= 9; dy++) r = stampText(r, 39, dy, '|');
  r = stampText(r, 54, 4, '*ARCHITECT*');
  r = stampText(r, 45, 7, '*SM*');
  r = stampText(r, 54, 10, '*DEV2*');
  r = stampText(r, 63, 10, '*QA2*');
  r = stampText(r, 73, 7, '*UX*');
  return r;
})();

// Late evening: everyone has gone home, rooms unbooked and doors open
var OFFICE_FLOOR_EMPTY = (function () {
  var r = OFFICE_FLOOR;
  r = stampText(r, 40, 1, 'MEETING ROOM 3' + ' '.repeat(25));
  r = stampText(r, 40, 13, 'MEETING ROOM 2' + ' '.repeat(25));
  for (var dy = 17; dy <= 19; dy++) r = stampText(r, 39, dy, ' ');
  r = stampText(r, 54, 17, '       ');
  r = stampText(r, 64, 17, '    ');
  r = stampText(r, 55, 21, '         ');
  r = stampText(r, 47, 19, '     ');
  return r;
})();

var DESK_SPAWN = { x: 9, y: 23 };

// Scrum Master finale: Meeting Room 3 booked for the pizza party
var OFFICE_FLOOR_PARTY = (function () {
  var r = OFFICE_FLOOR_EMPTY;
  r = stampText(r, 40, 1, 'MEETING ROOM 3 (PIZZA PARTY!)');
  r = furniture(r, 52, 6, 20, '[PIZZA] [PIZZA]');
  return r;
})();
var PARTY_TABLE = { x: 52, y: 6, w: 20, h: 3 };
var SM_SPAWN = { x: 25, y: 23 };

var PARTY_DESK_SPOTS = {
  dev: { label: '*DEV*', x: 8, y: 23 },
  lead: { label: '*LEAD*', x: 7, y: 7 },
  qa: { label: '*QA*', x: 25, y: 7 },
  po: { label: '*PO*', x: 8, y: 16 },
  ba: { label: '*BA*', x: 25, y: 16 },
};

var PARTY_ROOM_SPOTS = {
  dev: { label: '*DEV*', x: 54, y: 4 },
  lead: { label: '*LEAD*', x: 63, y: 4 },
  qa: { label: '*QA*', x: 54, y: 10 },
  po: { label: '*PO*', x: 63, y: 10 },
  ba: { label: '*BA*', x: 73, y: 7 },
};

// Whoever you are playing sees their own desk as MY DESK
var ROLE_DESKS = {
  lead: { x: 4, y: 4, w: 12 },
  qa: { x: 22, y: 4, w: 11 },
  dev: { x: 4, y: 20, w: 12 },
  po: { x: 4, y: 13, w: 12 },
  ba: { x: 22, y: 13, w: 10 },
};
function labelMyDesk(rows, role) {
  var d = ROLE_DESKS[role];
  return d ? furniture(rows, d.x, d.y, d.w, 'MY DESK') : rows;
}

// Your desk is interactable (E) to start coding / debugging
var MY_DESK = { x: 4, y: 20, w: 12, h: 3 };

function nextToRect(rect, p) {
  if (!p) return false;
  return (
    p.x + PLAYER_W - 1 >= rect.x - 1 && p.x <= rect.x + rect.w && p.y >= rect.y - 1 && p.y <= rect.y + rect.h
  );
}

// Everyone around the Meeting Room 3 table for story shaping
var MEETING_SPOTS = {
  ba: { label: '*BA*', x: 47, y: 7 },
  po: { label: '*PO*', x: 73, y: 7 },
  lead: { label: '*LEAD*', x: 59, y: 4 },
  qa: { label: '*QA*', x: 60, y: 10 },
};

// Everyone back at their own desks
var DESK_SPOTS = {
  ba: { label: '*BA*', x: 25, y: 16 },
  po: { label: '*PO*', x: 8, y: 16 },
  lead: { label: '*LEAD*', x: 7, y: 7 },
  qa: { label: '*QA*', x: 25, y: 7 },
};

// Who the player is depends on the chosen role (e.g. *DEV* or *LEAD*)
function setPlayerGlyph(glyph) {
  PLAYER_GLYPH = glyph;
  PLAYER_W = glyph.length;
}

// Lead journey: the lead's own desk, and where everyone stands when you are the lead
var LEAD_DESK = { x: 4, y: 4, w: 12, h: 3 };
var LEAD_SPAWN = { x: 7, y: 7 };

var LEAD_MEETING_SPOTS = {
  ba: { label: '*BA*', x: 47, y: 7 },
  po: { label: '*PO*', x: 73, y: 7 },
  dev: { label: '*DEV*', x: 59, y: 4 },
  qa: { label: '*QA*', x: 60, y: 10 },
};

var LEAD_DESK_SPOTS = {
  ba: { label: '*BA*', x: 25, y: 16 },
  po: { label: '*PO*', x: 8, y: 16 },
  dev: { label: '*DEV*', x: 8, y: 23 },
  qa: { label: '*QA*', x: 25, y: 7 },
};

var LEAD_EVENING_SPOTS = {
  po: { label: '*PO*', x: 8, y: 16 },
};

// QA journey: QA's own desk, and where everyone stands when you are QA
var QA_DESK = { x: 22, y: 4, w: 11, h: 3 };
var QA_SPAWN = { x: 25, y: 7 };

var QA_MEETING_SPOTS = {
  ba: { label: '*BA*', x: 47, y: 7 },
  po: { label: '*PO*', x: 73, y: 7 },
  lead: { label: '*LEAD*', x: 59, y: 4 },
  dev: { label: '*DEV*', x: 60, y: 10 },
};

var QA_DESK_SPOTS = {
  ba: { label: '*BA*', x: 25, y: 16 },
  po: { label: '*PO*', x: 8, y: 16 },
  lead: { label: '*LEAD*', x: 7, y: 7 },
  dev: { label: '*DEV*', x: 8, y: 23 },
};

// PO journey: PO works from the hot desk by the window
var PO_DESK = { x: 4, y: 13, w: 12, h: 3 };
var PO_SPAWN = { x: 8, y: 16 };

var PO_DESK_SPOTS = {
  ba: { label: '*BA*', x: 25, y: 16 },
  lead: { label: '*LEAD*', x: 7, y: 7 },
  qa: { label: '*QA*', x: 25, y: 7 },
  dev: { label: '*DEV*', x: 8, y: 23 },
};

var PO_MEETING_SPOTS = {
  ba: { label: '*BA*', x: 47, y: 7 },
  lead: { label: '*LEAD*', x: 59, y: 4 },
  qa: { label: '*QA*', x: 60, y: 10 },
  dev: { label: '*DEV*', x: 73, y: 7 },
};

var PO_EVENING_SPOTS = {
  lead: { label: '*LEAD*', x: 7, y: 7 },
};

// BA journey: BA works from the middle hot desk
var BA_DESK = { x: 22, y: 13, w: 10, h: 3 };
var BA_SPAWN = { x: 25, y: 16 };

var BA_DESK_SPOTS = {
  po: { label: '*PO*', x: 8, y: 16 },
  lead: { label: '*LEAD*', x: 7, y: 7 },
  qa: { label: '*QA*', x: 25, y: 7 },
  dev: { label: '*DEV*', x: 8, y: 23 },
};

var BA_EVENING_SPOTS = {
  lead: { label: '*LEAD*', x: 7, y: 7 },
  po: { label: '*PO*', x: 8, y: 16 },
};
