// 像素宠物组合引擎：模板拼装 + 20x20 画布 + 动画自动生成
// 在渲染层暴露 window.__pixelCompose；在 Node 下支持 module.exports 便于测试
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof window !== 'undefined') window.__pixelCompose = mod;
})(this, function () {
  const W = 20, H = 20;

  // 配色方案（调色板字符 -> 颜色）
  const SCHEMES = {
    cream:  { o: '#4a3b35', w: '#fff8f0', p: '#ffb7c5', k: '#2b2320', r: '#ff8f8f', b: '#8ecae6' },
    orange: { o: '#5a3d2b', w: '#ffc9a3', p: '#ffe0c9', k: '#33241a', r: '#ff9a9a', b: '#ffd9a0' },
    blue:   { o: '#2f3e56', w: '#a9c7f0', p: '#d7e6ff', k: '#20283a', r: '#ff9aa8', b: '#7fb3ff' },
    green:  { o: '#3b4a2f', w: '#bfe3b0', p: '#e2f0d9', k: '#26331f', r: '#ffb08f', b: '#8fce7f' },
    purple: { o: '#44365e', w: '#cdb8f0', p: '#e8dcff', k: '#2b213f', r: '#ff9ad0', b: '#b08fff' },
    pink:   { o: '#5a2f44', w: '#ffd3e0', p: '#ffe6ee', k: '#3a2131', r: '#ff8fb0', b: '#ffb3c7' },
  };

  const SCHEME_NAMES = {
    cream: '奶油白', orange: '蜜橘橙', blue: '雾霾蓝',
    green: '抹茶绿', purple: '香芋紫', pink: '蜜桃粉',
  };

  // 部件选项
  const EAR_TYPES = { cat: '猫耳', bunny: '兔耳', bear: '熊耳', none: '无' };
  const EYE_STYLES = { round: '圆眼', sleepy: '眯眼', happy: '笑眼' };
  const MOUTH_STYLES = { smile: '微笑', cat: '猫嘴', open: '张嘴' };

  const DEFAULT_OPTIONS = { scheme: 'cream', ear: 'cat', eye: 'round', mouth: 'smile', cheeks: true };

  // ---------- 画布基础工具 ----------
  function blankGrid() {
    return Array.from({ length: H }, () => Array(W).fill('.'));
  }
  function set(g, x, y, c) {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c;
  }
  function hline(g, x0, x1, y, c) {
    for (let x = x0; x <= x1; x++) set(g, x, y, c);
  }
  function vline(g, x, y0, y1, c) {
    for (let y = y0; y <= y1; y++) set(g, x, y, c);
  }
  function rows(g) {
    return g.map((r) => r.join(''));
  }
  function fromRows(arr) {
    return arr.map((s) => String(s).padEnd(W, '.').split(''));
  }
  function clone(g) {
    return g.map((r) => r.slice());
  }

  // 对称镜像：以 x=(W-1)/x=9.5 为轴左右对称（保证两只耳朵/眼睛等样）
  const mirrorX = (x) => (W - 1) - x;

  // 身体：圆润「团子」大圆头，半身猃铃大圆，萌宠比例
  function drawBody(g, cx = 10, cy = 10, rx = 7.2, ry = 6.4) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          const odx = (x - cx) / (rx + 0.5), ody = (y - cy) / (ry + 0.5);
          g[y][x] = odx * odx + ody * ody >= 0.8 ? 'o' : 'w';
        }
      }
    }
  }

  // 耳朵：给出一只耳（左），自动镜像生成右耳
  function drawEarPix(g, leftEar) {
    std: for (const [x, y, c] of leftEar) {
      set(g, x, y, c);
      set(g, mirrorX(x), y, c); // 同时画在右侧对称位置
    }
  }

  function drawEars(g, type) {
    if (type === 'cat') {
      drawEarPix(g, [
        // 圆润三角猫耳，顶端略圆，带粉内耳 + w 高光
        [5, 0, 'o'], [6, 0, 'o'],
        [4, 1, 'o'], [5, 1, 'p'], [6, 1, 'w'], [7, 1, 'o'],
        [3, 2, 'o'], [4, 2, 'o'], [5, 2, 'p'], [6, 2, 'w'], [7, 2, 'o'], [8, 2, 'o'],
        [3, 3, 'o'], [4, 3, 'o'], [5, 3, 'w'], [6, 3, 'w'], [7, 3, 'o'], [8, 3, 'o'],
      ]);
    } else if (type === 'bunny') {
      drawEarPix(g, [
        // 长圆兔耳，更宽，内有粉/高光，末端圆润
        [4, 0, 'o'], [5, 0, 'o'], [6, 0, 'o'], [7, 0, 'o'],
        [4, 1, 'o'], [5, 1, 'p'], [6, 1, 'w'], [7, 1, 'o'],
        [4, 2, 'o'], [5, 2, 'p'], [6, 2, 'w'], [7, 2, 'o'],
        [4, 3, 'o'], [5, 3, 'p'], [6, 3, 'w'], [7, 3, 'o'],
        [3, 4, 'o'], [4, 4, 'o'], [5, 4, 'p'], [6, 4, 'w'], [7, 4, 'o'], [8, 4, 'o'],
      ]);
    } else if (type === 'bear') {
      drawEarPix(g, [
        // 圆圆小耳，贴头顶，内粉
        [4, 1, 'o'], [5, 1, 'o'], [6, 1, 'p'], [7, 1, 'o'], [8, 1, 'o'],
        [4, 2, 'p'], [5, 2, 'w'], [6, 2, 'w'], [7, 2, 'w'], [8, 2, 'p'],
        [4, 3, 'o'], [5, 3, 'o'], [6, 3, 'o'], [7, 3, 'o'], [8, 3, 'o'],
      ]);
    }
  }

  function drawEyes(g, style) {
    // 眼位信息统一为 box：每个眼睛一个 {x0,y0,x1,y1,cx,cy}
    const L = { x0: 5, y0: 6, x1: 7, y1: 8, cx: 6, cy: 7 };
    const R = { x0: 12, y0: 6, x1: 14, y1: 8, cx: 13, cy: 7 };
    if (style === 'round') {
      // 大圆眼 3x3：深色 + 高光，最萌
      for (let y = 6; y <= 8; y++) for (let x = 5; x <= 7; x++) set(g, x, y, 'k');
      set(g, 5, 6, 'w'); // 高光
      for (let y = 6; y <= 8; y++) for (let x = 12; x <= 14; x++) set(g, x, y, 'k');
      set(g, 14, 6, 'w'); // 高光
      return { eyes: [L, R] };
    } else if (style === 'sleepy') {
      // 眯眯眼：一条横线
      hline(g, 4, 8, 7, 'k'); hline(g, 11, 15, 7, 'k');
      return {
        eyes: [
          { x0: 4, y0: 7, x1: 8, y1: 7, cx: 6, cy: 7 },
          { x0: 11, y0: 7, x1: 15, y1: 7, cx: 13, cy: 7 },
        ],
      };
    } else {
      // 笑眼：干净弯弧 ^^
      set(g, 5, 7, 'k'); set(g, 6, 6, 'k'); set(g, 7, 7, 'k'); set(g, 6, 7, 'w');
      set(g, 12, 7, 'k'); set(g, 13, 6, 'k'); set(g, 14, 7, 'k'); set(g, 13, 7, 'w');
      return { eyes: [L, R] };
    }
  }

  function drawCheeks(g, on) {
    if (!on) return [];
    const e = [[4, 9, 'r'], [5, 9, 'r'], [14, 9, 'r'], [15, 9, 'r']];
    e.forEach((r) => set(g, r[0], r[1], r[2]));
    return [{ x: 4, y: 9 }, { x: 5, y: 9 }, { x: 15, y: 9 }, { x: 14, y: 9 }];
  }

  function drawMouth(g, style) {
    if (style === 'smile') {
      set(g, 8, 10, 'k'); set(g, 9, 11, 'k'); set(g, 10, 10, 'k');
    } else if (style === 'cat') {
      set(g, 8, 10, 'k'); set(g, 9, 11, 'k'); set(g, 10, 10, 'k'); set(g, 9, 9, 'k');
    } else {
      // 张嘴：小圆+粉舌
      set(g, 8, 10, 'o'); set(g, 9, 10, 'k'); set(g, 10, 10, 'o'); set(g, 9, 11, 'p');
    }
    return { x: 9, y: 10 };
  }

  function drawFeet(g) {
    // 迷你很小的圆圆小脚
    const foot = (x0) => {
      set(g, x0, 16, 'w'); set(g, x0 + 1, 16, 'o'); set(g, x0 + 2, 16, 'w');
      set(g, x0, 17, 'o'); set(g, x0 + 1, 17, 'w'); set(g, x0 + 2, 17, 'o');
    };
    foot(4); foot(13);
    return { left: { x0: 4, x1: 6 }, right: { x0: 13, x1: 15 }, y0: 16, y1: 17 };
  }

  // ---------- 生成基准形象 ----------
  function generateBase(options) {
    const o = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const g = blankGrid();
    drawEars(g, o.ear);
    drawBody(g);
    const { eyes } = drawEyes(g, o.eye);
    const cheeks = drawCheeks(g, o.cheeks);
    const mouth = drawMouth(g, o.mouth);
    const feet = drawFeet(g);
    return {
      options: o,
      base: rows(g),
      parts: { eyes, cheeks, mouth, feet },
    };
  }

  // ---------- 动画自动生成（基于 base + parts 推导） ----------
  function gridFromBase(base) {
    return fromRows(Array.isArray(base) ? base : base.split('\n'));
  }
  const isBox = (e) => e && typeof e.cx === 'number';

  // 闭眼：清掉眼区画一条横线（眯眼）
  function closedEyes(g, eyes) {
    for (const e of eyes) {
      if (!isBox(e)) continue;
      for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) g[y][x] = 'w';
      hline(g, e.x0, e.x1, e.cy, 'k');
    }
  }
  // 笑眼：清掉眼区画弯弧 ^^
  function happyEyes(g, eyes) {
    for (const e of eyes) {
      if (!isBox(e)) continue;
      for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) g[y][x] = 'w';
      set(g, e.cx - 1, e.cy + 1, 'k'); set(g, e.cx, e.cy - 1, 'k'); set(g, e.cx + 1, e.cy + 1, 'k');
    }
  }
  // 惊讶眼：睁大，眼内高光
  function surprisedEyes(g, eyes) {
    for (const e of eyes) {
      if (!isBox(e)) continue;
      for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) g[y][x] = 'k';
      set(g, e.cx, e.cy - 1, 'w'); set(g, e.cx - 1, e.cy, 'w');
      set(g, e.cx, e.cy + 1, 'w'); set(g, e.cx + 1, e.cy, 'w');
    }
  }

  function blinkFrame(base, parts) {
    const g = gridFromBase(base);
    closedEyes(g, parts.eyes);
    return rows(g);
  }
  function sleepFrame(base, parts) {
    const g = gridFromBase(base);
    closedEyes(g, parts.eyes);
    return rows(g);
  }
  function happyFrame(base, parts) {
    const g = gridFromBase(base);
    happyEyes(g, parts.eyes);
    const m = parts.mouth || { x: 9, y: 10 };
    set(g, m.x - 1, m.y, 'w'); set(g, m.x, m.y, 'w'); set(g, m.x + 1, m.y, 'w');
    set(g, m.x - 1, m.y + 1, 'k'); set(g, m.x, m.y + 1, 'k'); set(g, m.x + 1, m.y + 1, 'k');
    return rows(g);
  }

  // 难过：嘴角下垂
  function frownFrame(base, parts) {
    const g = gridFromBase(base);
    const m = parts.mouth || { x: 9, y: 10 };
    set(g, m.x - 1, m.y, 'w'); set(g, m.x, m.y, 'w'); set(g, m.x + 1, m.y, 'w');
    set(g, m.x, m.y + 1, 'w');
    set(g, m.x - 1, m.y - 1, 'k'); set(g, m.x + 1, m.y - 1, 'k'); set(g, m.x, m.y + 1, 'k');
    return rows(g);
  }

  // 张嘴（吃/说话）
  function mouthOpenFrame(base, parts) {
    const g = gridFromBase(base);
    const m = parts.mouth || { x: 9, y: 7 };
    set(g, m.x - 1, m.y, 'o'); set(g, m.x, m.y, 'p'); set(g, m.x + 1, m.y, 'o');
    set(g, m.x - 1, m.y + 1, 'o'); set(g, m.x, m.y + 1, 'k'); set(g, m.x + 1, m.y + 1, 'o');
    return rows(g);
  }

  // 拖拽惊讶：瞪眼 + 张嘴
  function dragFrame(base, parts) {
    const g = gridFromBase(base);
    surprisedEyes(g, parts.eyes);
    const m = parts.mouth || { x: 9, y: 10 };
    set(g, m.x, m.y, 'p'); set(g, m.x, m.y + 1, 'k');
    return rows(g);
  }

  // 走路：两只小脚交替贴地轻摆（不破坏身体）
  function walkFrame(base, parts) {
    const g = gridFromBase(base);
    const ft = parts.feet || { left: { x0: 4, x1: 6 }, right: { x0: 13, x1: 15 }, y0: 16, y1: 17 };
    const save = (x0, x1) => {
      const m = [];
      for (let y = ft.y0; y <= ft.y1; y++) { const row = []; for (let x = x0; x <= x1; x++) row.push(g[y][x]); m.push(row); }
      return m;
    };
    const clearCols = (x0, x1) => {
      for (let y = ft.y0; y <= ft.y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = '.';
    };
    const paste = (m, dx, x0) => {
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
        const nx = x0 + x + dx;
        if (nx >= 0 && nx < W && y + ft.y0 < H && m[y][x] !== '.') g[y + ft.y0][nx] = m[y][x];
      }
    };
    // 左脚本抬起、右脚本落地（右脚纹丝不动，左脚本后撤）
    const l = save(ft.left.x0, ft.left.x1);
    clearColsWrap(g, ft.left.x0, ft.left.x1, ft.y0, ft.y1);
    paste(l, -1, ft.left.x0);
    return rows(g);
  }

  function clearColsWrap(g, x0, x1, y0, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = '.';
  }

  const ANIM_META = {
    idle: { loop: true, fps: 4 },
    blink: { loop: false, fps: 2 },
    happy: { loop: true, fps: 6 },
    sad: { loop: true, fps: 3 },
    sleep: { loop: true, fps: 2 },
    eat: { loop: true, fps: 4 },
    talk: { loop: true, fps: 5 },
    drag: { loop: true, fps: 4 },
    walk: { loop: true, fps: 6 },
  };

  // 由 base + parts 构建完整 frames
  function buildFrames(base, parts) {
    return {
      idle: [base, base, base, base],
      blink: [blinkFrame(base, parts)],
      happy: [happyFrame(base, parts)],
      sad: [frownFrame(base, parts)],
      sleep: [sleepFrame(base, parts)],
      eat: [mouthOpenFrame(base, parts), base],
      talk: [mouthOpenFrame(base, parts), base],
      drag: [dragFrame(base, parts)],
      walk: [base, walkFrame(base, parts)],
    };
  }

  // 把保存的自定义形象数据构建成 petDef（供引擎使用）
  function buildPetDef(custom) {
    const palette = custom.palette || SCHEMES.cream;
    const base = Array.isArray(custom.base) ? custom.base.slice() : [];
    const parts = custom.parts || { eyes: [], cheeks: [], mouth: { x: 9, y: 10 }, feet: { left: { x0: 4, x1: 6 }, right: { x0: 13, x1: 15 }, y0: 16, y1: 17 } };
    return {
      id: custom.id || 'custom',
      name: custom.name || '自定义',
      type: 'pixel',
      size: { w: W, h: H },
      palette,
      frames: buildFrames(base, parts),
      animMeta: ANIM_META,
      baseStats: { hunger: 80, mood: 80, clean: 80, health: 90, affection: 0 },
    };
  }

  // 新建空的自定义形象数据
  function createCustom(id, name, options) {
    const gen = generateBase(options);
    return {
      id,
      name: name || '自定义宠物',
      palette: SCHEMES[gen.options.scheme] ? { ...SCHEMES[gen.options.scheme] } : { ...SCHEMES.cream },
      base: gen.base,
      parts: gen.parts,
      options: gen.options,
      updatedAt: Date.now(),
    };
  }

  // 迁移：旧版使用 16x16，若尺寸不符(sized less than W/H) 则用保存的 options 重新生成
  function migrateCustom(cp) {
    if (!cp || !cp.base) return cp;
    const rows_ = cp.base.length;
    const cols_ = cp.base[0] ? cp.base[0].length : 0;
    if (rows_ !== H || cols_ !== W) {
      const o = { ...DEFAULT_OPTIONS, ...(cp.options || {}) };
      const gen = generateBase(o);
      cp.base = gen.base;
      cp.parts = gen.parts;
      cp.palette = { ...(SCHEMES[o.scheme] || SCHEMES.cream) };
      cp.options = o;
      cp.updatedAt = Date.now();
    }
    return cp;
  }

  return {
    W, H,
    SCHEMES,
    SCHEME_NAMES,
    EAR_TYPES,
    EYE_STYLES,
    MOUTH_STYLES,
    DEFAULT_OPTIONS,
    generateBase,
    buildFrames,
    buildPetDef,
    createCustom,
    migrateCustom,
    ANIM_META,
  };
});