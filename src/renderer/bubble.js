const bubble = document.getElementById('bubble');
const text = document.getElementById('text');

window.api.onBubbleContent((payload) => {
  const loading = !!(payload && payload.loading);
  bubble.classList.toggle('loading', loading);
  text.textContent = loading ? '' : String((payload && payload.text) || '');
  requestAnimationFrame(() => {
    const rect = bubble.getBoundingClientRect();
    window.api.reportBubbleSize(Math.ceil(rect.width) + 8, Math.ceil(rect.height) + 8);
  });
});
