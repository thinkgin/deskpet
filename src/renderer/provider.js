const popularList = document.getElementById('popularList');
const savedList = document.getElementById('savedList');
const catalogModal = document.getElementById('catalogModal');
const configModal = document.getElementById('configModal');
const catalogList = document.getElementById('catalogList');
const search = document.getElementById('providerSearch');
const form = document.getElementById('configForm');
const statusEl = document.getElementById('status');

const POPULAR_IDS = ['opencode', 'opencode-go', 'anthropic', 'github-copilot', 'openai', 'google', 'openrouter', 'vercel'];
let settings = null;
let saved = [];
let catalog = [];
let editingId = '';
let flashTimer = null;

function flash(message) {
  statusEl.textContent = message;
  statusEl.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => statusEl.classList.remove('show'), 2200);
}

function openModal(el) { el.classList.add('open'); }
function closeModal(el) { el.classList.remove('open'); }
function logo(name) { return (name || '?').trim().slice(0, 1).toUpperCase(); }
function providerDescription(p) {
  if (p.id === 'opencode') return '使用 OpenCode Zen 或 API 密钥连接';
  if (p.id === 'opencode-go') return '适合所有人的低成本订阅';
  if (p.id === 'anthropic') return '使用 Claude Pro/Max 或 API 密钥连接';
  if (p.id === 'github-copilot') return '使用 Copilot 或 API 密钥连接';
  if (p.id === 'openai') return '使用 ChatGPT Pro/Plus 或 API 密钥连接';
  if (p.id === 'google') return '使用 Google 账号或 API 密钥连接';
  if (p.id === 'openrouter') return '使用 OpenRouter 账号或 API 密钥连接';
  if (p.id === 'vercel') return '使用 Vercel 账号或 API 密钥连接';
  return (p.models ? p.models.length : 0) + ' 个模型' + (p.api ? ' · ' + p.api : '');
}

function resolvedApi(p) {
  if (p.api) return p.api;
  const defaults = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    groq: 'https://api.groq.com/openai/v1',
    mistral: 'https://api.mistral.ai/v1',
    xai: 'https://api.x.ai/v1',
    cerebras: 'https://api.cerebras.ai/v1',
    cohere: 'https://api.cohere.com/compatibility/v1',
    deepinfra: 'https://api.deepinfra.com/v1/openai',
    perplexity: 'https://api.perplexity.ai',
    togetherai: 'https://api.together.xyz/v1',
  };
  return defaults[p.id] || '';
}

function isSaved(template) {
  return saved.some((p) => p.catalogId === template.id || (template.api && p.baseUrl === template.api));
}

function makeProviderRow(p, options = {}) {
  const row = document.createElement('div');
  row.className = 'provider-row' + (options.saved ? ' saved-row' : '');
  const icon = document.createElement('div');
  icon.className = 'logo';
  icon.textContent = logo(p.name);
  const info = document.createElement('div');
  info.className = 'provider-info';
  const name = document.createElement('div');
  name.className = 'provider-name';
  name.textContent = p.name;
  if (options.recommended) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = '推荐';
    name.appendChild(tag);
  }
  const desc = document.createElement('div');
  desc.className = 'provider-desc';
  desc.textContent = options.saved
    ? ((p.baseUrl || '未配置接口地址') + ' · ' + ((p.models || []).length) + ' 个模型')
    : providerDescription(p);
  info.append(name, desc);
  row.append(icon, info);

  if (options.saved) {
    const actions = document.createElement('div');
    actions.className = 'saved-actions';
    const edit = document.createElement('button');
    edit.className = 'connect';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => openConfig(null, p));
    const remove = document.createElement('button');
    remove.className = 'connect danger';
    remove.textContent = '删除';
    remove.addEventListener('click', async () => {
      if (!confirm('删除「' + p.name + '」？')) return;
      saved = saved.filter((item) => item.id !== p.id);
      const update = { providers: saved };
      if (settings.activeProviderId === p.id) update.activeProviderId = '';
      await persist(update);
      renderAll();
      flash('已删除「' + p.name + '」');
    });
    actions.append(edit, remove);
    row.append(actions);
  } else {
    const connect = document.createElement('button');
    connect.className = 'connect';
    connect.textContent = isSaved(p) ? '已连接' : '+ 连接';
    connect.disabled = isSaved(p);
    connect.addEventListener('click', () => openConfig(p));
    row.append(connect);
  }
  return row;
}

