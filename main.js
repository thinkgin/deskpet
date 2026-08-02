const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const userDataDir = app.getPath('userData');
const stateFile = path.join(userDataDir, 'state.json');
const settingsFile = path.join(userDataDir, 'settings.json');

let petWin = null;
let chatWin = null;
let settingsWin = null;
let appearanceWin = null;
let tray = null;
let isQuitting = false;
let petDrag = null; // 主进程驱动的拖拽状态：{ interval, startCursor, startBounds, lastCursor, idleTicks }

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('load error', file, e);
  }
  return fallback;
}

function saveJSON(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('save error', file, e);
  }
}

const defaultSettings = {
  petId: 'cat',
  petName: '咪咪',
  soundOn: true,
  autoWalk: true,
  petScale: 5,
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-3.5-turbo',
  systemPrompt: '你是一只住在电脑桌面上、名叫{name}的小猫宠物，性格粘人可爱，喜欢陪主人聊天。用简短、温暖、口语化的中文回复，经常关心主人。',
  // 自定义形象：最多 6 个槽位（index 0~5），每个为 null 或自定义形象数据
  customPets: [null, null, null, null, null, null],
  // AI 对话 Provider 配置（多套可保存的预设；activeProviderId='custom' 或 '' 时回落用 aiBaseUrl/aiApiKey/aiModel）
  providers: [],
  activeProviderId: '',
  // 定时关机配置
  shutdownConfig: { mode: 'off', minutes: 60, time: '22:00', shutdownAt: 0 },
};

const defaultState = {
  stats: { hunger: 80, mood: 80, clean: 80, health: 90, affection: 0 },
  lastSavedAt: Date.now(),
  todayGreeted: '',
  affectionTotal: 0,
  lastFeedAt: 0,
  lastPlayAt: 0,
  lastBathAt: 0,
};

function getSettings() {
  return { ...defaultSettings, ...loadJSON(settingsFile, {}) };
}
function getState() {
  return { ...defaultState, ...loadJSON(stateFile, {}) };
}

// ---------- 开机启动（Windows） ----------
function applyAutoStart(enabled) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    openAsHidden: true,
    // 指定可执行文件，防止多版本串位
    path: app.getPath('exe'),
    args: ['--hidden'],
  });
}

function getAutoStart() {
  if (process.platform !== 'win32') return false;
  try {
    return app.getLoginItemSettings({ path: app.getPath('exe') }).openAtLogin;
  } catch (e) {
    return false;
  }
}

// ---------- 定时关机 ----------
let shutdownTimer = null;
let shuttingDown = false;

function parseTimeToNext(hm) {
  const [h, m] = String(hm || '22:00').split(':').map(Number);
  const now = new Date();
  const target = new Date(now); // 同一天
  target.setHours(h || 22, m || 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1); // 已过则明天
  return target.getTime();
}

function computeShutdownAt(cfg) {
  if (!cfg || cfg.mode === 'off') return 0;
  if (cfg.mode === 'countdown') {
    return Date.now() + (Math.max(1, Number(cfg.minutes) || 60)) * 60 * 1000;
  }
  return parseTimeToNext(cfg.time);
}

function triggerShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // 执行系统关机；传 3 秒缓冲，/f 强制，/t 秒
  const cmd = process.platform === 'win32' ? 'shutdown' : 'shutdown';
  execFile(cmd, ['/s', '/f', '/t', '3'], (err) => {
    if (err) console.error('shutdown exec error', err);
  });
}

function scheduleShutdownSoon(delayMs) {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  shutdownTimer = setTimeout(() => {
    shutdownTimer = null;
    triggerShutdown();
  }, Math.max(0, delayMs));
}

// 由配置启动定时关机（应用启动时也调用，保证重启后仍生效）
function startShutdownFromConfig() {
  const s = getSettings();
  const cfg = (s.shutdownConfig && s.shutdownConfig.mode ? s.shutdownConfig : defaultSettings.shutdownConfig);
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  if (!cfg || cfg.mode === 'off') return;
  const delay = cfgModeNext(cfg) - Date.now();
  scheduleShutdownSoon(delay);
}

