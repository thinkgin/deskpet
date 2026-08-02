const petSel = document.getElementById('petId');
const petName = document.getElementById('petName');
const masterAddress = document.getElementById('masterAddress');
const petGender = document.getElementById('petGender');
const petBirthday = document.getElementById('petBirthday');
const petAgeText = document.getElementById('petAgeText');
const petScale = document.getElementById('petScale');
const soundOn = document.getElementById('soundOn');
const autoWalk = document.getElementById('autoWalk');

const autoStart = document.getElementById('autoStart');
const shutdownMode = document.getElementById('shutdownMode');
const shutdownCountdownBox = document.getElementById('shutdownCountdownBox');
const shutdownTimeBox = document.getElementById('shutdownTimeBox');
const shutdownMinutes = document.getElementById('shutdownMinutes');
const shutdownTime = document.getElementById('shutdownTime');
const shutdownStatus = document.getElementById('shutdownStatus');
const shutdownGo = document.getElementById('shutdownGo');
const shutdownCancel = document.getElementById('shutdownCancel');

const activeEffort = document.getElementById('activeEffort');
const activeProviderId = document.getElementById('activeProviderId');
const activeModel = document.getElementById('activeModel');
const activeModelBox = document.getElementById('activeModelBox');
const openProvider = document.getElementById('openProvider');
const provList = document.getElementById('provList');
const provAdd = document.getElementById('provAdd');
const presetList = document.getElementById('presetList');

const saveBtn = document.getElementById('save');
const saveAlsoBtn = document.getElementById('saveAlso');
const statusEl = document.getElementById('status');

const PETS = [
  { id: 'cat', name: '像素小猫 · 咪咪' },
];

let settings = null;
let providers = [];
let presets = [];

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ''), 1600);
}

function computeAge(birthday) {
  if (!birthday) return '';
  const b = new Date(birthday + 'T00:00:00');
  if (isNaN(b.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  if (age < 0) age = 0;
  return age === 0 ? '不到 1 岁' : (age + ' 岁');
}

function updateAgeText() {
  petAgeText.value = computeAge(petBirthday.value);
}

function renderProvList() {
  provList.innerHTML = '';
  if (!providers.length) {
    const d = document.createElement('div');
    d.className = 'hint';
    d.textContent = '还没有添加 Provider，从下方预设添加或点新增按钮。';
    provList.appendChild(d);
    return;
  }
  providers.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'prov-card' + (String(settings.activeProviderId) === p.id ? ' active' : '');
    const info = document.createElement('div');
    info.className = 'info';
    const b = document.createElement('b');
    b.textContent = p.name;
    const s = document.createElement('span');
    const models = (Array.isArray(p.models) ? p.models.map((m) => m.model).join(' / ') : '');
    s.textContent = (p.baseUrl || '') + (models ? ' · ' + models : '');
    info.appendChild(b);
    info.appendChild(s);
    const acts = document.createElement('div');
    acts.className = 'prov-actions';
    const selBtn = document.createElement('button');
    selBtn.className = 'mini-btn primary';
    selBtn.textContent = '选用';
    selBtn.addEventListener('click', () => {
      settings.activeProviderId = p.id;
      renderProviderSelect();
      renderProvList();
      renderModelSelect();
      flash('已选用「' + p.name + '」');
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn danger';
    delBtn.textContent = '删';
    delBtn.addEventListener('click', () => {
      providers = providers.filter((x) => x.id !== p.id);
      if (settings.activeProviderId === p.id) settings.activeProviderId = '';
      renderProviderSelect();
      renderProvList();
      renderModelSelect();
    });
    acts.appendChild(selBtn);
    acts.appendChild(delBtn);
    card.appendChild(info);
    card.appendChild(acts);
    provList.appendChild(card);
  });
}

function renderPresetsInline() {
  presetList.innerHTML = '';
  presets.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'prov-card';
    const info = document.createElement('div');
    info.className = 'info';
    const b = document.createElement('b');
    b.textContent = p.name;
    const sp = document.createElement('span');
    sp.textContent = (p.baseUrl || '') + ' · ' + (p.models ? p.models.length + ' 个模型' : '');
    info.appendChild(b);
    info.appendChild(sp);
    const acts = document.createElement('div');
    acts.className = 'prov-actions';
    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn primary';
    const already = providers.some((x) => x.baseUrl === p.baseUrl);
    if (already) { addBtn.textContent = '已添加'; addBtn.disabled = true; }
    else addBtn.textContent = '+ 添加';
    addBtn.addEventListener('click', () => {
      if (already) return;
      const name = prompt('Provider 显示名称', p.name);
      if (name === null) return;
      const key = prompt('API Key（可留空）', '');
      if (key === null) return;
      const id = 'prov' + Date.now();
      providers.push({
        id, name: name.trim(), baseUrl: p.baseUrl, apiKey: key.trim(), apiType: p.apiType || 'openai',
        models: (p.models || []).map((m) => ({ model: m.model, label: m.label || m.model })),
      });
      renderProviderSelect();
      renderProvList();
      renderPresetsInline();
      flash('已添加「' + name + '」');
    });
    acts.appendChild(addBtn);
    card.appendChild(info);
    card.appendChild(acts);
    presetList.appendChild(card);
  });
}

