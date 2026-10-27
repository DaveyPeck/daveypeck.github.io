// Scene definitions. Each scene describes its map, NPCs and objective.
// NPC "talk(state)" returns { lines: [[speaker, text], ...], after: action | [actions] }.

var SCENE_ORDER = [
  'planning',
  'estimation',
  'battle',
  'deskCoding1',
  'coding1',
  'leadReview1',
  'qaFail',
  'deskDebug',
  'platformer',
  'coding2',
  'leadReview2',
  'qaPass',
  'poApproval',
  'complete',
];

// Each role plays its own journey through the same office
var JOURNEYS = {
  dev: SCENE_ORDER,
  lead: ['leadStart', 'leadTyping', 'leadDeskMeeting', 'leadRhythm', 'leadPrReady', 'leadReview', 'leadAfterReview', 'leadEvening', 'leadRelease', 'leadComplete'],
  qa: ['qaStart', 'qaArgue', 'qaDesk', 'qaTestCall', 'qaBreakout', 'qaWaitPr', 'qaRegression', 'qaComplete'],
  po: ['poStart', 'poStack', 'poDesk', 'poShaping', 'poDesk2', 'poRunner', 'poDemo', 'poSignoff', 'poAfterSignoff', 'poNight', 'poCheck', 'poComplete'],
  ba: ['baStart', 'baTicket', 'baBookDesk', 'baBook', 'baToMeeting', 'baShape', 'baBackDesk', 'baQaBug', 'baAmend', 'baTellPo', 'baEndDay', 'baComplete'],
  sm: ['smStart', 'smParty', 'smComplete'],
  sm: ['smStart', 'smParty', 'smComplete'],
};

var ROLES = [
  { id: 'dev', name: 'DEVELOPER', glyph: '*DEV*', available: true, blurb: 'Build one small button. How hard can it be?' },
  { id: 'lead', name: 'LEAD DEVELOPER', glyph: '*LEAD*', available: true, blurb: 'Survive back-to-back meetings, then review a PR.' },
  { id: 'qa', name: 'TESTER', glyph: '*QA*', available: true, blurb: 'Question everything. Break the button. Guard prod.' },
  { id: 'po', name: 'PRODUCT OWNER', glyph: '*PO*', available: true, blurb: 'Shape the ticket, survive meetings, sign off the release.' },
  { id: 'ba', name: 'BUSINESS ANALYST', glyph: '*BA*', available: true, blurb: 'Write the ticket, book the meeting, lead the shaping.' },
  { id: 'sm', name: 'SCRUM MASTER', glyph: '*SM*', available: false, blurb: 'The release is out. Time for pizza.', lockedBlurb: 'Complete every other role to unlock.' },
];

// Completed roles are remembered in the browser so the final role can unlock
var MAIN_ROLES = ['dev', 'lead', 'qa', 'po', 'ba'];

function loadCompletedRoles() {
  try {
    return JSON.parse(localStorage.getItem('ttpCompletedRoles')) || {};
  } catch (e) {
    return {};
  }
}

function markRoleComplete(id) {
  if (!id) return;
  var done = loadCompletedRoles();
  done[id] = true;
  try {
    localStorage.setItem('ttpCompletedRoles', JSON.stringify(done));
  } catch (e) {}
}

function roleAvailable(r) {
  if (r.id !== 'sm') return r.available;
  var done = loadCompletedRoles();
  return MAIN_ROLES.every(function (id) {
    return done[id];
  });
}

function nextSceneId(id) {
  var ids = Object.keys(JOURNEYS);
  for (var j = 0; j < ids.length; j++) {
    var order = JOURNEYS[ids[j]];
    var i = order.indexOf(id);
    if (i >= 0) return order[Math.min(i + 1, order.length - 1)];
  }
  return id;
}

// Pick the next line from a list, cycling each time the NPC is spoken to
function cycleLine(state, npcId, speaker, list) {
  var count = state.flags['talk_' + npcId] || 0;
  return {
    lines: [[speaker, list[count % list.length]]],
    after: { type: 'setFlag', key: 'talk_' + npcId, value: count + 1 },
  };
}

// Placeholder for scenes not built yet: press E to skip ahead
function placeholderScene(phase, objective) {
  return {
    phase: phase,
    objective: objective,
    placeholder: true,
    controls: 'E Continue',
    intro: '[' + phase + ' is under construction. Press E to skip.]',
  };
}

// Small talk when an NPC isn't the one you need right now
var SMALL_TALK = {
  ba: ['BA', ['We only need one small change.', 'I have updated the ticket. Again.', 'Could you just quickly...']],
  po: ['PO', ['I have a vision. The vision is a button.', 'Can we get it done by Friday? This Friday.', 'Have you seen my roadmap? It is mostly arrows.']],
  lead: ['LEAD', ['Have you considered edge cases?', 'Remember: null is not a feature.', 'I will be reviewing your PR. Thoroughly.']],
  qa: ['QA', ['I already have a bug template ready for you.', 'Works on your machine? Great. Ship your machine.', 'I test in prod. Just kidding. Mostly.']],
  dev: ['DEV', ['Got a sec? It is a quick one. It is never a quick one.', 'I am in the zone. Please leave.', 'Is the build red or is that just my screen?']],
};

// Top-down office scene. "key" is the NPC who moves the story on; everyone else makes small talk.
// "desk" (optional) is the conversation when you press E at MY DESK.
function officeScene(o) {
  var spots = o.spots || DESK_SPOTS;
  var npcs = Object.keys(spots).map(function (id) {
    var spot = spots[id];
    return {
      id: id,
      label: spot.label,
      x: spot.x,
      y: spot.y,
      hidden: id === o.key ? o.hidden : undefined,
      talk: function (state) {
        if (id === o.key) {
          return { lines: o.lines, after: o.after || { type: 'gotoScene', scene: o.next } };
        }
        var s = SMALL_TALK[id];
        return cycleLine(state, id, s[0], s[1]);
      },
    };
  });

  return {
    phase: o.phase,
    objective: o.objective,
    controls: 'WASD Move | E Interact',
    intro: o.intro,
    introLines: o.introLines,
    timeWave: o.timeWave,
    timeWaveLines: o.timeWaveLines,
    map: o.map || OFFICE_FLOOR_BOOKED,
    spawn: o.spawn || DESK_SPAWN,
    npcs: npcs.concat(o.extraNpcs || [DESK_SQUATTER[1]]),
    deskRect: o.deskRect || MY_DESK,
    desk: o.desk || {
      lines: [[o.speaker || 'DEV', 'My desk. Not now, I need to ' + (/^[A-Z]{2}/.test(o.objective) ? o.objective : o.objective.charAt(0).toLowerCase() + o.objective.slice(1)) + '.']],
    },
  };
}