function cfgModeNext(cfg) {
  if (cfg.mode === 'countdown') return computeShutdownAt(cfg);
  return parseTimeToNext(cfg.time);
}

function getPetWindowSize() {
  const scale = Math.min(Math.max(Number(getSettings().petScale) || 5, 3), 12);
  const w = Math.max(16 * scale + 40, 120);
  const h = Math.max(16 * scale + 60, 110);
  return { width: w, height: h, scale };
}

// 期望的宠物窗口尺寸（缓存，DPI 膨胀下窗口实际尺寸会漂移，但边界钳制一律用此固定值）
let petWinSize = null;
function refreshPetWinSize() {
  petWinSize = getPetWindowSize();
  return petWinSize;
}

function createPetWindow() {
  const { width, height } = refreshPetWinSize();
  petWin = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWin.setAlwaysOnTop(true, 'screen-saver');
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 让透明窗口的空白区域点击穿透，避免挡住桌面内容
  petWin.setIgnoreMouseEvents(true, { forward: true });
  if (process.env.NODE_ENV === 'development') {
    petWin.webContents.on('console-message', (e, level, message) => {
      console.log('[pet]', message);
    });
  }
  petWin.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  petWin.on('closed', () => {
    petWin = null;
    if (!isQuitting) createPetWindow();
  });
}

function createChatWindow() {
  chatWin = new BrowserWindow({
    width: 360,
    height: 480,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  chatWin.loadFile(path.join(__dirname, 'src', 'renderer', 'chat.html'));
  if (process.env.NODE_ENV === 'development') {
    chatWin.webContents.on('console-message', (e, level, message) => {
      console.log('[chat]', message);
    });
  }
  chatWin.on('closed', () => (chatWin = null));
}

function createSettingsWindow() {
  settingsWin = new BrowserWindow({
    width: 420,
    height: 540,
    frame: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, 'src', 'renderer', 'settings.html'));
  if (process.env.NODE_ENV === 'development') {
    settingsWin.webContents.on('console-message', (e, level, message) => {
      console.log('[settings]', message);
    });
  }
  settingsWin.on('closed', () => (settingsWin = null));
}

function createAppearanceWindow() {
  appearanceWin = new BrowserWindow({
    width: 760,
    height: 620,
    frame: true,
    resizable: true,
    minWidth: 720,
    minHeight: 560,
    show: false,
    title: '形象面板',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  appearanceWin.loadFile(path.join(__dirname, 'src', 'renderer', 'appearance.html'));
  if (process.env.NODE_ENV === 'development') {
    appearanceWin.webContents.on('console-message', (e, level, message) => {
      console.log('[appearance]', message);
    });
  }
  appearanceWin.on('closed', () => (appearanceWin = null));
}

function toggleAppearance() {
  if (!appearanceWin) createAppearanceWindow();
  if (appearanceWin.isVisible()) {
    appearanceWin.hide();
  } else {
    appearanceWin.show();
    appearanceWin.focus();
  }
}

function toggleChat() {
  if (!chatWin) createChatWindow();
  if (chatWin.isVisible()) {
    chatWin.hide();
  } else {
    // 让聊天窗口出现在宠物旁边（避免和宠物离得太远）
    const wa = screen.getPrimaryDisplay().workArea;
    const cw = chatWin.getBounds();
    let x = wa.x + wa.width - cw.width - 20;
    let y = wa.y + wa.height - cw.height - 60;
    if (petWin) {
      const pb = petWin.getBounds();
      if (pb.x + pb.width + 12 + cw.width <= wa.x + wa.width) {
        x = pb.x + pb.width + 12;
      } else {
        x = pb.x - cw.width - 12;
      }
      y = pb.y - 30;
    }
    y = Math.max(wa.y + 10, Math.min(y, wa.y + wa.height - cw.height - 10));
    chatWin.setPosition(x, y);
    chatWin.show();
    chatWin.focus();
    chatWin.webContents.send('chat:open');
  }
}

function toggleSettings() {
  if (!settingsWin) createSettingsWindow();
  if (settingsWin.isVisible()) {
    settingsWin.hide();
  } else {
    settingsWin.show();
    settingsWin.focus();
  }
}

function sendTray(action) {
  if (action === 'settings') {
    toggleSettings();
    return;
  }
  if (action === 'chat') {
    toggleChat();
    return;
  }
  if (petWin && petWin.webContents) petWin.webContents.send('tray:action', action);
}

function createTray() {
  let icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.ico'));
  if (icon.isEmpty()) icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  icon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('桌面宠物·陪伴');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '聊天', click: () => sendTray('chat') },
      { label: '喂食', click: () => sendTray('feed') },
      { label: '玩耍', click: () => sendTray('play') },
      { label: '洗澡', click: () => sendTray('bath') },
      { type: 'separator' },
      { label: '设置', click: () => sendTray('settings') },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit(); } },
    ])
  );
}

