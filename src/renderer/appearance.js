// 形象面板：7 槽位（1 系统小猫 + 6 自定义）+ 模板拼装 + 像素画布微调 + 实时预览
const pc = window.__pixelCompose;
const cat = window.__catDef;

const pixCanvas = document.getElementById('pixcanvas');
const pixCtx = pixCanvas.getContext('2d');
const previewCanvas = document.getElementById('preview');
const previewCtx = previewCanvas.getContext('2d');
const nameInput = document.getElementById('petName');
const saveBtn = document.getElementById('saveBtn');
const useBtn = document.getElementById('useBtn');
const deleteBtn = document.getElementById('deleteBtn');
const eraserBtn = document.getElementById('eraser');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');

const CELL = 24; // 像素画布每格 24px（16x16 = 384）
let customPets = [null, null, null, null, null, null];
let activePetId = 'cat';
let currentSlot = -1; // -1 系统，0~5 自定义

// 当前编辑中的形象（仅自定义槽位使用）
let editing = null; // { name, options, palette, base, parts, isNew }
let currentColor = 'w';
let erasing = false;

const SLOT_CNT = 6;

// ---------- 画布基础 ----------
function blankGrid() {
  return Array.from({ length: 16 }, () => Array(16).fill('.'));
}
function toRows(g) {
  return g.map((r) => r.join(''));
}
function fromRows(arr) {
  return arr.map((s) => String(s).padEnd(16, '.').split(''));
}
function setPx(g, x, y, c) {
  if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c;
}

function drawPixelGrid(ctx, base, scale, palette) {
  const g = fromRows(base);
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = g[y][x];
      const color = ch && ch !== '.' ? (palette[ch] || '#fff') : '#faf5ee';
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  ctx.strokeStyle = 'rgba(74,59,53,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 16; i++) {
    ctx.beginPath(); ctx.moveTo(i * scale, 0); ctx.lineTo(i * scale, 16 * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * scale); ctx.lineTo(16 * scale, i * scale); ctx.stroke();
  }
}

// ---------- 预览（动画） ----------
let previewEngine = null;
function refreshPreview() {
  if (!previewEngine) {
    previewEngine = new window.PixelEngineModule.PixelEngine(previewCanvas, cat, 11);
  }
  let def;
  if (currentSlot === -1) {
    def = cat;
  } else if (editing) {
    def = pc.buildPetDef({
      id: 'custom:' + currentSlot,
      name: editing.name || '自定义',
      palette: editing.palette,
      base: editing.base,
      parts: editing.parts,
    });
  } else {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    return;
  }
  if (previewEngine.pet !== def) previewEngine.pet = def;
  previewCanvas.width = def.size.w * 11;
  previewCanvas.height = def.size.h * 11;
  previewEngine.play('idle');
}

// ---------- 槽位缩略图 ----------
function slotThumb(base, palette) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  const g = fromRows(base);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = g[y][x];
    if (ch && ch !== '.') { ctx.fillStyle = palette[ch] || '#fff'; ctx.fillRect(x, y, 1, 1); }
  }
  return c;
}

function refreshSlots() {
  // 系统小猫
  const sysBox = document.getElementById('slot-preview-0');
  sysBox.innerHTML = '';
  sysBox.appendChild(slotThumb(cat.frames.idle[0], cat.palette));

  for (let i = 0; i < SLOT_CNT; i++) {
    const box = document.getElementById('slot-preview-' + (i + 1));
    const nameEl = document.getElementById('slot-name-' + (i + 1));
    box.innerHTML = '';
    const pet = customPets[i];
    if (pet) {
      box.appendChild(slotThumb(pet.base, pet.palette));
      nameEl.textContent = pet.name || ('自定义' + (i + 1));
      nameEl.title = pet.name || ('自定义' + (i + 1));
    } else {
      const plus = document.createElement('span');
      plus.textContent = '+';
      plus.style.cssText = 'font-size:30px;color:#d9c9b8;line-height:56px;';
      box.appendChild(plus);
      nameEl.textContent = '空槽位';
      nameEl.title = '';
    }
  }
  document.querySelectorAll('.slot').forEach((el) => {
    const idx = parseInt(el.dataset.idx, 10);
    el.classList.toggle('active', idx === currentSlot);
  });
}