var ESTIMATE_OPTIONS = [1, 2, 3, 5, 8];

// Someone grabbed MY DESK during the meeting; talk to them and they move to the hot desk next door
var DESK_SQUATTER = [
  {
    id: 'squatter',
    label: '*CONTRACTOR*',
    x: 4,
    y: 23,
    hidden: function (state) {
      return !!state.flags.deskReclaimed;
    },
    talk: function () {
      return {
        lines: [
          ['DEV', 'Hi. That is my desk.'],
          ['CONTRACTOR', 'It is a hot desk policy now, mate.'],
          ['DEV', 'I booked it. In the desk booking system. Six weeks ago.'],
          ['CONTRACTOR', 'There is a desk booking system?'],
          ['DEV', 'There is now.'],
          ['CONTRACTOR', 'Fine. I will be right next door. Listening to everything.'],
        ],
        after: { type: 'setFlag', key: 'deskReclaimed', value: true },
      };
    },
  },
  {
    id: 'squatterMoved',
    label: '*CONTRACTOR*',
    x: 21,
    y: 23,
    hidden: function (state) {
      return !state.flags.deskReclaimed;
    },
    talk: function () {
      return { lines: [['CONTRACTOR', 'This chair is worse. Just so you know.']] };
    },
  },
];

var SCENES = {
  planning: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Story Shaping',
    objective: 'Go to Meeting Room 3 and talk to BA',
    intro: 'You are at your desk. Your calendar was empty. Was.',
    spots: MEETING_SPOTS,
    introLines: [
      ['SYSTEM', 'New meeting invite: "Story shaping" (2 hours).'],
      ['BA', 'DEV! Got a minute? Meeting Room 3. Now. Everyone is here.'],
      ['DEV', 'It says it is booked by someone else.'],
      ['BA', 'It always says that. Nobody knows who. Come on.'],
    ],
    key: 'ba',
    next: 'estimation',
    lines: [
      ['BA', 'Ah, DEV! Thanks for joining. PO, tell them.'],
      ['PO', 'AAA users need a button. Just a button.'],
      ['BA', 'See? We only need one small change.'],
      ['DEV', '...that is what you said last sprint.'],
      ['BA', 'Here is the ticket. Let\'s estimate it!'],
    ],
  }),

  estimation: {
    phase: 'Estimation',
    objective: 'Pick a story point estimate',
    controls: 'A/D Choose | E Confirm',
    intro: '*BA*: "Okay team, cards ready. How big is it?"',
    estimation: true,
  },
  battle: {
    phase: 'Battle of the Wills',
    objective: 'Shoot down every one of QA\'s arguments',
    controls: 'A/D Move | SPACE Argue back',
    intro: '*QA* is not backing down. Neither are you.',
    battle: true,
  },
  deskCoding1: officeScene({
    map: OFFICE_FLOOR,
    phase: 'In Progress',
    objective: 'Go back to MY DESK and press E',
    intro: 'TICKET-1337 is yours. Everyone has gone back to their desks.',
    spawn: { x: 41, y: 9 },
    extraNpcs: DESK_SQUATTER,
    desk: function (state) {
      if (!state.flags.deskReclaimed) {
        return { lines: [['DEV', 'Someone else is using my desk. Their coat is on MY chair.']] };
      }
      return {
        lines: [['DEV', 'Right. One button. How hard can it be?']],
        after: { type: 'gotoScene', scene: 'coding1' },
      };
    },
  }),
  coding1: {
    phase: 'Coding',
    objective: 'Build: IF ROLE EQUALS AAA / SHOW BUTTON',
    controls: 'WASD Push | E Submit / Reset',
    intro: 'You open your editor. How hard can one button be?',
    puzzle: PUZZLE_1,
    submitLines: [
      ['SYSTEM', 'Build succeeded. 0 errors. 47 warnings (ignored).'],
      ['DEV', 'Opening a pull request for LEAD.'],
    ],
  },
  leadReview1: officeScene({
    phase: 'Lead Review',
    objective: 'Go to LEAD DESK and talk to LEAD',
    intro: 'Your PR is waiting for review. 1 file changed, 2 lines.',
    key: 'lead',
    next: 'qaFail',
    lines: [
      ['LEAD', 'Let me see... IF ROLE EQUALS AAA... SHOW BUTTON...'],
      ['LEAD', 'Have you considered edge cases?'],
      ['DEV', 'Yes.'],
      ['LEAD', '...'],
      ['LEAD', 'Looks good to me.'],
      ['SYSTEM', 'PR approved. Deployed to TEST.'],
    ],
  }),
  qaFail: officeScene({
    phase: 'QA Testing',
    objective: 'Hand the build to QA at the QA DESK',
    intro: 'The build is on TEST. QA is cracking their knuckles.',
    key: 'qa',
    lines: [
      ['DEV', 'The AAA button is ready for testing!'],
      ['QA', 'Ready? We will see about that. Back in a moment.'],
    ],
    after: { type: 'startCutscene' },
    // QA leaves the room during the test cutscene
    hidden: function (state) {
      return !!state.cutscene && state.cutscene.t >= 0.5 && state.cutscene.t < 4;
    },
  }),
  deskDebug: officeScene({
    phase: 'Bug Investigation',
    objective: 'Go back to MY DESK and press E to check the logs',
    intro: 'A bug ticket has appeared in your queue. It is assigned to you. Obviously.',
    desk: {
      lines: [
        ['DEV', 'Okay. Logs. Where are the logs.'],
        ['DEV', 'Why are there so many log files.'],
      ],
      after: { type: 'gotoScene', scene: 'platformer' },
    },
  }),
  platformer: {
    phase: 'Debugging',
    objective: 'Climb up to the [LOGS]',
    controls: 'A/D Move | SPACE Jump',
    intro: 'Descending into the log files. Mind the stack traces.',
    platformer: true,
  },
  coding2: {
    phase: 'Bug Fix',
    objective: 'Build: IF ROLE IS NOT NULL AND EQUALS AAA / SHOW BUTTON',
    controls: 'WASD Push | E Submit / Reset',
    intro: 'New tokens unlocked: [IS] [NOT] [NULL] [AND]. Null check time.',
    puzzle: PUZZLE_2,
    submitLines: [
      ['SYSTEM', 'Build succeeded. Null handled. Probably.'],
      ['DEV', 'Pushing the fix. Please be gentle, LEAD.'],
    ],
  },
  leadReview2: officeScene({
    phase: 'Lead Review',
    objective: 'Go to LEAD DESK and talk to LEAD',
    intro: 'Fix pushed. LEAD has been notified. LEAD has seen it.',
    key: 'lead',
    next: 'qaPass',
    lines: [
      ['LEAD', 'IF ROLE IS NOT NULL AND EQUALS AAA...'],
      ['LEAD', 'So you DID consider edge cases. Eventually.'],
      ['LEAD', 'Good catch.'],
      ['SYSTEM', 'PR approved. Deployed to TEST. Again.'],
    ],
  }),
  qaPass: officeScene({
    phase: 'QA Retest',
    objective: 'Ask QA to retest at the QA DESK',
    intro: 'QA has a fresh bug template open. Just in case.',
    key: 'qa',
    next: 'poApproval',
    lines: [
      ['DEV', 'Fixed the null role issue. Could you retest?'],
      ['QA', 'Testing AAA user... button visible.'],
      ['QA', 'Testing user with no role... no crash.'],
      ['QA', 'Testing in Internet Explorer... I am kidding.'],
      ['QA', 'Verified.'],
    ],
  }),
  poApproval: officeScene({
    phase: 'PO Approval',
    objective: 'Demo the feature to PO at their hot desk',
    intro: 'Demo time. Meeting Room 3 is booked by someone else, so a hot desk will do.',
    key: 'po',
    next: 'complete',
    lines: [
      ['DEV', 'Here it is. AAA users see the button.'],
      ['PO', '...'],
      ['PO', 'This is exactly what I imagined.'],
      ['PO', 'Exactly what I wanted.'],
      ['PO', 'Now, about that small change for AA users...'],
      ['DEV', 'Please create a ticket.'],
    ],
  }),
  complete: {
    phase: 'Released!',
    objective: 'Celebrate',
    placeholder: true,
    complete: true,
    controls: 'E Play Again',
    intro: 'Ticket deployed to prod. Nothing is on fire. Yet.',
  },

  roleSelect: {
    phase: 'Choose Your Role',
    objective: 'Pick who you want to be today',
    controls: 'W/S Choose | E Start',
    intro: 'Same office. Same ticket. Different suffering.',
    roleSelect: true,
  },

  // ---------------------------------------------------------------- LEAD DEVELOPER JOURNEY
  leadStart: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Morning',
    objective: 'Go to Meeting Room 3 and talk to BA',
    intro: 'You are at your desk. You have 9 meetings today. It is 9:01.',
    spots: LEAD_MEETING_SPOTS,
    spawn: LEAD_SPAWN,
    deskRect: LEAD_DESK,
    speaker: 'LEAD',
    extraNpcs: [],
    introLines: [
      ['SYSTEM', 'Meeting starting now: "Sprint planning (Part 2 of 4)".'],
      ['LEAD', 'Part 2? When was part 1?'],
      ['SYSTEM', 'You were in it. You were double booked.'],
    ],
    key: 'ba',
    next: 'leadTyping',
    lines: [
      ['BA', 'LEAD! Great, we need you to say some things.'],
      ['PO', 'Technical things. Confident things.'],
      ['LEAD', 'Right. Meeting voice. Here we go.'],
    ],
  }),
  leadTyping: {
    phase: 'Meeting',
    objective: 'Type every phrase before the meeting overruns',
    controls: 'Type the highlighted phrase',
    intro: 'Say the right words, in the right order, quickly.',
    mini: 'typing',
    winLines: [
      ['SM', 'Great meeting everyone. Actions in the chat.'],
      ['LEAD', 'What actions?'],
      ['SM', 'You have all of them.'],
      ['SYSTEM', 'Next meeting starts in 0 minutes. It is online.'],
    ],
  },
  leadDeskMeeting: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Back to Back',
    objective: 'Go back to MY DESK and press E to join',
    intro: 'Everyone has gone back to their desks. You have gone to your next meeting.',
    spots: LEAD_DESK_SPOTS,
    spawn: { x: 41, y: 9 },
    deskRect: LEAD_DESK,
    speaker: 'LEAD',
    extraNpcs: [],
    desk: {
      lines: [
        ['LEAD', 'Headphones on. Camera off. Calendar... oh no.'],
        ['SYSTEM', '20 invites incoming. Slide under each one to join it.'],
      ],
      after: { type: 'gotoScene', scene: 'leadRhythm' },
    },
  }),
  leadRhythm: {
    phase: 'Back to Back',
    objective: 'Join enough meetings to stay employed',
    controls: 'A/D Slide to join meetings',
    intro: 'Meetings are dropping into your calendar. Catch them.',
    mini: 'rhythm',
    winLines: [
      ['SYSTEM', 'Calendar cleared. You have 12 minutes of free time.'],
      ['PO', 'Oh, LEAD, before you drop. Prod release is tonight. 11pm. You are on it.'],
      ['LEAD', 'Tonight? Who signed that off?'],
      ['PO', 'You did. In the third meeting. See you at 11!'],
      ['SYSTEM', 'New notification: DEV requested your review on PR #42.'],
      ['LEAD', 'Of course they did.'],
    ],
  },
  leadPrReady: officeScene({
    phase: 'Review Requested',
    objective: 'Go to DEV DESK and talk to DEV about their PR',
    intro: 'PR #42 "Add AAA button". DEV says it is "just a small one".',
    spots: LEAD_DESK_SPOTS,
    spawn: LEAD_SPAWN,
    deskRect: LEAD_DESK,
    speaker: 'LEAD',
    extraNpcs: [],
    key: 'dev',
    next: 'leadReview',
    lines: [
      ['LEAD', 'So. PR #42.'],
      ['DEV', 'It is one button. It is fine. Approve it?'],
      ['LEAD', 'Have you considered edge cases?'],
      ['DEV', 'Yes.'],
      ['LEAD', '...I am going to review it properly.'],
    ],
  }),
  leadReview: {
    phase: 'Code Review',
    objective: 'Find ' + SNAKE_TARGET + ' issues without DEV pushing back',
    controls: 'WASD Steer your review',
    intro: 'Eat bugs and edge cases. Do not run into your own comments.',
    mini: 'snake',
    winLines: [
      ['LEAD', 'Null roles. Edge cases. Tests. All commented.'],
      ['DEV', 'Fine. Fixed. All of it. Happy now?'],
      ['LEAD', 'Approved.'],
      ['SYSTEM', 'PR #42 approved. DEV has unfollowed you.'],
      ['SYSTEM', 'Reminder: "Release readiness sync" starts in 1 minute.'],
      ['LEAD', 'Another one. Back to my desk.'],
    ],
  },
  leadAfterReview: officeScene({
    phase: 'Release Readiness',
    objective: 'Go back to MY DESK and press E to join',
    intro: 'PR #42 is merged. Your calendar has noticed you are free.',
    spots: LEAD_DESK_SPOTS,
    spawn: { x: 13, y: 23 },
    timeWave: true,
    deskRect: LEAD_DESK,
    speaker: 'LEAD',
    extraNpcs: [],
    key: 'dev',
    lines: [
      ['DEV', 'I fixed all your comments. Every single one.'],
      ['LEAD', 'Thank you.'],
      ['DEV', 'I am not speaking to you right now.'],
    ],
    after: { type: 'setFlag', key: 'devSulking', value: true },
    desk: {
      lines: [
        ['SYSTEM', 'Joined: "Release readiness sync" (14 attendees, 13 on mute).'],
        ['DEVOPS', 'Is the release ready?'],
        ['LEAD', 'It is ready.'],
        ['DEVOPS', 'Is it READY ready?'],
        ['LEAD', '...'],
        ['SM', 'Let us take that offline. Same time tomorrow?'],
        ['SYSTEM', 'Next meeting: "Release readiness sync (follow-up)"...'],
      ],
      after: { type: 'startCutscene', kind: 'time' },
    },
  }),
  leadEvening: officeScene({
    phase: 'Release Night',
    objective: 'Go to PO and start the production release',
    intro: '23:43. The office is empty. Except for PO. PO is always here.',
    map: OFFICE_FLOOR_EMPTY,
    spots: LEAD_EVENING_SPOTS,
    spawn: LEAD_SPAWN,
    deskRect: LEAD_DESK,
    speaker: 'LEAD',
    extraNpcs: [],
    key: 'po',
    next: 'leadRelease',
    lines: [
      ['PO', 'LEAD! Big night. I brought snacks. For me.'],
      ['LEAD', 'Everyone else has gone home.'],
      ['PO', 'They said they would be on the call. In spirit.'],
      ['LEAD', 'Right. Starting the pipeline.'],
      ['PO', 'I will be here for moral support. Go go go!'],
    ],
  }),
  leadRelease: {
    phase: 'Prod Release',
    objective: 'Fly the release past every problem',
    controls: 'SPACE Keep the release flying',
    intro: 'It is 23:47. Nothing can possibly go wrong.',
    mini: 'flappy',
    winLines: [
      ['SYSTEM', 'Deployment to PROD: SUCCESSFUL.'],
      ['DEVOPS', 'Health checks green. Go to bed.'],
      ['LEAD', 'It is 3am. I have standup in 6 hours.'],
    ],
  },
  leadComplete: {
    phase: 'Deployed!',
    objective: 'Celebrate',
    placeholder: true,
    complete: true,
    controls: 'E Play Again',
    intro: 'Deployed to prod successfully. You have 3 meetings about it tomorrow.',
  },

  // ---------------------------------------------------------------- QA TESTER JOURNEY
  qaStart: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Story Shaping',
    objective: 'Go to Meeting Room 3 and talk to BA',
    intro: 'You are at the QA desk. Your test plan template is already open.',
    spots: QA_MEETING_SPOTS,
    spawn: QA_SPAWN,
    deskRect: QA_DESK,
    speaker: 'QA',
    extraNpcs: [],
    introLines: [
      ['SYSTEM', 'New meeting invite: "Story shaping" (2 hours).'],
      ['QA', 'Two hours. For one button. Something is wrong already.'],
    ],
    key: 'ba',
    next: 'qaArgue',
    lines: [
      ['BA', 'QA! Great. PO, tell them.'],
      ['PO', 'AAA users need a button. Just a button.'],
      ['DEV', 'Easy. How hard can it be? One point, tops.'],
      ['QA', '...one point.'],
      ['DEV', 'There are only a few ACs.'],
      ['QA', 'Right. Let us talk about those ACs.'],
      ['SYSTEM', 'A BATTLE OF THE WILLS BEGINS. Shoot down DEV\'s excuses!'],
    ],
  }),
  qaArgue: {
    phase: 'Battle of the Wills',
    objective: 'Shoot down every one of DEV\'s excuses',
    controls: 'A/D Move | SPACE Ask awkward questions',
    intro: '*DEV* thinks it is easy. You know better.',
    mini: 'argue',
    winLines: [
      ['DEV', 'Okay. Okay! Maybe there are some edge cases.'],
      ['BA', 'I have to say, QA is right. I am adding the null role AC now.'],
      ['PO', 'I did not follow that, but QA looked very confident.'],
      ['BA', '5 points. TICKET-1337 is assigned to DEV. Back to your desks!'],
    ],
  },
  qaDesk: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Test Prep',
    objective: 'Go back to MY DESK and press E',
    intro: 'Everyone has gone back to their desks. Time to write the test plan.',
    spots: QA_DESK_SPOTS,
    spawn: { x: 41, y: 9 },
    deskRect: QA_DESK,
    speaker: 'QA',
    extraNpcs: [],
    desk: {
      lines: [
        ['QA', 'Test plan: 1. Null role. 2. Null role again. 3. Mobile.'],
        ['SYSTEM', 'Two days pass. You write 47 test cases.'],
        ['SYSTEM', 'New message from DEV: "Can you come test this? It is done. Probably."'],
      ],
      after: { type: 'gotoScene', scene: 'qaTestCall' },
    },
  }),
  qaTestCall: officeScene({
    phase: 'Ready For Test',
    objective: 'Go to DEV DESK and talk to DEV',
    intro: 'DEV says the AAA button is "ready for testing".',
    spots: QA_DESK_SPOTS,
    spawn: QA_SPAWN,
    deskRect: QA_DESK,
    speaker: 'QA',
    extraNpcs: [],
    key: 'dev',
    lines: [
      ['DEV', 'It is ready. I tested it. Works on my machine.'],
      ['QA', 'Move over. Let me drive.'],
      ['DEV', 'Be gentle. It has try/catch everywhere.'],
      ['QA', 'Perfect. Something to break through.'],
    ],
    after: { type: 'gotoScene', scene: 'qaBreakout' },
  }),
  qaBreakout: {
    phase: 'Testing',
    objective: 'Break through DEV\'s safety nets and find the bug',
    controls: 'A/D Move | SPACE Launch the test',
    intro: 'There is a bug in there somewhere. There always is.',
    mini: 'breakout',
    winLines: [
      ['SYSTEM', 'NullReferenceException: role was null.'],
      ['QA', 'Found it. Users with no role crash the whole page.'],
      ['DEV', 'That is not a real scenario.'],
      ['QA', 'It is in the ACs. Which I made the BA add. Bug raised.'],
      ['DEV', 'Fine. Fixing it. New PR incoming.'],
    ],
  },
  qaWaitPr: officeScene({
    phase: 'Bug Fix',
    objective: 'Wait for the fix, then talk to LEAD at the LEAD DESK',
    intro: 'DEV is fixing the bug. LEAD is reviewing. You are refreshing the board.',
    spots: QA_DESK_SPOTS,
    spawn: { x: 13, y: 23 },
    deskRect: QA_DESK,
    speaker: 'QA',
    extraNpcs: [],
    key: 'lead',
    next: 'qaRegression',
    lines: [
      ['LEAD', 'DEV\'s fix is approved. Null role handled. Have you considered edge cases?'],
      ['QA', 'I AM the edge cases.'],
      ['SYSTEM', 'Retest passed. PO wants it in prod. Tonight.'],
      ['LEAD', 'Full regression before release, please.'],
      ['QA', 'Already on it.'],
    ],
  }),
  qaRegression: {
    phase: 'Prod Regression',
    objective: 'Get through the regression suite to the release gate',
    controls: 'WASD Hop past the regressions',
    intro: 'Every feature in the app, all moving at once. Do not get hit.',
    mini: 'frogger',
    winLines: [
      ['SYSTEM', 'Smoke, regression and end-to-end: ALL PASSED.'],
      ['QA', 'Signed off. You may release.'],
      ['SYSTEM', 'Deployment to PROD: SUCCESSFUL.'],
      ['DEV', 'Told you it was easy.'],
      ['QA', '(adds DEV to the regression suite)'],
    ],
  },
  qaComplete: {
    phase: 'Signed Off!',
    objective: 'Celebrate',
    placeholder: true,
    complete: true,
    controls: 'E Play Again',
    intro: 'The AAA button is live. No bugs. Yet.',
  },

  // ---------------------------------------------------------------- PRODUCT OWNER JOURNEY
  poStart: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Discovery',
    objective: 'Go and talk to BA about the new idea',
    intro: 'You are at your desk. You have had An Idea.',
    spots: PO_DESK_SPOTS,
    spawn: PO_SPAWN,
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    introLines: [
      ['PO', 'AAA users need a button. A big one. A beautiful one.'],
      ['PO', 'BA will know what to do with this.'],
    ],
    key: 'ba',
    next: 'poStack',
    lines: [
      ['PO', 'BA! I need a button for AAA users.'],
      ['BA', 'Okay. What should it do?'],
      ['PO', 'Everything. Within reason. Mostly everything.'],
      ['BA', 'Let us stack up the requirements. And keep the ticket small.'],
    ],
  }),
  poStack: {
    phase: 'Shaping the Ticket',
    objective: 'Stack ' + STK_TARGET + ' requirements without the ticket getting too big',
    controls: 'SPACE Drop requirement',
    intro: 'Line each requirement up with the one below. Anything hanging off gets descoped.',
    mini: 'stack',
    winLines: [
      ['BA', 'That is a nicely sized ticket. I will write it up as TICKET-1337.'],
      ['BA', 'I will book a story shaping with DEV and QA.'],
      ['PO', 'Great. I have another meeting anyway.'],
    ],
  },
  poDesk: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Meetings',
    objective: 'Go back to MY DESK and press E to join your meeting',
    intro: 'BA has gone to write the ticket. Your calendar is calling.',
    spots: PO_DESK_SPOTS,
    spawn: PO_SPAWN,
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'Joined: "Quarterly roadmap alignment".'],
        ['STAKEHOLDER', 'So, just one more thing before we wrap up...'],
        ['SYSTEM', 'The meeting overruns by 25 minutes.'],
        ['SYSTEM', 'Reminder: "Story shaping: TICKET-1337" started 20 minutes ago. Meeting Room 3.'],
        ['PO', 'Oh no.'],
      ],
      after: { type: 'gotoScene', scene: 'poShaping' },
    },
  }),
  poShaping: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Story Shaping',
    objective: 'Hurry to Meeting Room 3 and talk to BA',
    intro: 'Story shaping started without you. Obviously.',
    spots: PO_MEETING_SPOTS,
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    key: 'ba',
    next: 'poDesk2',
    lines: [
      ['PO', "Sorry I'm late, my last meeting overran."],
      ['BA', 'No problem. DEV and QA are just... discussing.'],
      ['DEV', 'It is one button. One point. Two tops.'],
      ['QA', 'What about users with no role?'],
      ['DEV', 'Nobody has no role.'],
      ['QA', 'What about accessibility? Mobile? Automation?'],
      ['DEV', 'Unit tests cover it.'],
      ['QA', 'Which unit tests?'],
      ['DEV', 'The ones I am going to write.'],
      ['LEAD', 'Have you considered edge cases?'],
      ['BA', 'Okay! 5 points. Null role AC added. Back to your desks!'],
      ['PO', 'Great meeting, everyone. Really productive.'],
      ['SYSTEM', 'You have another meeting in 2 minutes.'],
    ],
  }),
  poDesk2: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Back to Back',
    objective: 'Go back to MY DESK and press E to join your meetings',
    intro: 'Everyone has gone back to their desks. Your calendar has not.',
    spots: PO_DESK_SPOTS,
    spawn: { x: 41, y: 9 },
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'Joined: "Stakeholder sync". Then "Pre-sync for the sync". Then...'],
        ['PO', 'Stay on track. Do not get derailed.'],
      ],
      after: { type: 'gotoScene', scene: 'poRunner' },
    },
  }),
  poRunner: {
    phase: 'Back to Back',
    objective: 'Survive ' + RUN_TARGET + ' meetings without getting derailed',
    controls: 'A/D Switch track',
    intro: 'Blockers and side tracks incoming. Find the clear track and let them pass.',
    mini: 'runner',
    winLines: [
      ['SYSTEM', 'Calendar cleared. Several days have passed.'],
      ['SYSTEM', 'New message from DEV: "AAA button is done! Can I demo it to you?"'],
      ['PO', 'A demo! My favourite kind of meeting.'],
    ],
  },
  poDemo: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Demo',
    objective: 'Go to DEV DESK and see the demo',
    intro: 'DEV wants to show you the AAA button.',
    spots: PO_DESK_SPOTS,
    spawn: PO_SPAWN,
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    key: 'dev',
    next: 'poSignoff',
    lines: [
      ['DEV', 'So here is the dashboard as an AAA user. And... there is the button.'],
      ['PO', 'Ooh. It is a button.'],
      ['DEV', 'And for users with no role, it just does not show. No crash.'],
      ['QA', '(from across the office) You are welcome.'],
      ['PO', 'I love it. Ship it. Tonight.'],
      ['DEV', 'Tonight? You will need to tell LEAD.'],
    ],
  }),
  poSignoff: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Sign Off',
    objective: 'Go to LEAD DESK and tell LEAD it is signed off',
    intro: 'You are very excited about this button.',
    spots: PO_DESK_SPOTS,
    spawn: { x: 9, y: 19 },
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    key: 'lead',
    next: 'poAfterSignoff',
    lines: [
      ['PO', 'LEAD! The AAA button is signed off. We are releasing it tonight.'],
      ['LEAD', 'Tonight. As in today.'],
      ['PO', 'You agreed. In the third meeting.'],
      ['LEAD', '...Fine. 11pm. I will deploy it, you check it.'],
    ],
  }),
  poAfterSignoff: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Release Day',
    objective: 'Go back to MY DESK and press E',
    intro: 'Release is booked for tonight. Time to wait.',
    spots: PO_DESK_SPOTS,
    spawn: { x: 9, y: 9 },
    timeWave: true,
    timeWaveLines: [
      ['SYSTEM', 'It is now 23:40.'],
      ['PO', 'Everyone has gone home. Except LEAD. Good.'],
    ],
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'Joined: "Release comms planning".'],
        ['PO', 'Do we announce it before or after it works?'],
        ['SYSTEM', 'Next meeting: "Release comms planning (part 2)"...'],
      ],
      after: { type: 'startCutscene', kind: 'time' },
    },
  }),
  poNight: officeScene({
    map: OFFICE_FLOOR_EMPTY,
    phase: 'Release Night',
    objective: 'Talk to LEAD, then check prod from MY DESK',
    intro: '23:45. The office is empty. LEAD is deploying.',
    spots: PO_EVENING_SPOTS,
    spawn: PO_SPAWN,
    deskRect: PO_DESK,
    speaker: 'PO',
    extraNpcs: [],
    key: 'lead',
    lines: [
      ['LEAD', 'Everything is deployed. Pipelines green.'],
      ['PO', 'So we are done?'],
      ['LEAD', 'You need to check it in prod. Go to your desk.'],
      ['PO', 'On it!'],
    ],
    after: { type: 'setFlag', key: 'leadDeployed', value: true },
    desk: function (state) {
      if (!state.flags.leadDeployed) return { lines: [['PO', 'I should check with LEAD first.']] };
      return {
        lines: [
          ['SYSTEM', 'Opening production...'],
          ['PO', 'Green is good. Red is bad. I can do this.'],
        ],
        after: { type: 'gotoScene', scene: 'poCheck' },
      };
    },
  }),
  poCheck: {
    phase: 'Prod Check',
    objective: 'Check ' + WHK_TARGET + ' working features without triggering ' + WHK_STRIKES + ' bugs',
    controls: 'WASD Move | E Check nearby features',
    intro: 'Working features show up in green. Bugs in red. Do not touch the red.',
    mini: 'whack',
    winLines: [
      ['SYSTEM', 'Prod health check: ALL GREEN.'],
      ['PO', 'It works! Signed off!'],
      ['LEAD', 'It is 1am. I am going home.'],
      ['PO', 'Great. Can we talk about phase 2 tomorrow? 9am?'],
    ],
  },
  poComplete: {
    phase: 'Released!',
    objective: 'Celebrate',
    placeholder: true,
    complete: true,
    controls: 'E Play Again',
    intro: 'The AAA button is live. You already have ideas for v2.',
  },

  // ---------------------------------------------------------------- BUSINESS ANALYST JOURNEY
  baStart: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Discovery',
    objective: 'PO wants a word. Go to the PO at the HOT DESK',
    intro: 'You are at your desk. A Teams message pops up from PO: "got a sec?"',
    spots: BA_DESK_SPOTS,
    spawn: BA_SPAWN,
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    key: 'po',
    next: 'baTicket',
    lines: [
      ['PO', 'BA! I have an idea. AAA users need a button.'],
      ['BA', 'Okay. What should the button do?'],
      ['PO', 'It should be good.'],
      ['BA', '...Good.'],
      ['PO', 'Really good.'],
      ['BA', 'Leave it with me. I will raise a ticket.'],
    ],
  }),
  baTicket: {
    phase: 'Writing the Ticket',
    objective: 'Write the AC: GIVEN AAA / WHEN LOGIN / THEN BUTTON',
    controls: 'WASD Push | E Submit / Reset',
    intro: 'Back at your desk. Turn "it should be good" into something testable.',
    puzzle: BA_PUZZLE_1,
    submitLines: [
      ['SYSTEM', 'TICKET-1337 created. 1 acceptance criterion.'],
      ['BA', 'Now I need to get everyone in a room to shape it.'],
    ],
  },
  baBookDesk: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Booking',
    objective: 'Press E at MY DESK to book the story shaping',
    intro: 'Ticket written. Now the hard part: calendars.',
    spots: BA_DESK_SPOTS,
    spawn: BA_SPAWN,
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'Opening Scheduling Assistant...'],
        ['BA', 'Everyone is busy. Everyone is always busy.'],
      ],
      after: { type: 'gotoScene', scene: 'baBook' },
    },
  }),
  baBook: {
    phase: 'Booking',
    objective: 'Find the slot that works for everyone in the next two hours',
    controls: '0-9 Type time | X Delete',
    intro: 'Guess a time. Green digits are right, yellow are in the wrong place.',
    mini: 'book',
    winLines: [
      ['SYSTEM', 'Meeting booked: "Story shaping: TICKET-1337". Meeting Room 3.'],
      ['SYSTEM', 'Time passes. Your reminder pops up.'],
      ['BA', 'Time to go. And I am leading it.'],
    ],
  },
  baToMeeting: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Story Shaping',
    objective: 'Go to Meeting Room 3 and talk to PO to start',
    intro: 'Everyone is in Meeting Room 3. Waiting for you.',
    spots: { po: { label: '*PO*', x: 47, y: 7 }, lead: PO_MEETING_SPOTS.lead, qa: PO_MEETING_SPOTS.qa, dev: PO_MEETING_SPOTS.dev },
    spawn: BA_SPAWN,
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    key: 'po',
    next: 'baShape',
    lines: [
      ['BA', 'Hi all. Let me share my screen.'],
      ['SYSTEM', 'Your screen is now being shared. Including your 47 open tabs.'],
      ['BA', 'So, TICKET-1337. Any questions?'],
    ],
  }),
  baShape: {
    phase: 'Story Shaping',
    objective: 'Answer the team\'s questions so they can point the ticket',
    controls: '1 / 2 / 3 Answer',
    intro: 'You are leading. Give clear answers.',
    mini: 'shape',
    winLines: [
      ['QA', 'That is clear. 3 points.'],
      ['DEV', '3 points. Agreed.'],
      ['LEAD', 'Agreed.'],
      ['BA', 'Great. 3 points it is. Thanks everyone!'],
    ],
  },
  baBackDesk: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Back to Work',
    objective: 'Go back to MY DESK and press E',
    intro: 'Shaping done. Everyone is back at their desks.',
    spots: BA_DESK_SPOTS,
    spawn: { x: 41, y: 9 },
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'A few days pass. DEV picks up TICKET-1337.'],
        ['SYSTEM', 'New message from QA: "Can you come over? Found something."'],
      ],
      after: { type: 'gotoScene', scene: 'baQaBug' },
    },
  }),
  baQaBug: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Bug Found',
    objective: 'Go to the QA DESK and talk to QA',
    intro: 'QA wants to discuss TICKET-1337.',
    spots: BA_DESK_SPOTS,
    spawn: BA_SPAWN,
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    key: 'qa',
    next: 'baAmend',
    lines: [
      ['QA', 'So, users with no role. The page crashes.'],
      ['BA', 'Users can have no role?'],
      ['QA', 'Apparently. There is nothing in the ticket about it, so I cannot test it.'],
      ['BA', 'Fair. I will add a new AC.'],
    ],
  }),
  baAmend: {
    phase: 'Amending the Ticket',
    objective: 'Add AC 2: GIVEN NULL ROLE / WHEN LOGIN / THEN NO BUTTON',
    controls: 'WASD Push | E Submit / Reset',
    intro: 'New tokens unlocked: [NULL] [ROLE] [NO]. Edge cases, considered.',
    puzzle: BA_PUZZLE_2,
    submitLines: [
      ['SYSTEM', 'TICKET-1337 updated. 2 acceptance criteria.'],
      ['QA', '(from across the office) Thank you!'],
      ['BA', 'I should let PO know the ticket has changed.'],
    ],
  },
  baTellPo: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Keeping PO Informed',
    objective: 'Go to the PO at the HOT DESK and tell them about the new AC',
    intro: 'TICKET-1337 now has 2 ACs. PO will want to know.',
    spots: BA_DESK_SPOTS,
    spawn: BA_SPAWN,
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    key: 'po',
    next: 'baEndDay',
    lines: [
      ['BA', 'Quick update on TICKET-1337. QA found users with no role crash the page.'],
      ['BA', 'I have added a new AC: no role, no button, no crash.'],
      ['PO', 'Oh. Good catch. Does that change the release?'],
      ['BA', 'DEV is fixing it now. LEAD is releasing it tonight.'],
      ['PO', 'Great. I will check it in prod. You go home.'],
    ],
  }),
  baEndDay: officeScene({
    map: OFFICE_FLOOR,
    phase: 'End of Day',
    objective: 'Go back to MY DESK and press E to finish your day',
    intro: 'Ticket written, shaped and amended. Time to wrap up.',
    spots: BA_DESK_SPOTS,
    spawn: { x: 9, y: 17 },
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'You update your notes and tidy the backlog.'],
        ['SYSTEM', 'It is now 17:30.'],
        ['BA', 'Laptop closed. The release is someone else\'s problem tonight.'],
      ],
      after: { type: 'gotoScene', scene: 'baComplete' },
    },
  }),
  baAfterAmend: officeScene({
    map: OFFICE_FLOOR,
    phase: 'Release Day',
    objective: 'Go back to MY DESK and press E',
    intro: 'Release is tonight. PO asked you to stay and check the ACs in prod.',
    spots: BA_DESK_SPOTS,
    spawn: BA_SPAWN,
    timeWave: true,
    timeWaveLines: [
      ['SYSTEM', 'It is now 23:40.'],
      ['BA', 'Everyone has gone home. Except LEAD and PO.'],
    ],
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    desk: {
      lines: [
        ['SYSTEM', 'You start writing the next ticket: "Button v2: even better".'],
        ['BA', 'Just going to refine the backlog while I wait...'],
      ],
      after: { type: 'startCutscene', kind: 'time' },
    },
  }),
  baNight: officeScene({
    map: OFFICE_FLOOR_EMPTY,
    phase: 'Release Night',
    objective: 'Talk to LEAD, then check the ACs in prod from MY DESK',
    intro: '23:45. The office is empty. LEAD is deploying.',
    spots: BA_EVENING_SPOTS,
    spawn: BA_SPAWN,
    deskRect: BA_DESK,
    speaker: 'BA',
    extraNpcs: [],
    key: 'lead',
    lines: [
      ['LEAD', 'Deployed. Pipelines green.'],
      ['BA', 'I will check both ACs in prod.'],
      ['PO', '(from the hot desk) Is it good? Is it really good?'],
    ],
    after: { type: 'setFlag', key: 'baLeadDeployed', value: true },
    desk: function (state) {
      if (!state.flags.baLeadDeployed) return { lines: [['BA', 'I should check with LEAD first.']] };
      return {
        lines: [
          ['SYSTEM', 'Opening production...'],
          ['BA', 'Green means the AC passes. Red means a bug. Avoid the red.'],
        ],
        after: { type: 'gotoScene', scene: 'baCheck' },
      };
    },
  }),
  baCheck: {
    phase: 'Prod Check',
    objective: 'Check ' + WHK_TARGET + ' working features without triggering ' + WHK_STRIKES + ' bugs',
    controls: 'WASD Move | E Check nearby features',
    intro: 'Working features show up in green. Bugs in red. Do not touch the red.',
    mini: 'whack',
    winLines: [
      ['SYSTEM', 'Prod health check: ALL GREEN. Both ACs pass.'],
      ['PO', 'It is good! It is really good!'],
      ['BA', 'Told you I would raise a ticket.'],
      ['LEAD', 'It is 1am. I am going home.'],
    ],
  },
  baComplete: {
    phase: 'Day Done!',
    objective: 'Celebrate',
    placeholder: true,
    complete: true,
    controls: 'E Play Again',
    intro: 'Ticket raised, shaped and amended. You went home on time. LEAD and PO have the release.',
  },

  // ---------------------------------------------------------------- SCRUM MASTER FINALE
  smStart: {
    phase: 'The Next Day',
    objective: 'Pizza time',
    placeholder: true,
    controls: 'E Continue',
    intro: 'Yesterday was your non-working day. You missed everything. Apparently the button is in prod. To say well done, you have ordered pizza to Meeting Room 3. Now you just need to tell everyone.',
  },
  smParty: partyScene(),
  smComplete: {
    phase: 'Thank You!',
    objective: 'Roll credits',
    placeholder: true,
    complete: true,
    controls: 'E Play Again',
    intro: 'One button. Five roles. Countless meetings. Thank you for playing Ticket To Prod, and thank you to every DEV, LEAD, QA, PO, BA and SM who has ever shipped something small that took far too long. See you at the retro.',
  },
};

