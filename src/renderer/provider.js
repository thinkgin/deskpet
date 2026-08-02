const presetList = document.getElementById('presetList');
const savedList = document.getElementById('savedList');
const statusEl = document.getElementById('status');
const customAddBtn = document.getElementById('customAdd');

let saved = [];
let presets = [];

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(() => { statusEl.textContent = ''; }, 1800);
}

async function refresh() {
  const s = await window.api.loadSettings();
  saved = Array.isArray(s.providers) ? s.providers : [];
  try { presets = (await window.api.getProviderPresets()) || []; } catch (e) { presets = []; }
  renderPresets();
  renderSaved();
}

function renderPresets() {
  presetList.innerHTML = '';
  presets.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'card';
    const info = document.createElement('div');
    info.className = 'info';
    const b = document.createElement('b');
    b.textContent = p.name;
    const span = document.createElement('span');
    span.textContent = (p.baseUrl || '') + (p.models && p.models.length ? ' · ' + p.models.map(function(m){return m.model;}).join(' / ') : '');
    info.appendChild(b);
    info.appendChild(span);
    const act = document.createElement('div');
    act.className = 'actions';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.textContent = '+ 添加';
    const already = saved.some(function(x){return x.baseUrl===p.baseUrl;});
    if (already) { addBtn.textContent = '已添加'; addBtn.disabled = true; addBtn.style.opacity = '0.5'; }
    addBtn.addEventListener('click', function(){
      const name = prompt('Provider 显示名称', p.name);
      if (name===null) return;
      const key = prompt('API Key（可留空，稍后在已添加列表编辑）', '');
      if (key===null) return;
      const id = 'prov' + Date.now();
      saved.push({
        id: id,
        name: name.trim(),
        baseUrl: p.baseUrl,
        apiKey: key.trim(),
        apiType: p.apiType || 'openai',
        models: Array.isArray(p.models) ? p.models.map(function(m){return {model:m.model,label:m.label||m.model};}) : [],
        defaultModel: (p.models&&p.models[0]?p.models[0].model:'')
      });
      persist();
      renderPresets();
      renderSaved();
      flash('已添加「'+name+'」');
    });
    act.appendChild(addBtn);
    card.appendChild(info);
    card.appendChild(act);
    presetList.appendChild(card);
  });
}

function renderSaved() {
  savedList.innerHTML = '';
  if (!saved.length) {
    const d = document.createElement('div');
    d.className = 'hint';
    d.textContent = '还没有添加任何 Provider，从上方热门列表一键添加吧。';
    savedList.appendChild(d);
    return;
  }
  saved.forEach(function(p, i){
    var card = document.createElement('div');
    card.className = 'card saved';
    var info = document.createElement('div');
    info.className = 'info';
    var b = document.createElement('b');
    b.textContent = p.name;
    var span = document.createElement('span');
    span.textContent = (p.baseUrl||'') + ' · ' + (Array.isArray(p.models)?p.models.map(function(m){return m.model;}).join(' / '):'');
    info.appendChild(b);
    info.appendChild(span);
    var act = document.createElement('div');
    act.className = 'actions';
    var editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', function(){
      var name = prompt('名称', p.name);
      if (name===null) return;
      var url = prompt('接口地址', p.baseUrl);
      if (url===null) return;
      var key = prompt('API Key', p.apiKey||'');
      if (key===null) return;
      var modelsText = prompt('模型列表（每行一个）', Array.isArray(p.models)?p.models.map(function(m){return m.model;}).join('\n'):'');
      if (modelsText===null) return;
      var models = modelsText.split('\n').map(function(x){return x.trim();}).filter(Boolean);
      p.name = name.trim();
      p.baseUrl = url.trim();
      p.apiKey = key.trim();
      p.models = models.map(function(mm){return {model:mm,label:mm};});
      persist();
      renderSaved();
      flash('已更新「'+p.name+'」');
    });
    var delBtn = document.createElement('button');
    delBtn.className = 'btn danger';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', function(){
      if (!confirm('删除「'+p.name+'」？')) return;
      saved.splice(i,1);
      persist();
      renderPresets();
      renderSaved();
    });
    act.appendChild(editBtn);
    act.appendChild(delBtn);
    card.appendChild(info);
    card.appendChild(act);
    savedList.appendChild(card);
  });
}

function persist() {
  window.api.saveSettings({ providers: saved });
}

customAddBtn.addEventListener('click', function(){
  var name = document.getElementById('customName').value.trim();
  var url = document.getElementById('customUrl').value.trim();
  var key = document.getElementById('customKey').value.trim();
  var modelsText = document.getElementById('customModels').value.trim();
  if (!name) { flash('请输入名称'); return; }
  if (!url) { flash('请输入接口地址'); return; }
  var models = modelsText?modelsText.split('\n').map(function(x){return x.trim();}).filter(Boolean):[];
  var id = 'prov' + Date.now();
  saved.push({
    id: id,
    name: name,
    baseUrl: url,
    apiKey: key,
    apiType: 'openai',
    models: models.map(function(mm){return {model:mm,label:mm};}),
    defaultModel: models[0]||''
  });
  persist();
  renderPresets();
  renderSaved();
  flash('已添加「'+name+'」');
  document.getElementById('customName').value = '';
  document.getElementById('customUrl').value = '';
  document.getElementById('customKey').value = '';
  document.getElementById('customModels').value = '';
  document.getElementById('customAddBlock').open = false;
});

refresh();