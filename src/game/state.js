var DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Build fresh state for entering a scene (keeps persistent flags)
function enterScene(state, sceneId) {
  var scene = SCENES[sceneId];
  var spawn = scene.puzzle ? scene.puzzle.spawn : scene.spawn;
  var fresh = {
    scene: sceneId,
    player: spawn ? { x: spawn.x, y: spawn.y } : null,
    blocks: scene.puzzle ? cloneBlocks(scene.puzzle.blocks) : [],
    plat: scene.platformer ? createPlatformer() : null,
    battle: scene.battle
      ? createBattle((state.flags || {}).devPoints || 3, (state.flags || {}).qaPoints || 5)
      : null,
    mini: scene.mini ? LEAD_GAMES[scene.mini].create(Date.now() & 0xffff) : null,
    roleIndex: 0,
    estimateIndex: 2,
    cutscene: null,
    flash: false,
    objective: scene.objective,
    dialogue: scene.intro || '',
    talking: false,
    dialogueQueue: [],
    afterDialogue: null,
    flags: state.flags || {},
  };
  // Walking between office scenes keeps you where you are (unless someone is now standing there)
  var prev = state.scene && SCENES[state.scene];
  if (prev && prev.map && prev.map === scene.map && state.player &&
      !playerBlocked(scene, state.player.x, state.player.y, fresh)) {
    fresh.player = { x: state.player.x, y: state.player.y };
  }
  // Some scenes open with a conversation (e.g. being pulled into a meeting)
  return scene.introLines ? startDialogue(fresh, { lines: scene.introLines }) : fresh;
}

var initialState = enterScene({ flags: {} }, 'roleSelect');

// After a minigame update: show push-back when it restarted, or the win dialogue when done
function miniOutcome(state, prev, mini) {
  var scene = SCENES[state.scene];
  var next = Object.assign({}, state, { mini: mini });
  if (mini.done && !prev.done) {
    return startDialogue(next, { lines: scene.winLines, after: { type: 'gotoScene', scene: nextSceneId(state.scene) } });
  }
  if (mini.fails > prev.fails) {
    return startDialogue(next, { lines: miniFailLines(LEAD_GAMES[scene.mini], mini) });
  }
  return next;
}

function formatLine(line) {
  return '*' + line[0] + '*: "' + line[1] + '"';
}

function npcAt(npcs, x, y, state) {
  if (!npcs) return null;
  for (var i = 0; i < npcs.length; i++) {
    var n = npcs[i];
    if (n.hidden && n.hidden(state)) continue;
    if (y === n.y && x >= n.x && x < n.x + n.label.length) return n;
  }
  return null;
}

// NPC within one tile (including diagonals) of any part of the player
function adjacentNpc(npcs, p, state) {
  if (!npcs || !p) return null;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= PLAYER_W; dx++) {
      var n = npcAt(npcs, p.x + dx, p.y + dy, state);
      if (n) return n;
    }
  }
  return null;
}

// Would the player (PLAYER_W wide) overlap a wall or NPC at (x, y)?
function playerBlocked(scene, x, y, state) {
  for (var i = 0; i < PLAYER_W; i++) {
    if (isWall(scene.map, x + i, y) || npcAt(scene.npcs, x + i, y, state)) return true;
  }
  return false;
}

// Estimation outcome dialogue now lives in battle.js (estimationReveal / battleOutcome)

var QA_FAIL_LINES = [
  ['QA', 'It doesn\'t work.'],
  ['DEV', 'Did you clear your cache?'],
  ['QA', 'It. Doesn\'t. Work. The page crashes for users with no role.'],
  ['LEAD', 'Better check the logs.'],
];

// Timed QA cutscene: QA leaves, lights flash, QA returns
var TIME_WAVE_LINES = [
  ['SYSTEM', 'Meeting ended. It is now 23:40.'],
  ['LEAD', 'Where did the day go. Where did everyone go.'],
];

// Lead cutscene: a blue wave of meetings (and hours) washes the office empty
function timeCutsceneStep(state, dt) {
  var t = state.cutscene.t + dt;
  if (t >= TIME_WAVE_DURATION) {
    var flags = Object.assign({}, state.flags, { dayOver: true });
    var done = Object.assign({}, state, { cutscene: null, flags: flags });
    return startDialogue(done, {
      lines: SCENES[state.scene].timeWaveLines || TIME_WAVE_LINES,
      after: { type: 'gotoScene', scene: nextSceneId(state.scene) },
    });
  }
  return Object.assign({}, state, {
    cutscene: { t: t, kind: 'time' },
    dialogue: t < 1.5 ? 'Meeting after meeting after meeting...' : 'The hours wash past. One by one, everyone goes home.',
  });
}

