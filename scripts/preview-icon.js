// 预览 & 校验应用图标像素画（scripts/icon-art.js）
const { PALETTE, ART, size } = require('./icon-art.js');
const { w: W, h: H } = size;

function validate(rows) {
  const errors = [];
  if (rows.length !== H) errors.push(`row count ${rows.length} != ${H}`);
  rows.forEach((row, ri) => {
    if (row.length !== W) errors.push(`row${ri}: len ${row.length} != ${W}`);
    for (const ch of row) {
      if (ch !== '.' && !PALETTE[ch]) errors.push(`row${ri}: unknown char "${ch}"`);
    }
  });
  return errors;
}

const errors = validate(ART);
if (errors.length) {
  console.error('INVALID ICON ART:');
  errors.slice(0, 30).forEach((e) => console.error('  ' + e));
  process.exit(1);
}

const ansi = {
  o: '\x1b[38;5;94m',
  w: '\x1b[38;5;231m',
  p: '\x1b[38;5;218m',
  k: '\x1b[38;5;232m',
  r: '\x1b[38;5;210m',
  b: '\x1b[38;5;111m',
  reset: '\x1b[0m',
};

console.log(
  ART.map((row) =>
    row
      .split('')
      .map((ch) => (ch === '.' ? '  ' : (ansi[ch] || '') + '██' + ansi.reset))
      .join('')
  ).join('\n')
);