async function chatAI(messages) {
  const s = getSettings();
  // 解析当前生效的对话 Provider：优先 activeProviderId，其次 legacy 字段
  const active = (s.providers || []).find((p) => p && p.id === s.activeProviderId);
  const useProviders = !!(active && active.baseUrl && active.apiKey && active.model);
  const hasLegacy = !!(s.aiApiKey && s.aiBaseUrl && s.aiModel);
  if (useProviders || hasLegacy) {
    try {
      const baseUrl = useProviders ? active.baseUrl.replace(/\/$/, '') : s.aiBaseUrl.replace(/\/$/, '');
      const apiKey = useProviders ? active.apiKey : s.aiApiKey;
      const model = useProviders ? active.model : s.aiModel;
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: s.systemPrompt.replace('{name}', s.petName) }, ...messages.slice(-20)],
          temperature: 0.8,
        }),
      });
      const data = await res.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
      return localChat(messages);
    } catch (e) {
      console.error('ai error', e);
      return localChat(messages);
    }
  }
  return localChat(messages);
}

function localChat(messages) {
  const last = messages.filter((m) => m.role === 'user').pop();
  const text = last ? last.content : '';
  if (/饿|吃|饭|喂/.test(text)) return '喵~主人最好了！我正好有点饿呢，想吃饭饭~';
  if (/睡|困|休息/.test(text)) return '呼噜噜……主人也早点休息呀，我陪着你~';
  if (/累|辛苦|难过|不开心/.test(text)) return '主人不要难过，我摸摸你。我们都在努力，慢慢来呀~';
  if (/早安|早上好|晚安|你好|hi|hello/i.test(text)) return '喵喵！主人！我在呢，一直陪着你哦~';
  if (/喜欢|爱/.test(text)) return '喵！我也最喜欢主人了！蹭蹭~';
  if (/天气|今天/.test(text)) return '喵~主人记得看天气预报哦，出去要带伞带外套~';
  return '喵~主人说的我都有在听！想吃什么、想去哪玩，我都可以陪你呀~';
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了主人，我陪着你，早点睡哦~';
  if (h < 9) return '早上好主人！新的一天也要元气满满喵~';
  if (h < 12) return '上午好~主人吃早饭了吗？记得喝水喵！';
  if (h < 14) return '中午好呀，主人记得吃午饭，休息一下~';
  if (h < 18) return '下午好主人，要不要休息一下，看看窗外呀？';
  return '晚上好~今天辛苦啦，有我陪着你哦！';
}

