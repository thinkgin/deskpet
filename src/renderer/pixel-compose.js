// 像素宠物组合引擎：模板拼装 + 16x16 画布 + 动画自动生成
// 在渲染层暴露 window.__pixelCompose；在 Node 下支持 module.exports 便于测试
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof window !== 'undefined') window.__pixelCompose = mod;
})(this, function () {
  const W = 16, H = 16;

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

  // ---------- 画布基础工具（grid 里存调色板字符，颜色经 palette 映射） ----------
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

  // 身体：椭圆轮廓 + 填充
  function drawBody(g, cx = 7.5, cy = 9.0, rx = 5.6, ry = 5.0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          const odx = (x - cx) / (rx + 0.45), ody = (y - cy) / (ry + 0.45);
          g[y][x] = odx * odx + ody * ody >= 0.8 ? 'o' : 'w';
        }
      }
    }
  }

  function drawEars(g, type) {
    if (type === 'cat') {
      // 左耳
      set(g, 4, 0, 'o'); set(g, 5, 0, 'o');
      hline(g, 3, 5, 1, 'o'); set(g, 4, 1, 'w');
      hline(g, 2, 6, 2, 'o'); set(g, 3, 2, 'w'); set(g, 4, 2, 'w'); set(g, 5, 2, 'w');
      set(g, 4, 1, 'p');
      // 右耳
      set(g, 10, 0, 'o'); set(g, 11, 0, 'o');
      hline(g, 10, 12, 1, 'o'); set(g, 11, 1, 'w');
      hline(g, 9, 13, 2, 'o'); set(g, 10, 2, 'w'); set(g, 11, 2, 'w'); set(g, 12, 2, 'w');
      set(g, 11, 1, 'p');
    } else if (type === 'bunny') {
      hline(g, 3, 5, 0, 'o'); set(g, 4, 0, 'w');
      hline(g, 3, 5, 1, 'o'); set(g, 4, 1, 'w');
      hline(g, 3, 5, 2, 'o'); set(g, 4, 2, 'w');
      set(g, 4, 0, 'p'); set(g, 4, 1, 'p');
      hline(g, 10, 12, 0, 'o'); set(g, 11, 0, 'w');
      hline(g, 10, 12, 1, 'o'); set(g, 11, 1, 'w');
      hline(g, 10, 12, 2, 'o'); set(g, 11, 2, 'w');
      set(g, 11, 0, 'p'); set(g, 11, 1, 'p');
    } else if (type === 'bear') {
      const ear = (cx) => {
        set(g, cx, 1, 'o'); set(g, cx + 1, 1, 'o'); set(g, cx + 2, 1, 'o');
        set(g, cx, 2, 'o'); set(g, cx + 1, 2, 'p'); set(g, cx + 2, 2, 'o');
        set(g, cx + 1, 3, 'o');
      };
      ear(2); ear(11);
    }
  }

  function drawEyes(g, style) {
    if (style === 'round') {
      vline(g, 5, 6, 7, 'k'); vline(g, 10, 6, 7, 'k');
      return [{ x: 5, y: 6 }, { x: 5, y: 7 }, { x: 10, y: 6 }, { x: 10, y: 7 }];
    } else if (style === 'sleepy') {
      hline(g, 4, 6, 6, 'k'); hline(g, 9, 11, 6, 'k');
      return [{ x: 5, y: 6 }, { x: 10, y: 6 }];
    } else {
      set(g, 4, 7, 'k'); set(g, 5, 6, 'k'); set(g, 6, 7, 'k');
      set(g, 9, 7, 'k'); set(g, 10, 6, 'k'); set(g, 11, 7, 'k');
      return [{ x: 5, y: 7 }, { x: 10, y: 7 }];
    }
  }

  function drawCheeks(g, on) {
    if (!on) return [];
    set(g, 3, 8, 'r'); set(g, 12, 8, 'r');
    return [{ x: 3, y: 8 }, { x: 12, y: 8 }];
  }

  function drawMouth(g, style) {
    if (style === 'smile') {
      set(g, 6, 9, 'k'); set(g, 7, 10, 'k'); set(g, 8, 9, 'k');
    } else if (style === 'cat') {
      set(g, 6, 10, 'k'); set(g, 7, 9, 'k'); set(g, 8, 10, 'k');
    } else {
      set(g, 6, 9, 'o'); set(g, 7, 9, 'p'); set(g, 8, 9, 'o'); set(g, 7, 10, 'k');
    }
    return { x: 7, y: 9 };
  }

  function drawFeet(g) {
    const foot = (x0) => {
      set(g, x0, 12, 'o'); set(g, x0 + 1, 12, 'w'); set(g, x0 + 2, 12, 'o');
      set(g, x0, 13, 'o'); set(g, x0 + 1, 13, 'w'); set(g, x0 + 2, 13, 'o');
      set(g, x0, 14, 'o'); set(g, x0 + 1, 14, 'o'); set(g, x0 + 2, 14, 'o');
    };
    foot(3); foot(10);
    return { left: { x0: 3, x1: 5 }, right: { x0: 10, x1: 12 }, y0: 12, y1: 14 };
  }

  // ---------- 生成基准形象 ----------
  function generateBase(options) {
    const o = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const g = blankGrid();
    drawEars(g, o.ear);
    drawBody(g);
    const eyes = drawEyes(g, o.eye);
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

  // 闭眼：在眼位画横线
  function blinkFrame(base, parts) {
    const g = gridFromBase(base);
    for (const e of parts.eyes) {
      set(g, e.x, e.y + 1, 'w');
      set(g, e.x - 1, e.y, 'k');
      set(g, e.x, e.y, 'k');
      set(g, e.x + 1, e.y, 'k');
    }
    return rows(g);
  }

  // 笑：眯眼 ^ + 微笑嘴
  function happyFrame(base, parts) {
    const g = gridFromBase(base);
    for (const e of parts.eyes) {
      if (parts.eyes.length > 2) { set(g, e.x, e.y + 1, 'w'); set(g, e.x, e.y, 'w'); }
    }
    const exs = [];
    for (const e of parts.eyes) {
      if (exs.indexOf(e.x) < 0) exs.push(e.x);
    }
    for (const ex of exs) {
      const ey = parts.eyes.filter((e) => e.x === ex)[0].y;
      set(g, ex - 1, ey + 1, 'k'); set(g, ex, ey, 'k'); set(g, ex + 1, ey + 1, 'k');
    }
    const m = parts.mouth || { x: 7, y: 9 };
    set(g, m.x - 1, m.y, 'w'); set(g, m.x, m.y, 'w'); set(g, m.x + 1, m.y, 'w');
    set(g, m.x - 1, m.y + 1, 'k'); set(g, m.x, m.y + 1, 'k'); set(g, m.x + 1, m.y + 1, 'k');
    return rows(g);
  }

  // 难过：嘴角下垂
  function frownFrame(base, parts) {
    const g = gridFromBase(base);
    const m = parts.mouth || { x: 7, y: 9 };
    set(g, m.x - 1, m.y, 'w'); set(g, m.x, m.y, 'w'); set(g, m.x + 1, m.y, 'w');
    set(g, m.x, m.y - 1, 'w');
    set(g, m.x - 1, m.y - 1, 'k'); set(g, m.x + 1, m.y - 1, 'k'); set(g, m.x, m.y + 1, 'k');
    return rows(g);
  }

  // 张嘴（吃/说话）
  function mouthOpenFrame(base, parts) {
    const g = gridFromBase(base);
    const m = parts.mouth || { x: 7, y: 9 };
    set(g, m.x - 1, m.y, 'o'); set(g, m.x, m.y, 'p'); set(g, m.x + 1, m.y, 'o');
    set(g, m.x - 1, m.y + 1, 'o'); set(g, m.x, m.y + 1, 'k'); set(g, m.x + 1, m.y + 1, 'o');
    return rows(g);
  }

  // 拖拽惊讶：瞪眼 + 张嘴
  function dragFrame(base, parts) {
    const g = gridFromBase(base);
    for (const e of parts.eyes) {
      set(g, e.x, e.y, 'o');
      set(g, e.x, e.y + (parts.eyes.length > 2 ? 1 : 0), 'w');
    }
    const m = parts.mouth || { x: 7, y: 9 };
    set(g, m.x, m.y, 'p'); set(g, m.x, m.y + 1, 'k');
    return rows(g);
  }

  // 走路：双脚交错前迈
  function walkFrame(base, parts) {
    const g = gridFromBase(base);
    const ft = parts.feet || { left: { x0: 3, x1: 5 }, right: { x0: 10, x1: 12 }, y0: 12, y1: 14 };
    const grab = (x0, x1) => {
      const m = [];
      for (let y = ft.y0; y <= ft.y1; y++) { const row = []; for (let x = x0; x <= x1; x++) row.push(g[y][x]); m.push(row); }
      return m;
    };
    const paste = (m, dx) => {
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
        const nx = x + dx, ny = ft.y0 + y;
        if (nx >= 0 && nx < W && ny < H && m[y][x] !== '.') g[ny][nx] = m[y][x];
      }
    };
    const l = grab(ft.left.x0, ft.left.x1);
    const r = grab(ft.right.x0, ft.right.x1);
    for (let y = ft.y0; y <= ft.y1; y++) for (let x = ft.left.x0; x <= ft.right.x1; x++) g[y][x] = '.';
    paste(l, 1); paste(r, -1);
    return rows(g);
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
      sleep: [blinkFrame(base, parts)],
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
    const parts = custom.parts || { eyes: [], cheeks: [], mouth: { x: 7, y: 9 }, feet: { left: { x0: 3, x1: 5 }, right: { x0: 10, x1: 12 }, y0: 12, y1: 14 } };
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
    ANIM_META,
  };
});
