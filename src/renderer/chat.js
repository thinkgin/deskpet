const msgsEl = document.getElementById('msgs');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const closeBtn = document.getElementById('close');

let settings = null;
let history = [];

const petAvatars = { cat: '🐱' };

function persistHistory() {
  window.api.saveMemory({ history });
}

function addMsg(role, text, save) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (role === 'pet') {
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = (settings && settings.petName ? settings.petName : '宠物') + ' ' + (petAvatars[settings && settings.petId] || '🐾');
    div.appendChild(who);
  }
  const span = document.createElement('span');
  span.textContent = text;
  div.appendChild(span);
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  if (save) persistHistory();
}

function dragSetup() {
  let dragging = false, start = null;
  const bar = document.getElementById('bar');
  bar.addEventListener('pointerdown', async (e) => {
    if (e.button !== 0) return;
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    const b = (await window.api.getChatBounds()) || { x: 0, y: 0 };
    start = { sx: e.screenX, sy: e.screenY, wx: b.x, wy: b.y };
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging || !start) return;
    window.api.moveChatTo(start.wx + (e.screenX - start.sx), start.wy + (e.screenY - start.sy));
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    start = null;
  });
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMsg('user', text);
  history.push({ role: 'user', content: text });
  persistHistory();
  sendBtn.disabled = true;
  const thinking = document.createElement('div');
  thinking.className = 'msg pet';
  thinking.textContent = '…';
  msgsEl.appendChild(thinking);
  try {
    const reply = await window.api.chat(history);
    history.push({ role: 'assistant', content: reply });
    persistHistory();
    thinking.remove();
    addMsg('pet', reply);
  } catch (e) {
    thinking.remove();
    addMsg('pet', '呜……我脑子短路了，再试一次喵~');
  }
  sendBtn.disabled = false;
  input.focus();
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});
closeBtn.addEventListener('click', () => {
  persistHistory();
  window.api.closeChat();
});

const clearMemBtn = document.getElementById('clearMem');
clearMemBtn.addEventListener('click', async () => {
  if (!confirm('清空宠物对本次对话的记忆？')) return;
  try {
    await window.api.clearMemory();
    history = [];
    msgsEl.innerHTML = '';
    addMsg('pet', '好啦主人，我把之前的事忘掉啦，从今天重新开始~');
  } catch (e) { /* ignore */ }
});

window.api.onChatOpen(() => {
  input.focus();
});

(async () => {
  settings = await window.api.loadSettings();
  // 加载历史记忆
  try {
    const mem = await window.api.loadMemory();
    const savedHistory = (mem && Array.isArray(mem.history)) ? mem.history : [];
    const valid = savedHistory.filter((m) => m && m.role && typeof m.content === 'string');
    if (valid.length) {
      history = valid.slice(-40);
      history.forEach((m) => addMsg(m.role, m.content));
    } else {
      const { greeting, festival } = await window.api.getGreeting();
      addMsg('pet', festival || greeting || '喵~主人你来啦！我一直在等你哦~');
    }
  } catch (e) {
    const { greeting, festival } = await window.api.getGreeting();
    addMsg('pet', festival || greeting || '喵~主人你来啦！我一直在等你哦~');
  }
  dragSetup();
})();