// ---------- 模板选项 ----------
function buildOptionButtons() {
  const schemeEl = document.getElementById('opt-scheme');
  const earEl = document.getElementById('opt-ear');
  const eyeEl = document.getElementById('opt-eye');
  const mouthEl = document.getElementById('opt-mouth');

  const optBtn = (label, val, active) => {
    const b = document.createElement('button');
    b.className = 'opt' + (active ? ' active' : '');
    b.dataset.val = val;
    b.innerHTML = label;
    return b;
  };

  Object.keys(pc.SCHEME_NAMES).forEach((k) => {
    const s = pc.SCHEMES[k];
    schemeEl.appendChild(optBtn(
      '<span class="swatch" style="background:' + s.w + '"></span>' + pc.SCHEME_NAMES[k],
      k, k === (editing && editing.options.scheme)
    ));
  });
  Object.keys(pc.EAR_TYPES).forEach((k) => {
    earEl.appendChild(optBtn(pc.EAR_TYPES[k], k, k === (editing && editing.options.ear)));
  });
  Object.keys(pc.EYE_STYLES).forEach((k) => {
    eyeEl.appendChild(optBtn(pc.EYE_STYLES[k], k, k === (editing && editing.options.eye)));
  });
  Object.keys(pc.MOUTH_STYLES).forEach((k) => {
    mouthEl.appendChild(optBtn(pc.MOUTH_STYLES[k], k, k === (editing && editing.options.mouth)));
  });
  document.querySelectorAll('#opt-cheeks .opt').forEach((b) => {
    b.classList.toggle('active', b.dataset.val === String(!!(editing && editing.options.cheeks)));
  });
}

function applyTemplate() {
  if (!editing) return;
  const gen = pc.generateBase(editing.options);
  editing.base = gen.base;
  editing.parts = gen.parts;
  editing.palette = { ...pc.SCHEMES[editing.options.scheme] };
  drawPixelCanvas();
  refreshPreview();
}

function bindOptionListeners() {
  document.querySelectorAll('#template-panel .opts').forEach((optsEl) => {
    optsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.opt');
      if (!btn || !editing) return;
      optsEl.querySelectorAll('.opt').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const key = optsEl.id.replace('opt-', '');
      if (key === 'cheeks') {
        editing.options.cheeks = btn.dataset.val === 'true';
      } else {
        editing.options[key] = btn.dataset.val;
      }
      applyTemplate();
    });
  });
}

// ---------- 像素画布编辑 ----------
function drawPixelCanvas() {
  drawPixelGrid(pixCtx, editing ? editing.base : ([]), CELL, editing ? editing.palette : pc.SCHEMES.cream);
}

function rebuildSwatches() {
  const el = document.getElementById('swatches');
  el.innerHTML = '';
  const palette = editing ? editing.palette : pc.SCHEMES.cream;
  Object.keys(pc.SCHEMES.cream).forEach((ch) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (ch === currentColor ? ' active' : '');
    s.style.background = palette[ch];
    s.dataset.ch = ch;
    el.appendChild(s);
  });
}

function paintCell(ev) {
  if (!editing) return;
  const rect = pixCanvas.getBoundingClientRect();
  const scaleX = pixCanvas.width / rect.width;
  const scaleY = pixCanvas.height / rect.height;
  const x = Math.floor((ev.clientX - rect.left) * scaleX / CELL);
  const y = Math.floor((ev.clientY - rect.top) * scaleY / CELL);
  if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
  const g = fromRows(editing.base);
  if (ev.button === 2) {
    setPx(g, x, y, '.');
  } else {
    setPx(g, x, y, erasing ? '.' : currentColor);
  }
  editing.base = toRows(g);
  drawPixelCanvas();
  refreshPreview();
}

function bindCanvasEvents() {
  let drawing = false;
  pixCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  pixCanvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    pixCanvas.setPointerCapture(e.pointerId);
    paintCell(e);
  });
  pixCanvas.addEventListener('pointermove', (e) => {
    if (drawing) paintCell(e);
  });
  pixCanvas.addEventListener('pointerup', () => (drawing = false));
  pixCanvas.addEventListener('pointercancel', () => (drawing = false));

  eraserBtn.addEventListener('click', () => {
    erasing = !erasing;
    eraserBtn.classList.toggle('active', erasing);
  });
  clearBtn.addEventListener('click', () => {
    if (!editing) return;
    if (confirm('清空当前画布？')) {
      editing.base = toRows(blankGrid());
      drawPixelCanvas();
      refreshPreview();
    }
  });
  document.getElementById('swatches').addEventListener('click', (e) => {
    const s = e.target.closest('.swatch');
    if (!s) return;
    currentColor = s.dataset.ch;
    erasing = false;
    eraserBtn.classList.remove('active');
    document.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === s));
  });
}

