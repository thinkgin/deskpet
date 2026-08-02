# 桌面宠物·陪伴 —— 项目完整说明

> 像素风桌面宠物应用，主打情感陪伴，类似当年的 QQ 宠物。
> 基于 Electron 33 开发，可打包成 Windows 安装包，安装即用。

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [快速开始](#4-快速开始)
5. [功能说明](#5-功能说明)
6. [架构说明](#6-架构说明)
7. [数据持久化](#7-数据持久化)
8. [宠物系统与扩展](#8-宠物系统与扩展)
9. [打包与分发](#9-打包与分发)
10. [已知问题与注意事项](#10-已知问题与注意事项)
11. [开发日志与未来规划](#11-开发日志与未来规划)

---

## 1. 项目概述

这是一个运行在桌面上的像素宠物「咪咪」（一只小猫），它像当年的 QQ 宠物一样：

- 住在透明置顶的小窗口里，会在桌面上走动、睡觉、待机；
- 有**养成数值**（饱食 / 心情 / 清洁 / 健康 / 亲密度），随时间衰减，需要主人投喂、玩耍、洗澡维持；
- 会**说话**（头顶气泡），主动问候、报忧、送节日祝福；
- 可以接入 **AI 大模型 API** 真正陪聊，留空则用内置语录兜底；
- 常驻系统托盘，退出后仍可随时唤出。

整体是一个**插件化、可扩展**的宠物框架：渲染引擎与宠物定义解耦，新增宠物只需要加一个 JS 数据文件。

---

## 2. 技术栈

| 技术 | 用途 | 版本 |
| ---- | ---- | ---- |
| Electron | 桌面应用框架（透明无边框窗口 / 托盘 / 通知 / IPC） | ^33.0.0 |
| electron-builder | Windows 安装包打包 | ^25.1.8 |
| 原生 Canvas 2D | 像素宠物渲染（无第三方渲染库） | - |
| WebAudio API | 程序化合成音效（喵叫、进食、玩闹等，无音频文件） | - |
| Node.js | 构建脚本、JSON 持久化 | v24.14.1（开发环境） |

**关键设计原则**

- 渲染零依赖：宠物是「纯数据」JS 文件（调色板 + 字符画帧 + 动画参数），引擎只负责按帧绘制；
- 主进程与渲染进程通过 `preload.js` 的 `contextBridge` 通信（`contextIsolation: true`，`nodeIntegration: false`）；
- 所有用户数据为本地 JSON 文件，保存在 Electron 的 `userData` 目录。

---

## 3. 目录结构

```
cartoonwife/
├── main.js                        # 主进程：窗口、托盘、AI 对话、提醒、持久化 IPC
├── preload.js                     # contextBridge 安全桥接，暴露 window.api
├── package.json                   # 应用信息、脚本、electron-builder 配置
├── README.md                      # 简洁使用指南
├── DOCUMENTATION.md               # 本文档（完整说明）
├── build/
│   ├── icon.ico                   # 应用 / 安装包图标（多尺寸）
│   └── icon.png                   # 大图 PNG 图标
├── scripts/
│   ├── make-icon.js               # 由像素画自动生成 icon.png + icon.ico（纯 Node，无依赖）
│   └── preview-pet.js             # 在终端以颜色块预览像素画效果
├── src/
│   └── renderer/                  # 渲染进程（UI）
│       ├── index.html             # 宠物主窗口（透明，无边框）
│       ├── styles.css             # 全局样式
│       ├── app.js                 # 主窗口逻辑：动画状态机、衰减、互动、问候、自动走动
│       ├── pet-engine.js          # 像素渲染引擎（PixelEngine 类）
│       ├── chat.html / chat.js    # 聊天窗口（可拖拽、消息历史）
│       ├── settings.html / settings.js  # 设置窗口（宠物/名字/音效/AI 配置）
│       └── pets/
│           ├── index.js           # 宠物注册表（供未来 Node 侧调用）
│           └── cat.js             # 像素小猫定义（新宠物的参考模板）
└── dist/                          # 打包产物
    └── Desktop Pet Setup 1.1.0.exe   # 最终安装包
```

---

## 4. 快速开始

### 4.1 直接安装（已打包）

- 安装包：`dist/Desktop Pet Setup 1.1.0.exe`
- 双击安装（非一键式，可改安装目录），安装完成后桌面会生成「桌面宠物·陪伴」快捷方式。
- 启动后：宠物出现在屏幕左下区域，右下角系统托盘出现宠物图标。

### 4.2 从源码运行

```bash
npm install
npm start
```

> 若在无沙箱权限的环境（如部分虚拟化环境）运行失败，可加环境变量：
> `ELECTRON_DISABLE_SANDBOX=1 npm start`

### 4.3 常用脚本

| 命令 | 说明 |
| ---- | ---- |
| `npm start` | 开发模式运行 |
| `npm run pack` | 打包 Windows NSIS 安装包（产物在 `dist/`） |
| `npm run pack:dir` | 只产出免安装目录（`dist/win-unpacked/`） |
| `npm run icon` | 重新从像素画生成图标 |
| `npm run preview` | 终端预览像素画 |

### 4.4 网络受限环境的打包

本项目开发时 GitHub 无法直接访问，electron / electron-builder 二进制均通过 npmmirror 镜像获取，打包前需设置：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run pack
```

详细打包排障见 [第 9 节](#9-打包与分发)。

---

## 5. 功能说明

### 5.1 养成系统

五个数值（0 ~ 100）：

| 数值 | 含义 | 衰减速率（/小时） | 提升方式 |
| ---- | ---- | ---- | ---- |
| hunger | 饱食 | 3.2 | 喂食 |
| mood | 心情 | 2.0 | 玩耍 / 戳它 |
| clean | 清洁 | 2.6 | 洗澡 |
| health | 健康 | 0.6 | 由其他三项联动 |
| affection | 亲密度（当前会话显示值） | - | 喂食 / 玩耍 / 洗澡 / 戳 |

- **实时衰减**：运行中每分钟计算一次（`app.js` 的 `tick()`，`stateTick >= 60`）。
- **离线衰减**：再次启动时按距上次保存的小时数一次性结算，上限 48 小时（`applyDecay`）。
- **健康联动**：hunger < 25 扣 20、clean < 25 扣 10、mood < 25 扣 15，整体偏低时 health 缓慢下降，整体健康时缓慢恢复（`healthFromOthers`）。
- **情绪文案**：`moodText()` 根据数值生成「开心 / 还行 / 有点失落 / 需要关注 / 健康」等状态。
- **主动求助**：hunger 或 clean 低于 30 时，宠物会主动说话求喂食 / 洗澡。

### 5.2 互动反应

| 操作 | 效果 |
| ---- | ---- |
| 左键点击宠物（无拖拽） | 戳它：喵叫 + blink 动画 + 心情/亲密度上升，头顶气泡「主人戳我啦~」 |
| 按住左键拖拽 | 拖动宠物在桌面任意方向移动（主进程 clamp 在工作区内） |
| 右键点击 | 弹出操作按钮：🍰喂食 / 🎾玩耍 / 🛁洗澡 / 💬聊天 |
| 托盘右键菜单 | 聊天 / 喂食 / 玩耍 / 洗澡 / 设置 / 退出 |
| 拖拽聊天窗标题栏 | 移动聊天窗口自身（不会带动宠物，二者独立） |

- 音效全部由 WebAudio 程序化合成（`makeMeow` / `makeEat` / `makePlay` / `makeSplash` / `makePop`），无音频资源文件；
- 喂食播放 `eat` 动画、玩耍播放 `happy`、洗澡播放 `sad`（猫咪洗澡会委屈），结束后回 `idle`；
- **拖拽采用绝对坐标定位**（按下时记录窗口起始位置，拖动时 = 起始位置 + 鼠标位移），不依赖增量累加，横纵方向均稳定、无漂移；聊天窗口由 `moveChatTo` 独立移动。

### 5.3 可调大小与点击穿透

- **默认缩小**：宠物默认放大倍数为 5（原版 10 的一半），窗口也随之缩小；
- **自定义尺寸**：设置面板「宠物尺寸」可在迷你(3) ~ 巨大(12) 间选择，保存后主进程立即调整宠物窗口大小（`getPetWindowSize()`），渲染进程重载应用；
- **点击穿透**：宠物窗口使用 `setIgnoreMouseEvents(true, { forward: true })` 开启穿透，渲染进程在 `mousemove` 时按像素判定——鼠标落在宠物**不透明像素**或操作菜单上才设为可交互，其余区域（透明背景）点击直接穿透到桌面，**不会挡住页面其他内容**；
- 鼠标离开宠物窗口时自动恢复穿透并收起操作菜单。

### 5.4 气泡对话

- 宠物头顶气泡说话，可配置显示时长（默认 2.6s，节日 4s）；
- 触发时机：首次互动、问候、节日祝福、数值过低求助、随机走动的碎碎念。

### 5.5 AI 对话

- 聊天窗口（360×480，无边框，可拖拽，常驻置顶）；
- 打开时自动贴近宠物窗口右侧（若右侧放不下则放左侧），避免和宠物分离；拖拽标题栏只移动聊天窗口本身；
- 支持**任意 OpenAI 兼容接口**：在设置里填 `BaseURL` + `API Key` + `Model`；
- 请求走 `POST {baseUrl}/chat/completions`，系统提示词可自定义（默认塑造为住在桌面上、叫「咪咪」的粘人小猫），只传最近 20 条消息；
- 未配置 Key 或请求失败时，自动回落到 `localChat()` 内置中文语录（根据关键词「饿/睡/难过/早安/喜欢/天气」等匹配）；
- 聊天历史保存在会话内（内存），不落盘。

### 5.6 日常陪伴

- **按时问候**：按小时分段（深夜/早晨/上午/中午/下午/晚上）返回不同问候语；
- **节日祝福**：内置 9 个节日（元旦、情人节、妇女节、劳动节、儿童节、国庆节、平安夜、圣诞节、跨年），当天启动首次播报并系统通知；
- **喝水休息提醒**：每 45 分钟（宠物窗口可见时）随机弹出 4 条提醒之一（系统 Notification）；
- 问候/祝福每天只播一次（`state.todayGreeted` 记录 `toDateString()`）。

### 5.7 托盘与退出

- 托盘图标为小猫（16×16 从 icon.ico 缩放），Tooltip「桌面宠物·陪伴」；
- 关闭主窗口不退出（`window-all-closed` 时保持托盘驻留），只有托盘「退出」才真正结束；
- 单实例锁：重复启动会聚焦已有实例，不重复开宠物。

---

## 6. 架构说明

### 6.1 进程模型

```
┌─────────────────────────────────────────────┐
│ 主进程 main.js                                │
│  · 窗口管理（petWin / chatWin / settingsWin） │
│  · 系统托盘                                   │
│  · 定时喝水提醒（Notification）               │
│  · AI 对话转发（fetch OpenAI 兼容接口）        │
│  · JSON 持久化（state.json / settings.json）  │
│  · 宠物窗口移动边界 clamp                     │
│  · 单实例锁 / 常驻托盘退出逻辑                │
└──────────────┬──────────────────────────────┘
               │ preload.js (contextBridge)
               ▼
┌─────────────────────────────────────────────┐
│ 渲染进程                                      │
│  · index.html + app.js：宠物主窗口            │
│  · chat.html + chat.js：聊天窗口              │
│  · settings.html + settings.js：设置窗口      │
│  · pet-engine.js：像素渲染引擎                │
│  · pets/cat.js：宠物定义数据                  │
└─────────────────────────────────────────────┘
```

### 6.2 IPC 接口（preload.js 暴露给渲染进程的 `window.api`）

| API | 类型 | 说明 |
| ---- | ---- | ---- |
| `loadState()` / `saveState(data)` | invoke | 读取 / 保存宠物状态 |
| `loadSettings()` / `saveSettings(data)` | invoke | 读取 / 保存设置 |
| `chat(messages)` | invoke | 发送对话，返回 AI / 本地回复 |
| `getGreeting()` | invoke | 返回 `{ greeting, festival }` |
| `movePet(dx, dy)` | invoke | 按增量移动宠物窗口（宠物自动走动用，主进程 clamp 到工作区） |
| `movePetTo(x, y)` | invoke | 绝对坐标移动宠物窗口（拖拽用，无累积误差） |
| `moveChatTo(x, y)` | invoke | 绝对坐标移动聊天窗口自身（拖拽标题栏用） |
| `getPetBounds()` | invoke | 获取宠物窗口当前 bounds |
| `getChatBounds()` | invoke | 获取聊天窗口当前 bounds |
| `setWindowSize(width, height)` | send | 渲染进程主动调整宠物窗口大小（跟随 petScale） |
| `setClickThrough(flag)` | send | 切换点击穿透（`setIgnoreMouseEvents`），鼠标在宠物像素上才可交互 |
| `notify(title, body)` | send | 弹出系统通知 |
| `toggleChat()` | send | 切换聊天窗口显隐 |
| `close()` | send | 彻底退出应用 |
| `onTrayAction(cb)` | on | 订阅托盘菜单动作（feed/play/bath/chat/settings） |
| `onChatOpen(cb)` | on | 订阅聊天窗口打开事件 |
| `onSettingsChanged(cb)` | on | 订阅设置保存事件（宠物窗口据此重载应用新尺寸等） |
| `platform` | 属性 | `process.platform` |

### 6.3 像素渲染引擎（pet-engine.js）

`PixelEngine` 类职责：

- 按 `pet.size` 在离屏 canvas 上绘制单帧像素画（`w × h` 逻辑像素），再按 `scale`（当前 10）放大到屏幕 canvas；
- **朝向翻转**：`facing = -1` 时水平镜像绘制（`x = w - 1 - x`）；
- **动画状态机**：`play(name, { loop })` 切换动画，`update(dt)` 按 `animMeta[name].fps` 推进帧索引，非 loop 动画停在最后一帧；
- 关闭 `imageSmoothingEnabled` 保证像素边缘锐利。

引擎只依赖宠物定义对象（palette / frames / animMeta / size / type），不感知具体宠物。

### 6.4 渲染进程主循环（app.js）

`requestAnimationFrame` 驱动：

1. 每帧 `engine.update(dt) + engine.draw()`；
2. 每累计 60 秒进行一次数值衰减并 `persist()` 落盘；
3. 非拖拽 / 菜单打开 / 开启自动走动时，按概率触发随机走动或低数值求助气泡。

---

## 7. 数据持久化

全部为 JSON 文件，位于 Electron 的 `userData` 目录（Windows 下为 `%APPDATA%/<应用名>/`）。

| 文件 | 内容 |
| ---- | ---- |
| `state.json` | 养成状态：`{ stats, lastSavedAt, todayGreeted, affectionTotal, lastFeedAt, lastPlayAt, lastBathAt }` |
| `settings.json` | 用户设置：`{ petId, petName, petScale, soundOn, autoWalk, aiApiKey, aiBaseUrl, aiModel, systemPrompt }` |

- 写入策略：直接覆盖写（同步 `writeFileSync`），数据量小，无性能问题；
- 合并策略：读取时与默认值浅合并，保存时 `stats` 字段做深合并，兼容旧版本缺失字段；
- 保存时机：状态变化（喂食/玩耍/洗澡/戳）、每 60 秒周期、问候播报后。

> 注意：早期版本 `productName` 为「桌面宠物·陪伴」，旧数据路径为 `%APPDATA%/桌面宠物·陪伴/`；新版本 `productName` 改为 ASCII `Desktop Pet`，userData 路径为 `%APPDATA%/Desktop Pet/`。如需迁移旧状态，可手动拷贝两个 JSON 文件。

---

## 8. 宠物系统与扩展

### 8.1 宠物定义格式

一个宠物 = 一个 JS 文件，放在 `src/renderer/pets/` 下，例如 `cat.js`：

```js
const catDef = {
  id: 'dog',                 // 唯一标识
  name: '旺财',              // 显示名
  type: 'pixel',             // 渲染类型：pixel（预留 '3d' 等）
  size: { w: 16, h: 16 },    // 像素画尺寸（宽 × 高）
  palette: { '.': null, o: '#4a3b35', w: '#fff8f0', /* 字符 → 颜色 */ },
  frames: {
    idle: [/* 帧数组，每帧为一行一个字符串的二维数组 */],
    blink: [...], happy: [...], sad: [...], sleep: [...],
    eat: [...], talk: [...], drag: [...], walk: [...],
  },
  animMeta: {
    idle: { loop: true, fps: 4 },   // 每段动画的循环与帧率
    // ...
  },
  baseStats: { hunger: 80, mood: 80, clean: 80, health: 90, affection: 0 },
};

if (typeof module !== 'undefined' && module.exports) module.exports = catDef;
if (typeof window !== 'undefined') window.__catDef = catDef;
```

### 8.2 像素画规则

- 每行字符串 = 一行像素，每个字符 = 一个像素，`.` 表示透明；
- 颜色通过 `palette` 按字符查表；
- `frames.X` 是**动画帧数组**，每帧是一组 16 行字符串；单帧动画数组长度可为 1；
- 引擎要求的动画键：`idle / blink / happy / sad / sleep / eat / talk / drag / walk`。

### 8.3 新增宠物的步骤

1. 复制 `cat.js` 为 `dog.js`，改 `id` / `name` / `palette` / `frames` / `animMeta`；
2. 终端预览效果：`npm run preview`（脚本可临时改指向新宠物，或参考 `scripts/preview-pet.js`）；
3. 注册到渲染进程：
   - `src/renderer/app.js`：`const pets = { cat }` → `const pets = { cat, dog }`；
   - `src/renderer/settings.js`：`PETS` 数组加 `{ id: 'dog', name: '...' }`；
4. 可选：注册到 Node 侧 `src/renderer/pets/index.js` 的 `registry`（供脚本工具使用）；
5. `npm run icon` 重新生成应用图标（图标脚本读取独立的像素画 `scripts/icon-art.js`，与宠物 `cat.js` 解耦，改图标不依赖宠物）。

### 8.4 未来的 3D 宠物

- `type` 字段已预留扩展空间；
- 计划：新建 `type: '3d'` 的宠物定义（`frames` 替换为 glTF / 程序化网格等 3D 数据），在 `pet-engine.js` 的绘制逻辑里按 `pet.type` 分支走 3D 渲染管线；
- 养成、互动、AI 对话、气泡、提醒等系统全部与渲染类型解耦，可直接复用。

---

## 9. 打包与分发

### 9.1 打包配置（package.json → build）

| 项 | 值 | 说明 |
| ---- | ---- | ---- |
| appId | `com.cartoonwife.pet` | 应用唯一标识 |
| productName | `Desktop Pet` | exe 元数据用 ASCII，规避 rcedit 中文编码问题 |
| win.target | `nsis` | 安装包类型 |
| win.icon | `build/icon.ico` | 应用图标 |
| win.executableName | `cartoonwife-pet` | exe 文件名 |
| nsis.shortcutName | `桌面宠物·陪伴` | 快捷方式名（中文放这里，安装器可正常处理） |
| nsis.oneClick | false | 向导式安装，可改安装目录 |

### 9.2 打包命令

```powershell
# 1) 设置镜像与签名环境变量（网络受限环境必需）
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

# 2) 打包
npm run pack
# 产物：dist/Desktop Pet Setup 1.1.0.exe
```

### 9.3 本项目的打包环境细节（重要）

本项目因无法访问 GitHub，采用以下方案，**换机器或重装 node_modules 时需照做**：

1. **Electron 二进制**：从 `https://npmmirror.com/mirrors/electron/33.x.x/` 手动下载 zip，解压到 `node_modules/electron/dist/`，并把 `dist/electron.exe` 路径写入 `node_modules/electron/path.txt`（内容为 `electron.exe`）；
2. **winCodeSign 缓存**：electron-builder 会下载 winCodeSign 用于签名/设置图标，失败时手动从 npmmirror 下载 zip 解压到
   `C:\Users\<用户>\AppData\Local\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`，
   **并删除其中的 `darwin/` 目录**（其内符号链接在无管理员权限时解压会报「客户端没有所需的特权」）；
3. **rcedit 警告**：构建时出现 `Fatal error: Unable to commit changes` 为已知无害问题（对过大的 PE 文件写版本信息失败），**不影响安装包可用性**；exe 图标可用
   `rcedit-x64.exe <exe> --set-icon build/icon.ico` 手动补上。

### 9.4 安装包验证

开发期已通过静默安装验证：

```powershell
# 静默安装到临时目录
.\dist\"Desktop Pet Setup 1.1.0.exe" /S /D=C:\Users\cwwx0\AppData\Local\Temp\opencode\pet-final-install
# 运行安装后的 exe，宠物正常启动，状态文件正常写入
```

---

## 10. 已知问题与注意事项

1. **rcedit 版本元数据失败**：见 9.3 第 3 点，属装饰性问题，功能与图标均正常。
2. **状态文件路径变化**：旧数据在 `%APPDATA%/桌面宠物·陪伴/`，新版本在 `%APPDATA%/Desktop Pet/`，升级安装不会自动迁移旧养成数据。
3. **沙箱**：某些受限环境需要 `ELECTRON_DISABLE_SANDBOX=1` 才能运行。
4. **「Ignoring extra certs from certs\ca.crt」**：控制台无害噪音，可忽略。
5. **开发日志**：`NODE_ENV=development` 时三个窗口的 `console-message` 会转发到终端，方便调试渲染进程。
6. **应用图标为独立像素画**：`scripts/make-icon.js` 读取 `scripts/icon-art.js`（32×32 像素猫头像），生成多尺寸 `build/icon.png` 与 `build/icon.ico`。
7. **聊天历史不落盘**：重启应用后聊天记录清空（属当前设计）。
8. **点击穿透细节**：穿透基于宠物不透明像素判定，气泡（`pointer-events: none`）与透明区域均不拦截点击；首次运行若鼠标悬停在宠物上需移动一下鼠标触发检测后即可交互。

---

## 11. 开发日志与未来规划

### 开发日志

- [x] 项目脚手架（package.json / main.js / preload.js / 透明置顶窗口）
- [x] 像素渲染引擎 + 小猫定义（9 组动画）+ 终端预览脚本
- [x] 动画状态机 + 桌面走动 / 待机 / 睡觉
- [x] 养成数值系统（五维 + 衰减 + 离线结算 + 健康联动）+ JSON 持久化
- [x] 互动（戳 / 拖拽 / 喂食 / 玩耍 / 洗澡）+ 合成音效
- [x] 气泡对话 + AI 对话（OpenAI 兼容 + 本地兜底）
- [x] 日常陪伴（按时问候 / 节日祝福 / 45 分钟提醒）
- [x] 托盘 + 设置面板（宠物切换 / 名字 / 音效 / 自动走动 / AI 配置）
- [x] 可调宠物尺寸（默认缩小为一半，3~12 倍自定义，实时生效）
- [x] 点击穿透（宠物像素级判定，不再挡住桌面其他内容）
- [x] 修复拖拽：宠物/聊天窗改为绝对坐标定位（横纵均稳定无漂移）；聊天窗拖拽只移动自身并默认贴近宠物
- [x] 修复高分屏（如 125% DPI）拖拽漂移：改用窗口内坐标 clientX/Y 计算位移，避免屏幕坐标与窗口坐标单位不一致导致宠物被越拖越往屏幕底部
- [x] 修复拖拽受限/残影：切回屏幕坐标 screenX/Y（绝对参考系无反馈回路），加入 setPointerCapture 确保光标离开小窗口时拖拽不中断
- [x] 拖拽与点击分离：宠物左键单击直接显示喂食/玩耍/洗澡/聊天选项；只有移动超过阈值才执行拖拽
- [x] 拖拽性能优化：移动 IPC 改为单向 send 并按动画帧合并最新坐标，避免异步位置请求排队造成残影；支持按当前显示器工作区跨屏拖拽
- [x] electron-builder 打包 Windows 安装包 + 静默安装验证
- [x] v1.1.0：独立像素图标（scripts/icon-art.js 32×32 像素猫头），重打包为 `Desktop Pet Setup 1.1.0.exe`

### 未来规划（可选）

- 更多像素宠物（狗、兔、熊猫……）与多宠物切换；
- 3D 宠物（利用 `type` 预留分支）；
- 聊天记录落盘 / 导出；
- 更丰富的动画与动作（跳跃、打滚、跟鼠标）；
- AI 情绪感知：根据宠物数值影响 AI 回复语气；
- 自动更新（electron-updater）。