function getFestival() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const map = {
    '1-1': '元旦快乐！新的一年也要元气满满喵~',
    '2-14': '情人节快乐~有你陪着我就很幸福喵！',
    '3-8': '妇女节快乐！今天要好好犒劳自己呀~',
    '5-1': '劳动节快乐！记得休息，别太累啦~',
    '6-1': '儿童节快乐！今天我陪主人一起当小朋友喵~',
    '10-1': '国庆节快乐！祝我们的家越来越好喵~',
    '12-24': '平安夜快乐~平平安安最幸福！',
    '12-25': '圣诞节快乐！Merry Christmas 喵~',
    '12-31': '跨年快乐！我们一起迎接新的一年！',
  };
  return map[`${m}-${d}`] || '';
}

ipcMain.handle('state:load', () => getState());
ipcMain.handle('state:save', (e, data) => {
  const cur = getState();
  const merged = { ...cur, ...data, stats: { ...cur.stats, ...(data.stats || {}) } };
  merged.lastSavedAt = Date.now();
  saveJSON(stateFile, merged);
  return merged;
});
ipcMain.handle('settings:load', () => getSettings());
ipcMain.handle('settings:save', (e, data) => {
  const merged = { ...getSettings(), ...data };
  saveJSON(settingsFile, merged);
  // 若尺寸变化，立即调整宠物窗口大小并重新钳制到工作区
  const { width, height } = refreshPetWinSize();
  if (petWin) {
    const b = petWin.getBounds();
    petWin.setBounds({ x: b.x, y: b.y, width, height });
    reclampPetWindow();
  }
  // 通知宠物窗口重新加载设置（应用新尺寸/名字/音效等）
  if (petWin) petWin.webContents.send('settings:changed');
  return merged;
});

// ---------- 开机启动 / 定时关机 IPC ----------
ipcMain.handle('autostart:get', () => getAutoStart());
ipcMain.handle('autostart:set', (e, enabled) => {
  applyAutoStart(enabled);
  return getAutoStart();
});

ipcMain.handle('shutdown:getStatus', () => {
  const s = getSettings();
  const cfg = (s.shutdownConfig && s.shutdownConfig.mode ? s.shutdownConfig : defaultSettings.shutdownConfig);
  const next = cfg && cfg.mode !== 'off' ? cfgModeNext(cfg) - Date.now() : null;
  return { config: cfg, ms: next, active: !!(cfg && cfg.mode !== 'off') };
});

ipcMain.handle('shutdown:schedule', (e, cfg) => {
  // cfg: { mode:'off'|'countdown'|'time', minutes?, time? }
  const s = getSettings();
  const mergedCfg = {
    mode: cfg.mode || 'off',
    minutes: cfg.mode === 'countdown' ? (Number(cfg.minutes) || 60) : (s.shutdownConfig && s.shutdownConfig.minutes),
    time: cfg.mode === 'time' ? (cfg.time || '22:00') : (s.shutdownConfig && s.shutdownConfig.time),
    shutdownAt: Date.now(),
  };
  const merged = { ...s, shutdownConfig: mergedCfg };
  saveJSON(settingsFile, merged);
  startShutdownFromConfig();
  return mergedCfg;
});

ipcMain.handle('shutdown:cancel', () => {
  const s = getSettings();
  const mergedCfg = { ...(s.shutdownConfig || defaultSettings.shutdownConfig), mode: 'off', shutdownAt: 0 };
  saveJSON(settingsFile, { ...s, shutdownConfig: mergedCfg });
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
  return mergedCfg;
});

// ---- 形象面板 IPC ----
// 读取自定义形象（customPets 数组）与当前选中形象
ipcMain.handle('appearance:get', () => {
  const s = getSettings();
  return {
    customPets: Array.isArray(s.customPets) ? s.customPets.slice(0, 6) : [null, null, null, null, null, null],
    activePetId: s.petId || 'cat',
  };
});

