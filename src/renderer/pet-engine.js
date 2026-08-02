class PixelEngine {
  constructor(canvas, petDef, scale) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pet = petDef;
    this.scale = scale;
    this.anim = 'idle';
    this.frameIdx = 0;
    this.accum = 0;
    this.looping = true;
    this.facing = 1;
    this.paused = false;
    canvas.width = petDef.size.w * scale;
    canvas.height = petDef.size.h * scale;
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = petDef.size.w;
    this.offscreen.height = petDef.size.h;
    this.octx = this.offscreen.getContext('2d');
    this.octx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
  }

  play(name, opts = {}) {
    const frames = this.pet.frames[name];
    if (!frames || frames.length === 0) return;
    this.anim = name;
    this.looping = opts.loop !== false;
    this.frameIdx = 0;
    this.accum = 0;
  }

  update(dt) {
    const meta = this.pet.animMeta[this.anim] || { fps: 4 };
    const frames = this.pet.frames[this.anim];
    if (!frames || frames.length === 0) return;
    if (frames.length > 1) {
      this.accum += dt;
      const interval = 1 / (meta.fps || 4);
      while (this.accum >= interval) {
        this.accum -= interval;
        this.frameIdx++;
        if (this.frameIdx >= frames.length) {
          if (this.looping) this.frameIdx = 0;
          else this.frameIdx = frames.length - 1;
        }
      }
    }
  }

  draw() {
    const frames = this.pet.frames[this.anim] || this.pet.frames.idle;
    const frame = frames[Math.min(this.frameIdx, frames.length - 1)] || frames[0];
    const { w, h } = this.pet.size;
    this.octx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const row = frame[y] || '';
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const color = this.pet.palette[ch];
        if (!color) continue;
        this.octx.fillStyle = color;
        const px = this.facing === 1 ? x : w - 1 - x;
        this.octx.fillRect(px, y, 1, 1);
      }
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
  }
}

window.PixelEngineModule = { PixelEngine };
