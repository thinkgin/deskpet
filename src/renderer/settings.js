const petSel = document.getElementById('petId');
const petName = document.getElementById('petName');
const masterAddress = document.getElementById('masterAddress');
const petGender = document.getElementById('petGender');
const petBirthday = document.getElementById('petBirthday');
const petAgeText = document.getElementById('petAgeText');
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
const presetSel = document.getElementById('presetSel');
const presetAdd = document.getElementById('presetAdd');
const activeProviderId = document.getElementById('activeProviderId');
const activeModel = document.getElementById('activeModel');
const activeModelBox = document.getElementById('activeModelBox');
const activeEffort = document.getElementById('activeEffort');
const openProvider = document.getElementById('openProvider');

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
  aiApiKey.value = settings.aiApiKey || '';
  aiBaseUrl.value = settings.aiBaseUrl || 'https://api.openai.com/v1';
  aiModel.value = settings.aiModel || 'gpt-3.5-turbo';
  activeEffort.value = settings.activeReasoningEffort || 'medium';

  autoStart.checked = await window.api.getAutoStart();

  renderProviderSelect();
  renderModelSelect();
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

openProvider.addEventListener('click', (e) => {
  e.preventDefault();
  window.api.openProviderPage();
});

provAdd.addEventListener('click', () => {
  window.api.openProviderPage();
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
    aiApiKey: aiApiKey.value.trim(),
    aiBaseUrl: aiBaseUrl.value.trim() || 'https://api.openai.com/v1',
    aiModel: aiModel.value.trim() || 'gpt-3.5-turbo',
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