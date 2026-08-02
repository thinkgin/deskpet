const cat = require('../src/renderer/pets/cat.js');
const { w: W, h: H } = cat.size;

const ansi = {
  o: '\x1b[38;5;94m',
  w: '\x1b[38;5;231m',
  p: '\x1b[38;5;218m',
  k: '\x1b[38;5;232m',
  r: '\x1b[38;5;210m',
  b: '\x1b[38;5;111m',
  reset: '\x1b[0m',
};

function validate(frames) {
  const errors = [];
  for (const [name, list] of Object.entries(frames)) {
    list.forEach((frame, fi) => {
      if (frame.length !== H) errors.push(`${name}#${fi}: row count ${frame.length} != ${H}`);
      frame.forEach((row, ri) => {
        if (row.length !== W) errors.push(`${name}#${fi} row${ri}: len ${row.length} != ${W}`);
        for (const ch of row) {
          if (ch !== '.' && !cat.palette[ch]) errors.push(`${name}#${fi} row${ri}: unknown char "${ch}"`);
        }
      });
    });
  }
  return errors;
}

const errors = validate(cat.frames);
if (errors.length) {
  console.error('INVALID PET DATA:');
  errors.slice(0, 30).forEach((e) => console.error('  ' + e));
  process.exit(1);
}

function render(frame) {
  return frame
    .map((row) =>
      row
        .split('')
        .map((ch) => (ch === '.' ? '  ' : (ansi[ch] || '') + '██' + ansi.reset))
        .join('')
    )
    .join('\n');
}

for (const name of Object.keys(cat.frames)) {
  console.log(`=== ${name} ===`);
  console.log(render(cat.frames[name][0]));
  console.log('');
}
