const { deflateSync } = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const { PALETTE, ART } = require(path.join(__dirname, 'icon-art.js'));
const SIZE = 256;

function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function render(size) {
  const zoom = size / 32;
  const buf = Buffer.alloc(size * size * 4, 0);
  for (let gy = 0; gy < 32; gy++) {
    const row = ART[gy] || '';
    for (let gx = 0; gx < 32; gx++) {
      const ch = row[gx];
      if (!ch || ch === '.' || !PALETTE[ch]) continue;
      const [r, g, b] = rgb(PALETTE[ch]);
      for (let i = 0; i < zoom; i++) {
        for (let j = 0; j < zoom; j++) {
          const x = Math.round(gx * zoom) + i;
          const y = Math.round(gy * zoom) + j;
          if (x >= size || y >= size) continue;
          const idx = (y * size + x) * 4;
          buf[idx] = r;
          buf[idx + 1] = g;
          buf[idx + 2] = b;
          buf[idx + 3] = 255;
        }
      }
    }
  }
  return buf;
}

const px = render(SIZE);

fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), encodePNG(SIZE, SIZE, px));

function makeICO() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const entries = [];
  const datas = [];
  let offset = 6 + sizes.length * 16;
  for (const s of sizes) {
    const data = encodePNG(s, s, render(s));
    entries.push(Buffer.from([s === 256 ? 0 : s, s === 256 ? 0 : s, 0, 0, 1, 0, 32, 0, data.length & 0xff, (data.length >> 8) & 0xff, (data.length >> 16) & 0xff, (data.length >> 24) & 0xff, offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff, (offset >> 24) & 0xff]));
    datas.push(data);
    offset += data.length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.ico'), Buffer.concat([header, ...entries, ...datas]));
}

makeICO();
console.log('icon.png + icon.ico generated');
