// 应用图标专用像素画：32x32 像素猫头像
// 调色板字符与宠物通用：o 轮廓 / w 奶油白 / p 粉 / k 深色 / r 腮红 / b 蓝
// '.' 表示透明
const PALETTE = {
  '.': null,
  o: '#4a3b35',
  w: '#fff8f0',
  p: '#ffb7c5',
  k: '#2b2320',
  r: '#ff8f8f',
  b: '#8ecae6',
};

const ART = [
  '......oooo............oooo......',
  '.....owwwoo..........oowwwo.....',
  '.....owwwwwo........owwwwwo.....',
  '....owwwwwwwo......owwwwwwwo....',
  '....owwwwwwwwwwwwwwwwwwwwwww....',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwkkwwwwkkwwwwwwwwo...',
  '...owwwwwwwwkkwwwwkkwwwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwwwwppwwwwwwwwwwwo...',
  '...owwwwwwwwwwwppwwwwwwwwwwwo...',
  '...owwwwwwwwwwwkkwwwwwwwwwwwo...',
  '...owwwwwwwwwwwkkwwwwwwwwwwwo...',
  '...owwwwwwrrwwwwwwwwrrwwwwwwo...',
  '...owwwwwwrrwwwwwwwwrrwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '...owwwwwwwwwwwwwwwwwwwwwwwwo...',
  '....owwwwwwwwwwwwwwwwwwwwwwo....',
  '.....owwwwwwwwwwwwwwwwwwwwo.....',
  '......owwwwwwwwwwwwwwwwwwo......',
  '.......owwwwwwwwwwwwwwwwo.......',
  '........owwwwwwwwwwwwwwo........',
  '.........owwwwwwwwwwwwo.........',
  '..........oooooooooooo..........',
  '................................',
  '................................',
  '................................',
  '................................',
];

module.exports = { PALETTE, ART, size: { w: 32, h: 32 } };