function renderProviderSelect() {
  activeProviderId.innerHTML = '';
  if (!providers.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '暂无提供商，请点击下方按钮添加';
    activeProviderId.appendChild(o);
  }
  providers.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name || ('Provider ' + p.id);
    activeProviderId.appendChild(o);
  });
  activeProviderId.value = String(settings.activeProviderId || '');
}

function currentProvider() {
  return providers.find((p) => String(p.id) === String(settings.activeProviderId)) || null;
}

function renderModelSelect() {
  const prov = currentProvider();
  const models = (prov && Array.isArray(prov.models)) ? prov.models.map((m) => m.model).filter(Boolean) : [];
  if (prov && models.length) {
    activeModelBox.style.display = '';
    activeModel.innerHTML = '';
    models.forEach((mm) => {
      const o = document.createElement('option');
      o.value = mm;
      o.textContent = mm;
      activeModel.appendChild(o);
    });
    const prev = settings.activeModel;
    // 只有一个模型则自动选中（默认），不上报变更
    if (models.length === 1) {
      activeModel.value = models[0];
      settings.activeModel = models[0];
    } else if (prev && models.includes(prev)) {
      activeModel.value = prev;
    } else {
      activeModel.value = models[0];
      settings.activeModel = models[0];
    }
  } else {
    activeModelBox.style.display = 'none';
    settings.activeModel = '';
  }
}

function persist() {
  return window.api.saveSettings({
    providers,
    activeProviderId: settings.activeProviderId,
    activeModel: settings.activeModel,
    activeReasoningEffort: activeEffort.value || 'medium',
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
  masterAddress.value = settings.masterAddress || '主人';
  petGender.value = settings.petGender || '女生';
  if (settings.petBirthday) petBirthday.value = settings.petBirthday;
  updateAgeText();
  petScale.value = String(Math.min(Math.max(Number(settings.petScale) || 5, 3), 12));
  soundOn.checked = settings.soundOn !== false;
  autoWalk.checked = settings.autoWalk !== false;
  activeEffort.value = settings.activeReasoningEffort || 'medium';

  autoStart.checked = await window.api.getAutoStart();

  try { presets = (await window.api.getProviderPresets()) || []; } catch (e) { presets = []; }

  renderProviderSelect();
  renderModelSelect();
  renderProvList();
  renderPresetsInline();
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
  flash('定时关机已应用 ✔�');
});

shutdownCancel.addEventListener('click', async () => {
  await window.api.cancelShutdown();
  shutdownMode.value = 'off';
  onShutdownModeChange();
  shutdownStatus.textContent = '';
  flash('已取消定时关机 ✔�');
});

openProvider.addEventListener('click', () => {
  window.api.openProviderPage();
});

provAdd.addEventListener('click', () => {
  const name = prompt('Provider 名称', '自定义中转');
  if (name === null) return;
  const baseUrl = prompt('接口地址', 'https://api.openai.com/v1');
  if (baseUrl === null) return;
  const apiKey = prompt('API Key', '');
  if (apiKey === null) return;
  const modelsText = prompt('模型列表（每行一个）', 'gpt-4o-mini');
  if (modelsText === null) return;
  const models = modelsText.split('\n').map((x) => x.trim()).filter(Boolean);
  const id = 'prov' + Date.now();
  providers.push({
    id, name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), apiType: 'openai',
    models: models.map((m) => ({ model: m, label: m })),
  });
  settings.activeProviderId = id;
  renderProviderSelect();
  renderProvList();
  renderModelSelect();
  flash('已新增「' + name + '」');
});

activeProviderId.addEventListener('change', () => {
  settings.activeProviderId = activeProviderId.value;
  settings.activeModel = '';
  renderModelSelect();
  persist();
  flash('已选择 Provider，记得保存');
});

activeModel.addEventListener('change', () => {
  settings.activeModel = activeModel.value;
});

petBirthday.addEventListener('change', updateAgeText);

function collect() {
  return {
    petId: petSel.value,
    petName: petName.value.trim() || '咪咪',
    masterAddress: masterAddress.value.trim() || '主人',
    petGender: petGender.value,
    petBirthday: petBirthday.value || '',
    petScale: Number(petScale.value) || 5,
    soundOn: soundOn.checked,
    autoWalk: autoWalk.checked,
    providers,
    activeProviderId: settings.activeProviderId,
    activeModel: settings.activeModel,
    activeReasoningEffort: activeEffort.value || 'medium',
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