var PARTY_PEOPLE = ['dev', 'lead', 'qa', 'po', 'ba'];

var PARTY_INVITES = {
  dev: [['SM', 'Pizza in Meeting Room 3. To celebrate the release.'], ['DEV', 'Is it a meeting? Do I need to bring my laptop?'], ['SM', 'It is pizza.'], ['DEV', 'I will bring my laptop.']],
  lead: [['SM', 'Pizza party in Meeting Room 3!'], ['LEAD', 'Is there an agenda?'], ['SM', 'Eating.'], ['LEAD', 'Fine. I will time-box it.']],
  qa: [['SM', 'Pizza in Meeting Room 3, for the release.'], ['QA', 'Has anyone verified the pizza?'], ['SM', 'It is pizza.'], ['QA', 'I will be the judge of that.']],
  po: [['SM', 'Pizza in Meeting Room 3!'], ['PO', 'Oh lovely. Can it be done by Friday?'], ['SM', 'It is already here.'], ['PO', 'Ahead of schedule! A first.']],
  ba: [['SM', 'Pizza in Meeting Room 3, for the release.'], ['BA', 'Is there a ticket for the pizza?'], ['SM', 'No.'], ['BA', 'I will raise one on the way.']],
};

var PARTY_TALK = {
  dev: ['So... pizza.', 'Did you see the build went green? Yeah. Me too.', 'This crust has more layers than our architecture.', 'I would say this is a 3 pointer. Maybe a 5.'],
  lead: ['Good pizza. Could be refactored into smaller slices.', 'So... any plans for the weekend? I am reviewing PRs.', 'Did you have a nice day off? We had a release. It was fine. Mostly.', 'Have you considered pineapple as an edge case?'],
  qa: ['I found a bug in the pepperoni distribution.', 'Nice weather. For a deployment.', 'I tested three slices. All passed. Raising a ticket for the fourth.', 'So... how long have you been a scrum master? Ha. Ha.'],
  po: ['This is great. Great. Really great. So... great.', 'Next sprint I would love a party with two buttons.', 'Do you think the stakeholders would like pizza? I will add it to the roadmap.', 'Mmm. Value. Delivered.'],
  ba: ['I have written acceptance criteria for this pizza.', 'So. Pizza. Do you... like pizza?', 'Given I am hungry, when I eat pizza, then I am less hungry.', 'Just one small change: could it have been a curry?'],
};

