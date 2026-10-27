var state = initialState;

function dispatch(action) {
  var next = gameReducer(state, action);
  if (next !== state) {
    state = next;
    render(state);
  }
}

var KEY_DIRS = { w: 'up', a: 'left', s: 'down', d: 'right' };

// Held keys for real-time scenes (platformer)
var held = { left: false, right: false, jump: false };

function setHeld(key, down) {
  if (key === 'a') held.left = down;
  else if (key === 'd') held.right = down;
  else if (key === ' ') held.jump = down;
}

window.addEventListener('keydown', function (e) {
  setHeld(e.key.toLowerCase(), true);
  if (e.key === ' ') e.preventDefault();
  var scene = SCENES[state.scene];
  // Typing / rhythm games take every key, except E while a conversation is showing
  if (scene.mini && LEAD_GAMES[scene.mini].key && e.key.length === 1 && !(state.talking && e.key.toLowerCase() === 'e')) {
    e.preventDefault();
    if (!e.repeat) dispatch({ type: 'type', key: e.key });
    return;
  }
  if (e.repeat && e.key.toLowerCase() === 'e') return;
  var key = e.key.toLowerCase();
  var dir = KEY_DIRS[key];
  if (dir) {
    e.preventDefault();
    dispatch({ type: 'move', dir: dir });
  } else if (key === 'e') {
    e.preventDefault();
    dispatch({ type: 'interact', rand: Math.random() });
  }
});

window.addEventListener('keyup', function (e) {
  setHeld(e.key.toLowerCase(), false);
});

window.addEventListener('blur', function () {
  held = { left: false, right: false, jump: false };
});

// Game loop: only real-time scenes need ticks
var lastTime = performance.now();
function loop(now) {
  var dt = Math.max(0, Math.min((now - lastTime) / 1000, 1 / 30)); // clamp to avoid tunnelling
  lastTime = now;
  if (SCENES[state.scene].platformer || SCENES[state.scene].battle || SCENES[state.scene].mini || state.cutscene) {
    dispatch({ type: 'tick', dt: dt, keys: held, rand: Math.random() });
  }
  requestAnimationFrame(loop);
}

// Light/dark theme toggle, remembered between visits
var themeBtn = document.getElementById('theme-toggle');
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  themeBtn.textContent = dark ? '[ LIGHT MODE ]' : '[ DARK MODE ]';
  try {
    localStorage.setItem('ttp-theme', dark ? 'dark' : 'light');
  } catch (err) {}
}
themeBtn.addEventListener('click', function () {
  applyTheme(!document.body.classList.contains('dark'));
  themeBtn.blur(); // keep SPACE/E for the game
});
var savedTheme = null;
try {
  savedTheme = localStorage.getItem('ttp-theme');
} catch (err) {}
applyTheme(savedTheme === 'dark');

fitScreen();
render(state);
requestAnimationFrame(loop);
