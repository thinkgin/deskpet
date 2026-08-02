const Engine = window.PixelEngineModule.PixelEngine;
const cat = window.__catDef;
const pc = window.__pixelCompose;

const canvas = document.getElementById('pet');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');
const actionsBox = document.getElementById('actions');
const stage = document.getElementById('stage');

const pets = { cat };

let state = null;
let settings = null;
let engine = null;
let currentPetId = 'cat';
let petScale = 5;
let stats = { hunger: 80, mood: 80, clean: 80, health: 90, affection: 0 };
let affectionTotal = 0;

let lastTick = performance.now();
let dragging = false;
let dragStart = null;
let dragPointerId = null;
let dragMoved = false;
let hovered = false;
let actionOpen = false;
let bubbleTimer = null;
let stateTick = 0;
let lastHint = 0;

const DECAY_PER_HOUR = {
  hunger: 3.2,
  clean: 2.6,
  mood: 2.0,
  health: 0.6,
};

const SOUNDS = {
  meow: makeMeow,
  eat: makeEat,
  play: makePlay,
  splash: makeSplash,
  pop: makePop,
};

function makeMeow() {
  playTone(540, 0.22, 'sine', 0.5);
  playTone(760, 0.26, 'sine', 0.45, 0.08);
}
function makeEat() {
  playTone(320, 0.09, 'triangle', 0.5);
  playTone(300, 0.09, 'triangle', 0.5, 0.1);
}
function makePlay() {
  playTone(880, 0.1, 'sine', 0.5);
  playTone(1180, 0.1, 'sine', 0.5, 0.09);
  playTone(980, 0.12, 'sine', 0.5, 0.18);
}
function makeSplash() {
  playTone(500, 0.12, 'triangle', 0.4);
  playTone(400, 0.12, 'triangle', 0.4, 0.1);
  playTone(300, 0.2, 'triangle', 0.4, 0.2);
}
function makePop() {
  playTone(1200, 0.06, 'sine', 0.4);
}

let audioCtx = null;
function playTone(freq, dur, type, vol, delay = 0) {
  if (settings && !settings.soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) {
    // ignore
  }
}

