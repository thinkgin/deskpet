const petSel = document.getElementById('petId');
const petName = document.getElementById('petName');
const petScale = document.getElementById('petScale');
const soundOn = document.getElementById('soundOn');
const autoWalk = document.getElementById('autoWalk');
const aiApiKey = document.getElementById('aiApiKey');
const aiBaseUrl = document.getElementById('aiBaseUrl');
const aiModel = document.getElementById('aiModel');

const autoStart = document.getElementById('autoStart');
const shutdownMode = document.getElementById('shutdownMode');
const shutdownCountdownBox = document.getElementById('shutdownCountdownBox');
const shutdownTimeBox = document.getElementById('shutdownTimeBox');
const shutdownMinutes = document.getElementById('shutdownMinutes');
const shutdownTime = document.getElementById('shutdownTime');
const shutdownStatus = document.getElementById('shutdownStatus');
const shutdownGo = document.getElementById('shutdownGo');
const shutdownCancel = document.getElementById('shutdownCancel');

const provList = document.getElementById('provList');
const provAdd = document.getElementById('provAdd');
const activeProviderId = document.getElementById('activeProviderId');

const saveBtn = document.getElementById('save');
const saveAlsoBtn = document.getElementById('saveAlso');
const statusEl = document.getElementById('status');

const PETS = [
  { id: 'cat', name: '像素小猫 · 咪咪' },
];

let settings = null;
let providers = [];
const LEGACY_ID = 'custom';

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ''), 1600);
}

function renderProviders() {
  provList.innerHTML = '';
  providers.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'prov-card' + (String(settings.activeProviderId) === p.id ? ' active' : '');
    const info = document.createElement('div');
    info.className = 'info';
    const b = document.createElement('b');
    b.textContent = p.name || ('Provider ' + (i + 1));
    const s = document.createElement('span');
    s.textContent = (p.baseUrl || '无地址') + ' · ' + (p.model || '无模型');
    info.appendChild(b);
    info.appendChild(s);
    const acts = document.createElement('div');
    acts.className = 'prov-actions';
    const useBtn = document.createElement('button');
    useBtn.className = 'mini-btn primary';
    useBtn.textContent = '选用';
    useBtn.addEventListener('click', () => {
      settings.activeProviderId = p.id;
      renderProviders();
      flash('已选用「' + (p.name || p.id) + '」，建议保存以生效');
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn danger';
    delBtn.textContent = '删';
    delBtn.addEventListener('click', () => {
      providers = providers.filter((x) => x.id !== p.id);
      if (settings.activeProviderId === p.id) settings.activeProviderId = '';
      renderProviderSelect();
      renderProviders();
    });
    acts.appendChild(useBtn);
    acts.appendChild(delBtn);
    card.appendChild(info);
    card.appendChild(acts);
    provList.appendChild(card);
  });
  const empty = document.createElement('div');
  empty.className = 'hint';
  if (providers.length === 0) empty.textContent = '还没有 Provider，点下方按钮新增一个。';
  provList.appendChild(empty);
}

function renderProviderSelect() {
  activeProviderId.innerHTML = '';
  const optLegend = document.createElement('option');
  optLegend.value = LEGACY_ID;
  optLegend.textContent = '自定义单配置（下方 API Key / 地址 / 模型）';
  activeProviderId.appendChild(optLegend);
  providers.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name || ('Provider ' + p.id);
    activeProviderId.appendChild(o);
  });
  activeProviderId.value = String(settings.activeProviderId || LEGACY_ID);
}

// 打开 Provider 编辑弹窗（用浏览器自带 prompt 简化）
function editProvider(prov) {
  const name = prompt('Provider 名称', prov.name || '');
  if (name === null) return;
  const baseUrl = prompt('接口地址 (baseURL)', prov.baseUrl || 'https://api.openai.com/v1');
  if (baseUrl === null) return;
  const apiKey = prompt('API Key', prov.apiKey || '');
  if (apiKey === null) return;
  const model = prompt('模型 (model)', prov.model || 'gpt-4o-mini');
  if (model === null) return;
  return { name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() };
}

function persist() {
  return window.api.saveSettings({
    providers,
    activeProviderId: settings.activeProviderId,
  });
}

