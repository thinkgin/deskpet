// 打包后清理 dist：只保留当前版本安装包，删除历史版本与临时构建产物
const fs = require('fs');
const path = require('path');
const os = require('os');

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) process.exit(0);

const version = (require(path.resolve(__dirname, '..', 'package.json')).version || '').trim();
const keepExe = `Desktop Pet Setup ${version}.exe`;

const names = fs.readdirSync(distDir);
for (const name of names) {
  const full = path.join(distDir, name);
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    if (name === 'win-unpacked') {
      fs.rmSync(full, { recursive: true, force: true });
      console.log('  removed dir:', name);
    }
    continue;
  }
  // 只删与当前版本不匹配的 .exe/.blockmap 及临时调试文件
  const isOldInstaller = /^Desktop Pet Setup .*\.exe$/.test(name) && name !== keepExe;
  const isOldBlockmap = /^Desktop Pet Setup .*\.exe\.blockmap$/.test(name) && name !== `${keepExe}.blockmap`;
  if (isOldInstaller || isOldBlockmap || name === 'builder-debug.yml') {
    fs.rmSync(full, { force: true });
    console.log('  removed:', name);
  }
}