function say(text, ms = 2600) {
  bubbleText.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

function hideActions() {
  actionOpen = false;
  actionsBox.classList.remove('show');
  window.api.setClickThrough(true);
}

function showActions() {
  actionOpen = true;
  actionsBox.classList.add('show');
  window.api.setClickThrough(false);
  // 菜单在顶部，隐藏气泡避免两者重叠
  bubble.classList.remove('show');
  clearTimeout(bubbleTimer);
}

const cuteDialogues = [
  '喵~主人来了呀，我正躺在阳光下晒太阳呢~',
  '唔…你又来啦，我的小可爱~',
  '喵呜，想抱抱吗？我好闹呢喵~',
  '主人桌上好热啊，下来陪我一下嘛~',
  '喵！你的眼里有星星哦，好漂亮~',
  '躁动的尾气！今天心情特别好呐~',
  '你干嘛呀，戳来戳去的，想把我拆了吗~',
  '呼呼，想知道我最想说的话吗？当然是想你啦！',
  '最近天气真好，要不要一起出去走走~',
  '喵~你的手好暖，好想跟你待一起~',
];

function tapPet() {
  engine.play('blink');
  playS('meow');
  say(cuteDialogues[Math.floor(Math.random() * cuteDialogues.length)]);
  setTimeout(() => engine.play('idle'), 900);
}

function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function moodText() {
  if (stats.health < 25) return '健康';
  const avg = (stats.hunger + stats.mood + stats.clean) / 3;
  if (avg > 75) return '开心';
  if (avg > 50) return '还行';
  if (avg > 25) return '有点失落';
  return '需要关注';
}

async function loadAll() {
  state = await window.api.loadState();
  settings = await window.api.loadSettings();
  currentPetId = settings.petId || 'cat';
  petScale = Math.min(Math.max(Number(settings.petScale) || 5, 3), 12);
  stats = { ...stats, ...(state.stats || {}) };
  affectionTotal = state.affectionTotal || 0;
  // 注册自定义形象到 pets 注册表（custom:0 ~ custom:5）
  if (Array.isArray(settings.customPets)) {
    settings.customPets.forEach((cp, i) => {
      if (cp) cp = pc.migrateCustom(cp);
      if (cp && cp.base) {
        pets['custom:' + i] = pc.buildPetDef({
          id: 'custom:' + i,
          name: cp.name || ('自定义' + (i + 1)),
          palette: cp.palette,
          base: cp.base,
          parts: cp.parts,
        });
      }
    });
  }
  switchPet(currentPetId);
  applyDecay(state.lastSavedAt || Date.now());
  resizeWindow();
}

function resizeWindow() {
  const def = pets[currentPetId] || cat;
  const s = def.size || { w: 16, h: 16 };
  const w = Math.max(s.w * petScale + 40, 120);
  const h = Math.max(s.h * petScale + 60, 110);
  window.api.setWindowSize(w, h);
}

function applyDecay(since) {
  const hours = Math.min((Date.now() - since) / 3600000, 48);
  stats.hunger = clamp(stats.hunger - DECAY_PER_HOUR.hunger * hours);
  stats.clean = clamp(stats.clean - DECAY_PER_HOUR.clean * hours);
  stats.mood = clamp(stats.mood - DECAY_PER_HOUR.mood * hours);
  stats.health = clamp(stats.health - DECAY_PER_HOUR.health * hours);
  healthFromOthers();
}

function healthFromOthers() {
  const low = (stats.hunger < 25 ? 20 : 0) + (stats.clean < 25 ? 10 : 0) + (stats.mood < 25 ? 15 : 0);
  stats.health = clamp(stats.health + (60 - low) * 0.02 - low * 0.05);
}

function switchPet(id) {
  currentPetId = id;
  const def = pets[id] || cat;
  // 自定义形象可能使用不同名字，同步到当前宠物名
  if (id !== 'cat' && def.name) {
    // 宠物名在聊天/问候中使用 settings.petName，这里仅本地展示用
  }
  engine = new Engine(canvas, def, petScale);
  engine.play('idle');
}

function persist() {
  window.api.saveState({
    stats,
    affectionTotal,
    lastSavedAt: Date.now(),
    todayGreeted: state ? state.todayGreeted : '',
  });
}

async function runGreeting() {
  const today = new Date().toDateString();
  const need = state.todayGreeted !== today;
  const { greeting, festival } = await window.api.getGreeting();
  if (festival && need) {
    say(festival, 4000);
    window.api.notify('桌面宠物·陪伴', festival);
  } else if (need) {
    say(greeting, 3200);
  }
  if (need) {
    state.todayGreeted = today;
    persist();
  }
}

function doAction(act) {
  hideActions();
  const before = { ...stats };
  switch (act) {
    case 'feed': {
      stats.hunger = clamp(stats.hunger + 30);
      stats.mood = clamp(stats.mood + 4);
      stats.affection = clamp(stats.affection + 2);
      affectionTotal += 2;
      engine.play('eat');
      playS('eat');
      say(stats.hunger > 90 ? '喵呜~吃撑啦，肚子圆滚滚的！' : '呜喵~好香！主人最好啦！');
      setTimeout(() => engine.play('idle'), 1600);
      break;
    }
    case 'play': {
      stats.mood = clamp(stats.mood + 22);
      stats.hunger = clamp(stats.hunger - 4);
      stats.affection = clamp(stats.affection + 4);
      affectionTotal += 4;
      engine.play('happy');
      playS('play');
      say('喵喵！好开心！再陪我玩一会儿嘛~');
      setTimeout(() => engine.play('idle'), 1800);
      break;
    }
    case 'bath': {
      stats.clean = clamp(stats.clean + 30);
      stats.mood = clamp(stats.mood - 2);
      stats.affection = clamp(stats.affection + 2);
      affectionTotal += 2;
      engine.play('sad');
      playS('splash');
      say('呜……毛都湿了，但是香香的了！');
      setTimeout(() => engine.play('idle'), 1800);
      break;
    }
    case 'poke': {
      stats.mood = clamp(stats.mood + 3);
      stats.affection = clamp(stats.affection + 1);
      affectionTotal += 1;
      engine.play('blink');
      playS('meow');
      say('喵！主人戳我啦~');
      setTimeout(() => engine.play('idle'), 900);
      break;
    }
    case 'chat': {
      window.api.toggleChat();
      break;
    }
    case 'appearance': {
      window.api.openAppearance();
      break;
    }
    case 'settings': {
      window.api.openSettings();
      break;
    }
  }
  if (JSON.stringify(before) !== JSON.stringify(stats)) persist();
}

function playS(name) {
  if (!settings || settings.soundOn) {
    const f = SOUNDS[name];
    if (f) f();
  }
}

function doWalk() {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const dist = 30 + Math.random() * 60;
  engine.facing = dir;
  engine.play('walk');
  const start = performance.now();
  const step = () => {
    const dt = (performance.now() - start) / 1000;
    if (dt > 0.9 || dragging) {
      engine.facing = 1;
      engine.play('idle');
      return;
    }
    window.api.movePet(dir * 2, 0);
    requestAnimationFrame(step);
  };
  step();
}

function update(dt) {
  engine.update(dt);
  engine.draw();
}

// 气泡锚定在宠物头顶：窗口在 DPI 缩放下可能被系统微调尺寸，canvas 是底部对齐的，
// 若只靠 CSS top:4px 定位，窗口变高时气泡会与宠物分离；这里每帧跟随画布位置。
function positionBubble() {
  const pad = 8;
  const sr = stage.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  const bh = bubble.offsetHeight || 34;
  let left = cr.left - sr.left + cr.width / 2;
  let top = cr.top - sr.top - bh - pad;
  if (top < 2) top = 2;
  bubble.style.left = left + 'px';
  bubble.style.top = top + 'px';
}

function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;

  stateTick += dt;
  if (stateTick >= 60) {
    stateTick = 0;
    stats.hunger = clamp(stats.hunger - DECAY_PER_HOUR.hunger / 60);
    stats.clean = clamp(stats.clean - DECAY_PER_HOUR.clean / 60);
    stats.mood = clamp(stats.mood - DECAY_PER_HOUR.mood / 60);
    stats.health = clamp(stats.health - DECAY_PER_HOUR.health / 60);
    healthFromOthers();
    persist();
  }

  if (!dragging && !actionOpen && settings && settings.autoWalk) {
    if (now - lastHint > 4000 && Math.random() < 0.02) {
      lastHint = now;
      if (stats.hunger < 30) {
        say('主人……我肚子咕咕叫了~');
      } else if (stats.clean < 30) {
        say('身上有点脏脏的，想洗澡澡~');
      } else if (Math.random() < 0.4) {
        doWalk();
      }
    }
  }

  update(dt);
  positionBubble();
  requestAnimationFrame(tick);
}

