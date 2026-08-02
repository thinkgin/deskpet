const msgsEl = document.getElementById('msgs');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const closeBtn = document.getElementById('close');

let settings = null;
let history = [];

const petAvatars = { cat: '🐱' };

function addMsg(role, text) {
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
  sendBtn.disabled = true;
  const thinking = document.createElement('div');
  thinking.className = 'msg pet';
  thinking.textContent = '…';
  msgsEl.appendChild(thinking);
  try {
    const reply = await window.api.chat(history);
    history.push({ role: 'assistant', content: reply });
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
  window.api.closeChat();
});

window.api.onChatOpen(() => {
  input.focus();
});

(async () => {
  settings = await window.api.loadSettings();
  const { greeting, festival } = await window.api.getGreeting();
  addMsg('pet', festival || greeting || '喵~主人你来啦！我一直在等你哦~');
  dragSetup();
})();