async function loadShutdownStatus() {
  try {
    const st = await window.api.getShutdownStatus();
    if (st && st.config && st.config.mode) {
      shutdownMode.value = st.config.mode;
      shutdownMinutes.value = st.config.minutes || 60;
      shutdownTime.value = st.config.time || '22:00';
      onShutdownModeChange();
      if (st.active && st.ms != null) {
        const mins = Math.ceil(st.ms / 60000);
        shutdownStatus.textContent = '剩余约 ' + mins + ' 分钟（' + new Date(Date.now() + st.ms).toLocaleTimeString() + '）';
      } else {
        shutdownStatus.textContent = '';
      }
    }
  } catch (e) {
    // ignore
  }
}

function onShutdownModeChange() {
  const v = shutdownMode.value;
  shutdownCountdownBox.style.display = v === 'countdown' ? '' : 'none';
  shutdownTimeBox.style.display = v === 'time' ? '' : 'none';
}

(async () => {
  settings = await window.api.loadSettings();
  providers = Array.isArray(settings.providers) ? settings.providers : [];
  PETS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    petSel.appendChild(opt);
  });
  petSel.value = settings.petId || 'cat';
  petName.value = settings.petName || '';
  petScale.value = String(Math.min(Math.max(Number(settings.petScale) || 5, 3), 12));
  soundOn.checked = settings.soundOn !== false;
  autoWalk.checked = settings.autoWalk !== false;
  aiApiKey.value = settings.aiApiKey || '';
  aiBaseUrl.value = settings.aiBaseUrl || 'https://api.openai.com/v1';
  aiModel.value = settings.aiModel || 'gpt-3.5-turbo';

  autoStart.checked = await window.api.getAutoStart();

  renderProviderSelect();
  renderProviders();
  loadShutdownStatus();
  onShutdownModeChange();
})();

shutdownMode.addEventListener('change', onShutdownModeChange);

shutdownGo.addEventListener('click', async () => {
  const cfg = { mode: shutdownMode.value };
  if (cfg.mode === 'countdown') cfg.minutes = Number(shutdownMinutes.value) || 60;
  if (cfg.mode === 'time') cfg.time = shutdownTime.value || '22:00';
  if (cfg.mode === 'off') {
    await window.api.cancelShutdown();
  } else {
    await window.api.scheduleShutdown(cfg);
  }
  loadShutdownStatus();
  flash('定时关机已应用 ✓');
});

shutdownCancel.addEventListener('click', async () => {
  await window.api.cancelShutdown();
  shutdownMode.value = 'off';
  onShutdownModeChange();
  shutdownStatus.textContent = '';
  flash('已取消定时关机 ✓');
});

provAdd.addEventListener('click', () => {
  const made = editProvider({ name: '中转服务', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' });
  if (!made) return;
  const id = 'prov' + Date.now();
  const prov = { id, ...made };
  providers.push(prov);
  settings.activeProviderId = prov.id;
  renderProviderSelect();
  renderProviders();
});

activeProviderId.addEventListener('change', () => {
  settings.activeProviderId = activeProviderId.value;
  persist();
  flash('已选择，建议点保存生效');
});

function collect() {
  return {
    petId: petSel.value,
    petName: petName.value.trim() || '咪咪',
    petScale: Number(petScale.value) || 5,
    soundOn: soundOn.checked,
    autoWalk: autoWalk.checked,
    aiApiKey: aiApiKey.value.trim(),
    aiBaseUrl: aiBaseUrl.value.trim() || 'https://api.openai.com/v1',
    aiModel: aiModel.value.trim() || 'gpt-3.5-turbo',
    providers,
    activeProviderId: settings.activeProviderId,
    shutdownConfig: {
      mode: shutdownMode.value,
      minutes: Number(shutdownMinutes.value) || 60,
      time: shutdownTime.value || '22:00',
      shutdownAt: Date.now(),
    },
  };
}

saveBtn.addEventListener('click', async () => {
  const data = collect();
  await window.api.setAutoStart(autoStart.checked);
  await window.api.saveSettings(data);
  if (shutdownMode.value === 'off') await window.api.cancelShutdown();
  else await window.api.scheduleShutdown(data.shutdownConfig);
  flash('已保存，重新加载宠物喵~');
  await window.api.notify('桌面宠物', '设置已保存，重新加载宠物喵~');
  setTimeout(() => window.location.reload(), 800);
});

saveAlsoBtn.addEventListener('click', async () => {
  const data = collect();
  await window.api.setAutoStart(autoStart.checked);
  await window.api.saveSettings(data);
  if (shutdownMode.value === 'off') await window.api.cancelShutdown();
  else await window.api.scheduleShutdown(data.shutdownConfig);
  flash('已保存（不重载）✓');
});