// 保存自定义形象：写入 customPets + 切换当前形象
ipcMain.handle('appearance:save', (e, data) => {
  const s = getSettings();
  const customPets = Array.isArray(data.customPets) ? data.customPets.slice(0, 6) : s.customPets;
  const merged = { ...s, customPets };
  if (data.activePetId) merged.petId = data.activePetId;
  if (data.petName) merged.petName = data.petName;
  saveJSON(settingsFile, merged);
  // 形象尺寸与系统小猫一致，无需改窗口尺寸，直接通知宠物窗口重新加载
  if (petWin) petWin.webContents.send('settings:changed');
  return merged;
});

ipcMain.on('appearance:open', () => toggleAppearance());
ipcMain.on('appearance:close', () => {
  if (appearanceWin) appearanceWin.hide();
});
ipcMain.on('settings:open', () => toggleSettings());
ipcMain.on('settings:close', () => {
  if (settingsWin) settingsWin.hide();
});
ipcMain.on('chat:send', (e, messages) => chatAI(messages));
ipcMain.handle('greeting:get', () => ({ greeting: getGreeting(), festival: getFestival() }));
// 计算宠物窗口应停留的边界（DIP 坐标）。
// 用固定期望尺寸 petWinSize：非 100% DPI 下透明窗口实际尺寸会被系统反复取整膨胀，
// 若用 b.width 参与计算，边界会越收越紧形成"空气墙"。
// refPoint 为显示器的判定参照（拖拽时传光标位置），保证跨屏拖动时宠物跟随光标所在屏幕。
function clampToWorkArea(x, y, width, height, refPoint) {
  const ref = refPoint || { x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) };
  const display = screen.getDisplayNearestPoint(ref);
  const wa = display.workArea;
  const nx = Math.min(Math.max(x, wa.x), wa.x + wa.width - width);
  const ny = Math.min(Math.max(y, wa.y), wa.y + wa.height - height);
  return { x: nx, y: ny, display };
}

function movePetWindowTo(x, y, refPoint) {
  if (!petWin) return;
  const { width, height } = petWinSize || refreshPetWinSize();
  const { x: nx, y: ny } = clampToWorkArea(x, y, width, height, refPoint);
  petWin.setBounds({ x: nx, y: ny, width, height });
}

// 将宠物窗口重新钳制进当前所在显示器的工作区（缩放、改尺寸后调用，防止窗口沉入任务栏/越界）
function reclampPetWindow() {
  if (!petWin) return;
  const { width, height } = petWinSize || refreshPetWinSize();
  const b = petWin.getBounds();
  const { x: nx, y: ny } = clampToWorkArea(b.x, b.y, width, height);
  if (nx !== b.x || ny !== b.y || width !== b.width || height !== b.height) {
    petWin.setBounds({ x: nx, y: ny, width, height });
  }
}

ipcMain.handle('pet:move', (e, { dx, dy }) => {
  if (!petWin) return;
  const b = petWin.getBounds();
  movePetWindowTo(b.x + dx, b.y + dy);
});

// 绝对坐标移动宠物窗口（拖拽用，无累积误差）
ipcMain.on('pet:moveTo', (e, { x, y }) => {
  movePetWindowTo(x, y);
});
// ---- 主进程驱动拖拽 ----
// 用 screen.getCursorScreenPoint()（DIP）和 getBounds()（DIP）在同一个坐标系内跟随光标，
// 彻底消除渲染进程 e.screenX 在缩放显示器下的坐标换算误差与 IPC 竞态导致的漂移/空气墙。
function startPetDrag() {
  if (petDrag) return;
  if (!petWin) return;
  const startCursor = screen.getCursorScreenPoint();
  const startBounds = petWin.getBounds();
  petDrag = { startCursor, startBounds, lastCursor: startCursor, idleTicks: 0 };
  petDrag.interval = setInterval(() => {
    if (!petDrag || !petWin) {
      endPetDrag();
      return;
    }
    const cur = screen.getCursorScreenPoint();
    if (cur.x === petDrag.lastCursor.x && cur.y === petDrag.lastCursor.y) {
      petDrag.idleTicks++;
      // 光标 1 秒未移动（pointerup 可能丢失），兜底结束拖拽
      if (petDrag.idleTicks >= 100) {
        endPetDrag();
        if (petWin && petWin.webContents) petWin.webContents.send('pet:dragEnd');
        return;
      }
    } else {
      petDrag.idleTicks = 0;
      petDrag.lastCursor = cur;
    }
    movePetWindowTo(
      petDrag.startBounds.x + (cur.x - petDrag.startCursor.x),
      petDrag.startBounds.y + (cur.y - petDrag.startCursor.y),
      cur // 参照光标所在显示器：跨屏拖拽时宠物跟随进入相邻屏幕
    );
  }, 10);
}

