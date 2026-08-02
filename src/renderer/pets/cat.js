const PALETTE = {
  '.': null,
  o: '#4a3b35',
  w: '#fff8f0',
  p: '#ffb7c5',
  k: '#2b2320',
  r: '#ff8f8f',
  b: '#8ecae6',
};

const base = [
  '.....oo..oo.....',
  '...oooo..oooo...',
  '..oooooooooooo..',
  '.oooooooooooooo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwkkwwwwkkwwo.',
  '.owwkkwwwwkkwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwppwwwwppwwo.',
  '.owwwwwwppwwwwo.',
  '..oowwwwwwwwoo..',
  '..oooooooooooo..',
  '..owwwwwwwwwwo..',
  '..oowwwwwwwwoo..',
];

const closedEyes = [
  ...base.slice(0, 7),
  '.owwkwwwwwwkwwo.',
  '.owwkwwwwwwkwwo.',
  ...base.slice(9),
];

const smile = [
  ...base.slice(0, 12),
  '..oowwwkkwwwoo..',
  ...base.slice(13),
];

const frown = [
  ...base.slice(0, 12),
  '..oowwwkwwwwoo..',
  ...base.slice(13),
];

const talkA = smile;
const talkB = base;
const sleep = closedEyes;
const drag = frown;

const walkB = [
  ...base.slice(0, 13),
  '..owwwwwwwwwwo..',
  '...owwwwwwwwo...',
  '...oowwwwwwoo...',
];

const happy = [
  ...base.slice(0, 7),
  '.oww.wwwwww.ww o.'.replace(/ /g, ''),
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwppwwwwppwwo.',
  '.owwwwwwppwwwwo.',
  '..oowwwkkwwwoo..',
  '..oooooooooooo..',
  '..owwwwwwwwwwo..',
  '..oowwwwwwwwoo..',
];

const catDef = {
  id: 'cat',
  name: '咪咪',
  type: 'pixel',
  size: { w: 16, h: 16 },
  palette: PALETTE,
  frames: {
    idle: [base, base, base, base],
    blink: [closedEyes],
    happy: [happy],
    sad: [frown],
    sleep: [sleep],
    eat: [talkA, talkB],
    talk: [talkA, talkB],
    drag: [drag],
    walk: [base, walkB],
  },
  animMeta: {
    idle: { loop: true, fps: 4 },
    blink: { loop: false, fps: 2 },
    happy: { loop: true, fps: 6 },
    sad: { loop: true, fps: 3 },
    sleep: { loop: true, fps: 2 },
    eat: { loop: true, fps: 4 },
    talk: { loop: true, fps: 5 },
    drag: { loop: true, fps: 4 },
    walk: { loop: true, fps: 6 },
  },
  baseStats: { hunger: 80, mood: 80, clean: 80, health: 90, affection: 0 },
};

if (typeof module !== 'undefined' && module.exports) module.exports = catDef;
if (typeof window !== 'undefined') window.__catDef = catDef;