function cutsceneStep(state, dt) {
  if (state.cutscene.kind === 'time') return timeCutsceneStep(state, dt);
  var t = state.cutscene.t + dt;
  if (t >= 4.5) {
    var done = Object.assign({}, state, { cutscene: null, flash: false });
    return startDialogue(done, {
      lines: QA_FAIL_LINES,
      after: { type: 'gotoScene', scene: nextSceneId(state.scene) },
    });
  }
  var text;
  if (t < 0.5) text = 'QA walks off to test...';
  else if (t < 1.5) text = 'Silence. Distant mouse clicking.';
  else if (t < 3.5) text = 'Red alerts ripple across the office. Somewhere, a server sighs.';
  else text = 'QA returns. They do not look happy.';
  return Object.assign({}, state, {
    cutscene: { t: t },
    dialogue: text,
  });
}

function applyActions(state, actions) {
  if (!actions) return state;
  if (!Array.isArray(actions)) actions = [actions];
  return actions.reduce(gameReducer, state);
}

function startDialogue(state, convo) {
  var lines = convo.lines.map(formatLine);
  return Object.assign({}, state, {
    talking: true,
    dialogue: lines[0],
    dialogueQueue: lines.slice(1),
    afterDialogue: convo.after || null,
  });
}

// Pure reducer: (state, action) -> new state. Maps directly to React's useReducer later.
function gameReducer(state, action) {
  var scene = SCENES[state.scene];

  switch (action.type) {
    case 'move': {
      if (state.talking || state.cutscene) return state;
      if (scene.roleSelect) {
        var rd = action.dir === 'up' ? -1 : action.dir === 'down' ? 1 : 0;
        var ri = Math.max(0, Math.min(ROLES.length - 1, state.roleIndex + rd));
        return ri === state.roleIndex ? state : Object.assign({}, state, { roleIndex: ri });
      }
      if (scene.mini) {
        var game = LEAD_GAMES[scene.mini];
        return game.dir ? miniOutcome(state, state.mini, game.dir(state.mini, DIRS[action.dir])) : state;
      }
      if (scene.estimation) {
        var delta = action.dir === 'left' ? -1 : action.dir === 'right' ? 1 : 0;
        var idx = Math.max(0, Math.min(ESTIMATE_OPTIONS.length - 1, state.estimateIndex + delta));
        if (idx === state.estimateIndex) return state;
        return Object.assign({}, state, { estimateIndex: idx });
      }
      if (!state.player) return state;
      var d = DIRS[action.dir];
      if (scene.puzzle) {
        var result = puzzleMove(scene.puzzle, state.player, state.blocks, d);
        if (!result) return state;
        return Object.assign({}, state, { player: result.player, blocks: result.blocks });
      }
      if (!scene.map) return state;
      var nx = state.player.x + d.x;
      var ny = state.player.y + d.y;
      if (playerBlocked(scene, nx, ny, state)) return state;
      return Object.assign({}, state, { player: { x: nx, y: ny } });
    }

    case 'interact': {
      if (state.talking) {
        if (state.dialogueQueue.length > 0) {
          return Object.assign({}, state, {
            dialogue: state.dialogueQueue[0],
            dialogueQueue: state.dialogueQueue.slice(1),
          });
        }
        var ended = Object.assign({}, state, { talking: false, afterDialogue: null });
        return applyActions(ended, state.afterDialogue);
      }

      if (scene.placeholder) {
        if (scene.complete) {
          markRoleComplete((state.flags && state.flags.role) || 'dev');
          setPlayerGlyph('*DEV*');
          return enterScene({ flags: {} }, 'roleSelect');
        }
        return enterScene(state, nextSceneId(state.scene));
      }

      if (scene.roleSelect) {
        var role = ROLES[state.roleIndex];
        if (!roleAvailable(role)) {
          var msg = role.lockedBlurb ? role.name + ' is locked. ' + role.lockedBlurb : role.name + ' is coming soon. Pick another role.';
          return Object.assign({}, state, { dialogue: msg });
        }
        setPlayerGlyph(role.glyph);
        return enterScene({ flags: { role: role.id } }, JOURNEYS[role.id][0]);
      }

      if (scene.mini) {
        var ig = LEAD_GAMES[scene.mini];
        if (!ig.interact || state.mini.done) return state;
        return miniOutcome(state, state.mini, ig.interact(state.mini));
      }

      if (state.cutscene || scene.platformer || scene.battle) return state;

      if (scene.estimation) {
        var devPts = ESTIMATE_OPTIONS[state.estimateIndex];
        var qaPts = ESTIMATE_OPTIONS[qaCounterIndex(state.estimateIndex, action.rand || 0)];
        return startDialogue(state, {
          lines: estimationReveal(devPts, qaPts),
          after: [
            { type: 'setFlag', key: 'devPoints', value: devPts },
            { type: 'setFlag', key: 'qaPoints', value: qaPts },
            { type: 'gotoScene', scene: nextSceneId(state.scene) },
          ],
        });
      }

      if (scene.puzzle) {
        if (nextToCell(scene.puzzle.reset, state.player)) {
          return gameReducer(state, { type: 'reset' });
        }
        if (!nextToSubmit(scene.puzzle, state.player)) {
          return Object.assign({}, state, { dialogue: 'Walk next to [SUBMIT] or [RESET] and press E.' });
        }
        if (!puzzleSolved(scene.puzzle, state.blocks)) {
          return startDialogue(state, {
            lines: [['SYSTEM', 'Build failed: syntax error near "' + currentCode(scene.puzzle, state.blocks).join(' / ') + '"']],
          });
        }
        return startDialogue(state, {
          lines: scene.submitLines,
          after: { type: 'gotoScene', scene: nextSceneId(state.scene) },
        });
      }

      var npc = adjacentNpc(scene.npcs, state.player, state);
      if (npc) return startDialogue(state, npc.talk(state));
      if (scene.desk && nextToRect(scene.deskRect || MY_DESK, state.player)) {
        return startDialogue(state, typeof scene.desk === 'function' ? scene.desk(state) : scene.desk);
      }
      return Object.assign({}, state, { dialogue: 'Nobody here. Just you and your thoughts.' });
    }

    case 'tick': {
      if (state.cutscene) return cutsceneStep(state, action.dt);
      if (scene.mini) {
        var mg = LEAD_GAMES[scene.mini];
        if (state.mini.done && mg.animateDone) return Object.assign({}, state, { mini: mg.step(state.mini, action.dt, {}) });
        if (state.talking || state.mini.done) return state;
        return miniOutcome(state, state.mini, mg.step(state.mini, action.dt, action.keys));
      }
      if (scene.battle) {
        if (state.talking && !state.battle.done) return state;
        var battle = battleStep(state.battle, action.dt, state.battle.done ? {} : action.keys);
        var afterBattle = Object.assign({}, state, { battle: battle });
        if (battle.done && !state.battle.done) {
          afterBattle = startDialogue(afterBattle, {
            lines: battleOutcome(battle.dev, battle.qa, action.rand || 0),
            after: { type: 'gotoScene', scene: nextSceneId(state.scene) },
          });
        }
        return afterBattle;
      }
      if (!scene.platformer || state.talking || state.plat.reachedLogs) return state;
      var plat = platformerStep(state.plat, action.dt, action.keys);
      var next = Object.assign({}, state, { plat: plat });
      if (plat.reachedLogs) {
        var lvl = PLATFORM_LEVELS[plat.level];
        next = startDialogue(next, {
          lines: lvl.lines,
          after: lvl.final
            ? [
                { type: 'setFlag', key: 'nullTokensUnlocked', value: true },
                { type: 'gotoScene', scene: nextSceneId(state.scene) },
              ]
            : { type: 'nextLevel' },
        });
      }
      return next;
    }

    case 'nextLevel': {
      var level = state.plat.level + 1;
      return Object.assign({}, state, {
        plat: createPlatformer(level),
        dialogue: 'Opening ' + PLATFORM_LEVELS[level].title.split(':: ')[1] + '...',
      });
    }

    case 'type': {
      if (!scene.mini || state.talking || state.mini.done) return state;
      var tg = LEAD_GAMES[scene.mini];
      if (!tg.key) return state;
      return miniOutcome(state, state.mini, tg.key(state.mini, action.key));
    }

    case 'startCutscene':
      return Object.assign({}, state, { cutscene: { t: 0, kind: action.kind }, flash: false });

    case 'gotoScene':
      return enterScene(state, action.scene);

    case 'reset': {
      if (!scene.puzzle || state.talking) return state;
      var fresh = enterScene(state, state.scene);
      fresh.dialogue = 'Reverted all changes. git checkout -- .';
      return fresh;
    }

    case 'setFlag': {
      var flags = Object.assign({}, state.flags);
      flags[action.key] = action.value;
      return Object.assign({}, state, { flags: flags });
    }

    default:
      return state;
  }
}