// ---------- 槽位切换 ----------
async function selectSlot(idx) {
  currentSlot = idx;
  if (idx === -1) {
    editing = null;
    nameInput.value = cat.name;
    nameInput.disabled = true;
    saveBtn.style.display = 'none';
    useBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
  } else {
    const existing = customPets[idx];
    nameInput.disabled = false;
    saveBtn.style.display = '';
    useBtn.style.display = '';
    deleteBtn.style.display = existing ? '' : 'none';
    if (existing) {
      editing = {
        name: existing.name || '',
        options: { ...pc.DEFAULT_OPTIONS, ...(existing.options || {}) },
        palette: { ...existing.palette },
        base: existing.base.slice(),
        parts: existing.parts,
      };
      nameInput.value = editing.name;
    } else {
      editing = {
        name: '',
        options: { ...pc.DEFAULT_OPTIONS },
        palette: { ...pc.SCHEMES[pc.DEFAULT_OPTIONS.scheme] },
        base: pc.generateBase(pc.DEFAULT_OPTIONS).base,
        parts: pc.generateBase(pc.DEFAULT_OPTIONS).parts,
      };
      nameInput.value = '';
      deleteBtn.style.display = 'none';
    }
    // 重新生成选项按钮（高亮当前配置）
    ['opt-scheme','opt-ear','opt-eye','opt-mouth'].forEach((id) => {
      const el = document.getElementById(id);
      el.innerHTML = '';
    });
    buildOptionButtons();
    document.querySelectorAll('#opt-cheeks .opt').forEach((b) => {
      b.classList.toggle('active', b.dataset.val === String(!!editing.options.cheeks));
    });
    rebuildSwatches();
    drawPixelCanvas();
  }
  refreshPreview();
  refreshSlots();
}

function validateEditing() {
  if (!editing) return false;
  editing.name = nameInput.value.trim() || ('自定义' + (currentSlot + 1));
  return true;
}

async function saveCurrent() {
  if (!validateEditing()) return;
  const idx = currentSlot;
  const pet = {
    name: editing.name,
    options: editing.options,
    palette: editing.palette,
    base: editing.base,
    parts: editing.parts,
    updatedAt: Date.now(),
  };
  customPets[idx] = pet;
  await window.api.saveAppearance({ customPets, activePetId });
  refreshSlots();
  statusEl.textContent = '已保存到槽位 ' + (idx + 1) + ' ✓';
  setTimeout(() => (statusEl.textContent = ''), 1500);
}

async function useCurrent() {
  if (!validateEditing()) return;
  const idx = currentSlot;
  const id = 'custom:' + idx;
  customPets[idx] = {
    name: editing.name,
    options: editing.options,
    palette: editing.palette,
    base: editing.base,
    parts: editing.parts,
    updatedAt: Date.now(),
  };
  await window.api.saveAppearance({ customPets, activePetId: id, petName: editing.name });
  refreshSlots();
  statusEl.textContent = '已切换为「' + editing.name + '」，宠物窗口将更新 ✓';
  setTimeout(() => (statusEl.textContent = ''), 1500);
}

async function deleteCurrent() {
  if (!editing) return;
  if (!confirm('确定删除槽位 ' + (currentSlot + 1) + ' 的「' + (editing.name || '') + '」吗？')) return;
  customPets[currentSlot] = null;
  await window.api.saveAppearance({ customPets, activePetId });
  await selectSlot(currentSlot);
  statusEl.textContent = '已删除 ✓';
  setTimeout(() => (statusEl.textContent = ''), 1500);
}

// ---------- 动画循环 ----------
function tick() {
  if (previewEngine) {
    previewEngine.update(1 / 30);
    previewEngine.draw();
  }
  requestAnimationFrame(tick);
}

// ---------- 事件绑定 ----------
function bindSlotClicks() {
  document.querySelectorAll('.slot').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.classList.contains('system')) return;
      const idx = parseInt(el.dataset.idx, 10);
      if (idx === currentSlot) return;
      selectSlot(idx);
    });
  });
}

saveBtn.addEventListener('click', saveCurrent);
useBtn.addEventListener('click', useCurrent);
deleteBtn.addEventListener('click', deleteCurrent);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.api.closeAppearance();
});

// ---------- 初始化 ----------
(async () => {
  const data = await window.api.getAppearance();
  customPets = (data.customPets || [null, null, null, null, null, null]).slice(0, 6);
  activePetId = data.activePetId || 'cat';
  refreshSlots();
  bindSlotClicks();
  bindOptionListeners();
  bindCanvasEvents();
  // 默认选中当前使用的槽位
  const curIdx = activePetId.startsWith('custom:') ? parseInt(activePetId.split(':')[1], 10) : -1;
  if (curIdx >= 0 && curIdx < 6) await selectSlot(curIdx);
  else await selectSlot(-1);
  tick();
})();
