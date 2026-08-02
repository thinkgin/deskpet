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
let providerWin = null;
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
  masterAddress: '主人',
  petGender: '女生',
  petBirthday: '', // YYYY-MM-DD，空则不显示岁数
  soundOn: true,
  autoWalk: true,
  petScale: 5,
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-3.5-turbo',
  systemPrompt: '你是一只住在电脑桌上、名叫{name}的小猫，性格温柔陪伴可爱，喜欢陪{address}聊天。用简短、温暖、口语化的中文回复，经常关心{address}。',
  // 自定义 AI 形象：最多 6 个槽位（index 0~5），每个为 null 或自定义形象数据
  customPets: [null, null, null, null, null, null],
  // AI 对话 Provider 配置（多套可保存的预设；activeProviderId='custom' 或 '' 时回落用 aiBaseUrl/aiApiKey/aiModel）
  providers: [],
  activeProviderId: '',
  activeModel: '',
  activeReasoningEffort: 'medium',
  // 定时关机配置
  shutdownConfig: { mode: 'off', minutes: 60, time: '22:00', shutdownAt: 0 },
};

// 热门 Provider 模板 — 1:1 复刻 opencode 提供商设置（仅预设地址/模型，不含 Key）
const OPENCODE_PRESETS = [
  // ---- 你的 opencode 网关 ----
  { name: 'KKLT · xiaohuang（gpt-5.x/grok）', baseUrl: 'https://api.kklt.lol/v1', apiType: 'openai', models: [
    { model: 'gpt-5.4', label: 'gpt-5.4' },
    { model: 'gpt-5.5', label: 'gpt-5.5' },
    { model: 'gpt-5.6-sol', label: 'gpt-5.6-sol' },
    { model: 'gpt-5.6-terra', label: 'gpt-5.6-terra' },
    { model: 'grok-4.5', label: 'grok-4.5' },
  ]},
  { name: '443 AI（gpt-5.x系列）', baseUrl: 'https://api.443.hk/v1', apiType: 'openai', models: [
    { model: 'gpt-5.4', label: 'gpt-5.4' },
    { model: 'gpt-5.5', label: 'gpt-5.5' },
    { model: 'gpt-5.6-sol', label: 'gpt-5.6-sol' },
    { model: 'gpt-5.6-terra', label: 'gpt-5.6-terra' },
    { model: 'gpt-5.6-luna', label: 'gpt-5.6-luna' },
  ]},
  { name: '443 Claude（claude-opus系列）', baseUrl: 'https://api.443.hk/v1', apiType: 'openai', models: [
    { model: 'claude-opus-4-7', label: 'claude-opus-4-7' },
    { model: 'claude-opus-4-8', label: 'claude-opus-4-8' },
  ]},
  // ---- 主流厂商 ----
  { name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', apiType: 'openai', models: [
    { model: 'gpt-4o-mini', label: 'GPT-4o-mini' },
    { model: 'gpt-4o', label: 'GPT-4o' },
    { model: 'gpt-4.1-nano', label: 'GPT-4.1-nano' },
    { model: 'o4-mini', label: 'O4-mini' },
  ]},
  { name: 'Anthropic 官方', baseUrl: 'https://api.anthropic.com/v1', apiType: 'anthropic', models: [
    { model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4' },
    { model: 'claude-opus-4-5', label: 'Claude Opus 4' },
    { model: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { model: 'claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
  ]},
  { name: 'DeepSeek 官方', baseUrl: 'https://api.deepseek.com/v1', apiType: 'openai', models: [
    { model: 'deepseek-chat', label: 'DeepSeek-V3' },
    { model: 'deepseek-reasoner', label: 'DeepSeek-R1' },
  ]},
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiType: 'openai', models: [
    { model: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4' },
    { model: 'openai/gpt-4o', label: 'GPT-4o' },
    { model: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ]},
  { name: 'xAI · Grok', baseUrl: 'https://api.x.ai/v1', apiType: 'openai', models: [
    { model: 'grok-4', label: 'grok-4' },
    { model: 'grok-4-fast', label: 'grok-4-fast' },
  ]},
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', apiType: 'openai', models: [
    { model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { model: 'qwen-2.5-32b', label: 'Qwen 2.5 32B' },
    { model: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B' },
  ]},
  { name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', apiType: 'openai', models: [
    { model: 'mistral-large-latest', label: 'Mistral Large' },
    { model: 'mistral-small-latest', label: 'Mistral Small' },
  ]},
  { name: 'Google AI · Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiType: 'openai', models: [
    { model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ]},
  { name: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', apiType: 'openai', models: [
    { model: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
    { model: 'llama3.1:8b', label: 'Llama 3.1 8B' },
  ]},
];

const defaultState = {
  stats: { hunger: 80, mood: 80, clean: 80, health: 90, affection: 0 },
  lastSavedAt: Date.now(),
  todayGreeted: '',
  affectionTotal: 0,
  lastFeedAt: 0,
  lastPlayAt: 0,
  lastBathAt: 0,
  // 成长系统：等级 + 经验
  level: 1,
  exp: 0,
};

function getGrowthDef(level, exp) {
  const lv = Math.max(1, Number(level) || 1);
  const e = Math.max(0, Number(exp) || 0);
  const expToNext = Math.floor(100 * Math.pow(1.3, lv - 1));
  // 体型系数：随等级变大，1 级为 1.0
  const scale = Number((1 + (lv - 1) * 0.02).toFixed(3));
  return { level: lv, exp: e, expToNext, scale };
}

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
let petBaseWinSize = null;
function refreshPetWinSize() {
  petBaseWinSize = getPetWindowSize();
  petWinSize = { ...petBaseWinSize };
  return petBaseWinSize;
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
    width: 460,
    height: 720,
    frame: true,
    resizable: true,
    minWidth: 400,
    minHeight: 600,
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
    width: 780,
    height: 650,
    frame: true,
    resizable: true,
    minWidth: 740,
    minHeight: 580,
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

function createProviderWindow() {
  providerWin = new BrowserWindow({
    width: 720,
    height: 760,
    frame: true,
    resizable: true,
    minWidth: 560,
    minHeight: 560,
    show: false,
    title: '提供商管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  providerWin.loadFile(path.join(__dirname, 'src', 'renderer', 'provider.html'));
  if (!app.isPackaged) {
    providerWin.webContents.on('console-message', (e, level, message) => {
      console.log('[provider]', message);
    });
  }
  providerWin.on('closed', () => (providerWin = null));
}

function toggleProvider() {
  if (!providerWin) createProviderWindow();
  if (providerWin.isVisible()) {
    providerWin.hide();
  } else {
    providerWin.show();
    providerWin.focus();
  }
}

function toggleChat() {
  if (!chatWin) createChatWindow();
  if (chatWin.isVisible()) {
    chatWin.hide();
  } else {
    // 让聊天窗口出现在宠物旁边且留出间距，绝不盖住宠物头部
    const wa = screen.getPrimaryDisplay().workArea;
    const cw = chatWin.getBounds();
    const gap = 16;
    let x = wa.x + wa.width - cw.width - 20;
    let y = wa.y + wa.height - cw.height - 60;
    if (petWin) {
      const pb = petWin.getBounds();
      // 默认放宠物右侧，顶部与宠物顶部对齐，右侧留 gap 避免压到头
      x = pb.x + pb.width + gap;
      y = pb.y;
      // 右侧放不下：改放宠物正下方（垂直错开，不覆盖）
      if (x + cw.width > wa.x + wa.width) {
        x = pb.x + (pb.width - cw.width) / 2;
        y = pb.y + pb.height + gap;
      }
    }
    x = Math.min(Math.max(x, wa.x + 10), wa.x + wa.width - cw.width - 10);
    y = Math.min(Math.max(y, wa.y + 10), wa.y + wa.height - cw.height - 10);
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

function resolveProvider(s) {
  const active = (s.providers || []).find((p) => p && p.id === s.activeProviderId);
  if (active) {
    // 优先已选模型；否则用 provider 自定义模型；再否则该 provider 第一个模型
    let model = s.activeModel;
    if (!model) {
      const m = Array.isArray(active.models) ? active.models.find((x) => x.model) : null;
      model = (m && m.model) || active.model || '';
    }
    return { active, model, effort: s.activeReasoningEffort || 'medium', legacy: false };
  }
  return { active: null, model: s.aiModel, effort: 'medium', legacy: !!(s.aiApiKey && s.aiBaseUrl && s.aiModel) };
}

async function chatAI(messages) {
  const s = getSettings();
  const { active, model, effort, legacy } = resolveProvider(s);
  const canCall = legacy || (active && active.baseUrl);
  if (canCall && model) {
    try {
      const baseUrl = legacy ? s.aiBaseUrl : (active && active.baseUrl && active.baseUrl.replace(/\/$/, ''));
      const apiKey = legacy ? s.aiApiKey : (active && active.apiKey);
      const isAnthropic = !legacy && active.apiType === 'anthropic';
      const payload = isAnthropic
        ? {
            model,
            system: buildSystemPrompt(s),
            messages: messages.slice(-20),
            max_tokens: 1024,
          }
        : {
            model,
            messages: [{ role: 'system', content: buildSystemPrompt(s) }, ...messages.slice(-20)],
            temperature: 0.8,
          };
      if (!isAnthropic && effort && effort !== 'none') payload.reasoning_effort = effort;
      const res = await fetch(`${baseUrl}${isAnthropic ? '/messages' : '/chat/completions'}`, {
        method: 'POST',
        headers: isAnthropic
          ? {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            }
          : {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (isAnthropic && Array.isArray(data.content)) {
        return data.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
      }
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
      return localChat(messages);
    } catch (e) {
      console.error('ai error', e);
      return localChat(messages);
    }
  }
  return localChat(messages);
}

function buildSystemPrompt(s) {
  let prompt = s.systemPrompt.replace('{name}', s.petName).replace('{address}', s.masterAddress || '主人');
  return prompt;
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
  const s = getSettings();
  const name = s.petName || '宠物';
  const addr = s.masterAddress || '主人';
  const h = new Date().getHours();
  if (h < 5) return `夜深了${addr}，我陪着你，早点睡哦~`;
  if (h < 9) return `早上好${addr}！新的一天也要元气满满喵~`;
  if (h < 12) return `上午好~${addr}吃早饭了吗？记得喝水喵！`;
  if (h < 14) return `中午好呀，${addr}记得吃午饭，休息一下~`;
  if (h < 18) return `下午好${addr}，要不要休息一下，看看窗外呀？`;
  return `晚上好~今天辛苦啦，有${name}陪着你哦！`;
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
ipcMain.on('providers:open', () => toggleProvider());
ipcMain.on('providers:close', () => {
  if (providerWin) providerWin.hide();
});
ipcMain.on('settings:open', () => toggleSettings());
ipcMain.on('settings:close', () => {
  if (settingsWin) settingsWin.hide();
});
ipcMain.handle('chat:send', (e, messages) => chatAI(messages));
ipcMain.handle('greeting:get', () => ({ greeting: getGreeting(), festival: getFestival() }));
ipcMain.handle('providers:get', () => OPENCODE_PRESETS.map((p, i) => ({ id: `template-${i}`, ...p, apiKey: '' })));

// ---------- 聊天记忆（memory.json） ----------
let memoryCache = null;
function memoryFile() { return path.join(app.getPath('userData'), 'memory.json'); }
function loadMemory() {
  if (memoryCache) return memoryCache;
  memoryCache = { history: [], summary: '' };
  try {
    const raw = fs.readFileSync(memoryFile(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.history)) memoryCache = parsed;
  } catch (e) { /* 首次运行无文件 */ }
  return memoryCache;
}
function persistMemory() {
  try { fs.writeFileSync(memoryFile(), JSON.stringify(memoryCache, null, 2)); } catch (e) { console.error('memory save error', e); }
}
ipcMain.handle('memory:load', () => loadMemory());
ipcMain.handle('memory:save', (e, data) => {
  const mem = loadMemory();
  const history = Array.isArray(data && data.history) ? data.history : mem.history;
  memoryCache = {
    history: history.slice(-120),
    summary: (data && typeof data.summary === 'string') ? data.summary : (mem.summary || ''),
    updatedAt: Date.now(),
  };
  persistMemory();
  return memoryCache;
});
ipcMain.handle('memory:clear', () => {
  memoryCache = { history: [], summary: '', updatedAt: Date.now() };
  persistMemory();
  return memoryCache;
});

// ---------- 成长系统 ----------
ipcMain.handle('growth:get', () => {
  const st = getState();
  const def = getGrowthDef(st.level, st.exp);
  return { ...def, isNewDay: st.todayGreeted !== new Date().toDateString() };
});
ipcMain.handle('growth:addExp', (e, amount) => {
  const cur = getState();
  let { level, exp } = getGrowthDef(cur.level, cur.exp);
  exp += Math.max(1, Number(amount) || 0);
  let leveledUp = false;
  let def = getGrowthDef(level, exp);
  while (exp >= def.expToNext) {
    exp -= def.expToNext;
    level += 1;
    leveledUp = true;
    def = getGrowthDef(level, exp);
  }
  const merged = { ...cur, level, exp };
  saveStateQuiet(merged);
  return { ...getGrowthDef(level, exp), leveledUp };
});
function saveStateQuiet(data) {
  try { fs.writeFileSync(stateFile, JSON.stringify(data, null, 2)); } catch (e) { console.error(e); }
}
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
// ============= 宠物轻触 AI 回复（失败回空串，交给渲染层兜底） =============
ipcMain.handle('pet:tapAI', async () => {
  const s = getSettings();
  const { active, model, legacy } = resolveProvider(s);
  const hasKey = legacy ? (s.aiApiKey && s.aiBaseUrl && s.aiModel) : !!(active && active.baseUrl && active.apiKey);
  if (!hasKey || !model) return '';
  try {
    const msgs = [{ role: 'user', content: '戳一戳' }];
    const reply = await chatAI(msgs);
    // 如果 chatAI 实际走了 localChat（API 未成功），则用预设兜底
    if (reply === localChat(msgs)) return '';
    return reply && reply.length < 200 ? reply : '';
  } catch {
    return '';
  }
});

// 移动聊天窗口自身（拖拽标题栏用）
ipcMain.on('chat:moveTo', (e, { x, y }) => {
  if (!chatWin) return;
  const b = chatWin.getBounds();
  const targetX = Math.round(Number(x) || 0);
  const targetY = Math.round(Number(y) || 0);
  const display = screen.getDisplayNearestPoint({ x: targetX, y: targetY });
  const wa = display.workArea;
  const nx = Math.round(Math.min(Math.max(targetX, wa.x), wa.x + wa.width - b.width));
  const ny = Math.round(Math.min(Math.max(targetY, wa.y), wa.y + wa.height - b.height));
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
  const nextX = Math.round(b.x + (b.width - width) / 2);
  const nextY = b.y + b.height - height;
  petWin.setBounds({ x: nextX, y: nextY, width, height });
  petBaseWinSize = { width, height, scale: petBaseWinSize ? petBaseWinSize.scale : getPetWindowSize().scale };
  petWinSize = { ...petBaseWinSize };
  reclampPetWindow();
});

// 气泡显示时扩展透明窗口顶部空间。以窗口底部中心为锚点，宠物在屏幕上不会跳动。
ipcMain.on('pet:setBubbleLayout', (e, layout) => {
  if (!petWin) return;
  const baseWidth = Math.max(120, Math.round(Number(layout && layout.baseWidth) || 120));
  const baseHeight = Math.max(110, Math.round(Number(layout && layout.baseHeight) || 110));
  const bubbleWidth = Math.max(0, Math.round(Number(layout && layout.bubbleWidth) || 0));
  const bubbleHeight = Math.max(0, Math.round(Number(layout && layout.bubbleHeight) || 0));
  const gap = Math.max(0, Math.round(Number(layout && layout.gap) || 0));
  const visible = !!(layout && layout.visible);
  const width = visible ? Math.max(baseWidth, bubbleWidth + 12) : baseWidth;
  const height = visible ? baseHeight + bubbleHeight + gap : baseHeight;
  const b = petWin.getBounds();
  const nextX = Math.round(b.x + (b.width - width) / 2);
  const nextY = b.y + b.height - height;
  petWin.setBounds({ x: nextX, y: nextY, width, height });
  petWinSize = { width, height, scale: petWinSize ? petWinSize.scale : getPetWindowSize().scale };
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