function endPetDrag() {
  if (!petDrag) return;
  clearInterval(petDrag.interval);
  petDrag = null;
}

ipcMain.on('pet:dragStart', () => startPetDrag());
ipcMain.on('pet:dragEnd', () => endPetDrag());
// 移动聊天窗口自身（拖拽标题栏用）
ipcMain.on('chat:moveTo', (e, { x, y }) => {
  if (!chatWin) return;
  const b = chatWin.getBounds();
  const display = screen.getDisplayNearestPoint({ x, y });
  const wa = display.workArea;
  const nx = Math.min(Math.max(x, wa.x), wa.x + wa.width - b.width);
  const ny = Math.min(Math.max(y, wa.y), wa.y + wa.height - b.height);
  chatWin.setPosition(nx, ny);
});
ipcMain.handle('chat:getBounds', () => (chatWin ? chatWin.getBounds() : null));
ipcMain.handle('pet:getBounds', () => (petWin ? petWin.getBounds() : null));
// 同步读取宠物窗口位置（拖拽起点用，避免异步延迟导致拖拽初始位置错位）
ipcMain.on('pet:getBoundsSync', (e) => {
  e.returnValue = petWin ? petWin.getBounds() : null;
});

// 渲染进程主动调整宠物窗口尺寸（跟随 petScale）
ipcMain.on('pet:setWindowSize', (e, { width, height }) => {
  if (!petWin) return;
  const b = petWin.getBounds();
  petWin.setBounds({ x: b.x, y: b.y, width, height });
  reclampPetWindow();
});

// 点击穿透开关：鼠标在宠物像素上时 false（可交互），否则 true（穿透）
ipcMain.on('pet:setClickThrough', (e, flag) => {
  if (!petWin) petWin = null;
  if (petWin) petWin.setIgnoreMouseEvents(!!flag, { forward: true });
});

ipcMain.on('chat:toggle', () => toggleChat());
// 关闭聊天窗口：window.close() 对 loadFile 窗口无效，必须由主进程隐藏
ipcMain.on('chat:close', () => {
  if (chatWin) chatWin.hide();
});

const REMINDER_INTERVAL = 45 * 60 * 1000;
let reminderTimer = null;
const REMINDERS = [
  '喵~主人，该起来喝口水啦！',
  '主人工作这么久，起来伸个懒腰休息一下吧~',
  '喝点水，看看窗外，眼睛休息一会儿喵~',
  '主人，记得每隔一段时间活动活动，对身体好哦！',
];

function startReminders() {
  if (reminderTimer) return;
  reminderTimer = setInterval(() => {
    if (petWin && petWin.isVisible()) {
      const body = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
      new Notification({ title: '桌面宠物·陪伴', body, silent: false }).show();
    }
  }, REMINDER_INTERVAL);
}

ipcMain.on('notify', (e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
});

ipcMain.on('pet:close', () => {
  isQuitting = true;
  app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (petWin) {
      petWin.show();
      petWin.focus();
    }
  });

  app.whenReady().then(() => {
    createPetWindow();
    createTray();
    startReminders();
    startShutdownFromConfig();
    // 开机启动：读取已保存状态（若有）
    app.setAppUserModelId('com.cartoonwife.pet');
  });
}

app.on('window-all-closed', (e) => {
  if (!isQuitting) {
    // keep running in tray
  } else {
    app.quit();
  }
});