function partyCount(state) {
  return PARTY_PEOPLE.filter(function (id) {
    return state.flags['inv_' + id];
  }).length;
}

// Scrum Master finale: invite each person at their desk, they then turn up in Meeting Room 3
function partyScene() {
  var npcs = [];
  Object.keys(PARTY_DESK_SPOTS).forEach(function (id) {
    var d = PARTY_DESK_SPOTS[id];
    var r = PARTY_ROOM_SPOTS[id];
    npcs.push({
      id: id,
      label: d.label,
      x: d.x,
      y: d.y,
      hidden: function (state) {
        return !!state.flags['inv_' + id];
      },
      talk: function () {
        return { lines: PARTY_INVITES[id], after: { type: 'setFlag', key: 'inv_' + id, value: true } };
      },
    });
    npcs.push({
      id: id + 'Party',
      label: r.label,
      x: r.x,
      y: r.y,
      hidden: function (state) {
        return !state.flags['inv_' + id];
      },
      talk: function (state) {
        return cycleLine(state, id + 'Party', id.toUpperCase(), PARTY_TALK[id]);
      },
    });
  });

  return {
    phase: 'Pizza Party',
    objective: 'Invite everyone to Meeting Room 3, then eat pizza (E at table)',
    controls: 'WASD Move | E Interact',
    intro: 'Go round the office and tell everyone about the pizza.',
    map: OFFICE_FLOOR_PARTY,
    spawn: SM_SPAWN,
    npcs: npcs,
    deskRect: PARTY_TABLE,
    desk: function (state) {
      var left = PARTY_PEOPLE.length - partyCount(state);
      if (left > 0) {
        return { lines: [['SM', 'Mmm, pizza. But ' + left + (left === 1 ? ' person has' : ' people have') + ' not been invited yet. That would be awkward.']] };
      }
      return {
        lines: [
          ['SYSTEM', 'You take a slice. It is cold. It is perfect.'],
          ['SM', 'Thanks, everyone. Genuinely. Great release.'],
          ['DEV', '...'],
          ['LEAD', '...'],
          ['SM', 'Right. Retro is at 2. Bring your feelings.'],
        ],
        after: { type: 'gotoScene', scene: 'smComplete' },
      };
    },
  };
}