function customTemplate() {
  return { id: 'custom', name: '自定义提供商', api: '', apiType: 'openai', env: [], models: [] };
}

function renderPopular() {
  popularList.innerHTML = '';
  const popular = POPULAR_IDS.map((id) => catalog.find((p) => p.id === id)).filter(Boolean);
  popular.push(customTemplate());
  popular.forEach((p, index) => popularList.appendChild(makeProviderRow(p, { recommended: index < 2 })));
}

function renderCatalog() {
  catalogList.innerHTML = '';
  const query = search.value.trim().toLowerCase();
  const list = catalog.filter((p) => !query || p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
  list.forEach((p) => catalogList.appendChild(makeProviderRow(p)));
  catalogList.appendChild(makeProviderRow(customTemplate()));
}

function renderSaved() {
  savedList.innerHTML = '';
  if (!saved.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '尚未连接提供商。';
    savedList.appendChild(empty);
    return;
  }
  saved.forEach((p) => savedList.appendChild(makeProviderRow(p, { saved: true })));
}

function renderAll() {
  renderPopular();
  renderCatalog();
  renderSaved();
}

function openConfig(template, existing) {
  editingId = existing ? existing.id : '';
  const p = existing || template || customTemplate();
  document.getElementById('configTitle').textContent = existing ? '编辑提供商' : '连接 ' + p.name;
  document.getElementById('providerName').value = p.name || '';
  document.getElementById('providerType').value = p.apiType || 'openai';
  document.getElementById('providerUrl').value = existing ? (p.baseUrl || '') : resolvedApi(p);
  document.getElementById('providerKey').value = p.apiKey || '';
  document.getElementById('providerEnv').textContent = p.env && p.env.length ? 'OpenCode 环境变量：' + p.env.join(' / ') : '';
  document.getElementById('providerModels').value = (p.models || []).map((m) => m.model + (m.label && m.label !== m.model ? ' | ' + m.label : '')).join('\n');
  form.dataset.catalogId = existing ? (p.catalogId || '') : (p.id === 'custom' ? '' : p.id);
  closeModal(catalogModal);
  openModal(configModal);
  setTimeout(() => document.getElementById('providerKey').focus(), 0);
}

function parseModels(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split('|').map((part) => part.trim());
    return { model: parts[0], label: parts[1] || parts[0] };
  });
}

async function persist(extra = {}) {
  try {
    settings = { ...settings, providers: saved, ...extra };
    await window.api.saveSettings({ providers: saved, ...extra });
  } catch (error) {
    flash('保存失败：' + error.message);
    throw error;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('providerName').value.trim();
  const baseUrl = document.getElementById('providerUrl').value.trim().replace(/\/$/, '');
  const apiKey = document.getElementById('providerKey').value.trim();
  const models = parseModels(document.getElementById('providerModels').value);
  if (!name || !baseUrl || !models.length) {
    flash('请完整填写名称、接口地址和至少一个模型');
    return;
  }
  const provider = {
    id: editingId || ('prov-' + Date.now()),
    catalogId: form.dataset.catalogId || '',
    name,
    baseUrl,
    apiKey,
    apiType: document.getElementById('providerType').value,
    models,
    defaultModel: models[0].model,
  };
  if (editingId) saved = saved.map((item) => item.id === editingId ? provider : item);
  else saved.push(provider);
  await persist(editingId ? {} : { activeProviderId: settings.activeProviderId || provider.id, activeModel: settings.activeModel || provider.defaultModel });
  closeModal(configModal);
  renderAll();
  flash(editingId ? '已更新「' + name + '」' : '已连接「' + name + '」');
});

document.getElementById('showAll').addEventListener('click', () => {
  search.value = '';
  renderCatalog();
  openModal(catalogModal);
  search.focus();
});
search.addEventListener('input', renderCatalog);
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close))));
document.querySelectorAll('.modal').forEach((modal) => modal.addEventListener('pointerdown', (event) => { if (event.target === modal) closeModal(modal); }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeModal(catalogModal); closeModal(configModal); } });

(async () => {
  try {
    const [loadedSettings, response] = await Promise.all([window.api.loadSettings(), fetch('provider-catalog.json')]);
    settings = loadedSettings;
    saved = Array.isArray(settings.providers) ? settings.providers : [];
    catalog = await response.json();
    catalog = catalog.map((provider) => provider.id === 'anthropic' ? { ...provider, apiType: 'anthropic' } : provider);
    renderAll();
  } catch (error) {
    flash('提供商数据加载失败：' + error.message);
  }
})();