window.addEventListener('pointerleave', () => {
  if (!dragging) {
    window.api.setClickThrough(true);
    if (actionOpen) hideActions();
  }
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  dragPointerId = e.pointerId;
  dragMoved = false;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
  window.api.setClickThrough(false);
  dragStart = { sx: e.screenX, sy: e.screenY };
  // 由主进程用 screen 光标 DIP 坐标驱动窗口跟随，避免渲染层坐标/缩放漂移
  window.api.startPetDrag();
});

// 判断鼠标是否落在宠物的不透明像素上（考虑镜像翻转后的实际绘制位置）
function isPixelInteractive(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return false;
  try {
    const d = canvas.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return d[3] > 0;
  } catch (e) {
    return true;
  }
}

// 根据鼠标位置切换点击穿透：宠物像素或操作菜单上可交互，其余穿透到桌面
function updateClickThrough(clientX, clientY) {
  let interactive = isPixelInteractive(clientX, clientY);
  if (!interactive && actionOpen) {
    const r = actionsBox.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) interactive = true;
  }
  window.api.setClickThrough(!interactive);
}

window.addEventListener('pointermove', (e) => {
  if (dragging && dragStart) {
    const dx = e.screenX - dragStart.sx;
    const dy = e.screenY - dragStart.sy;
    if (Math.abs(dx) + Math.abs(dy) >= 4) dragMoved = true;
  } else if (!dragging) {
    updateClickThrough(e.clientX, e.clientY);
  }
});

window.addEventListener('pointerup', (e) => {
  endDrag();
});

window.addEventListener('pointercancel', () => {
  endDrag();
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  canvas.style.cursor = 'grab';
  const wasClick = !dragMoved;
  if (dragPointerId !== null && canvas.hasPointerCapture(dragPointerId)) canvas.releasePointerCapture(dragPointerId);
  if (wasClick) tapPet();
  dragStart = null;
  dragPointerId = null;
  window.api.endPetDrag();
  if (!wasClick) window.api.setClickThrough(true);
}

// 主进程兜底：光标 1 秒未移动判定拖拽结束（防止 pointerup 丢失导致拖拽状态卡死）
window.api.onPetDragEnd(() => {
  if (!dragging) return;
  dragging = false;
  canvas.style.cursor = 'grab';
  if (dragPointerId !== null && canvas.hasPointerCapture(dragPointerId)) canvas.releasePointerCapture(dragPointerId);
  dragStart = null;
  dragPointerId = null;
  window.api.setClickThrough(true);
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (actionOpen) hideActions();
  else showActions();
});

document.addEventListener('pointerdown', (e) => {
  if (actionOpen && !e.target.closest('#actions')) hideActions();
});

actionsBox.addEventListener('click', (e) => {
  const btn = e.target.closest('.act');
  if (!btn) return;
  doAction(btn.dataset.act);
});

window.api.onTrayAction((action) => {
  if (action === 'feed' || action === 'play' || action === 'bath') doAction(action);
  if (action === 'chat') window.api.notify('桌面宠物', '点击宠物右键菜单里的聊天，或右下角托盘图标即可开始聊天喵~');
});

window.api.onSettingsChanged(() => {
  window.location.reload();
});

(async () => {
  await loadAll();
  runGreeting();
  tick();
})();
