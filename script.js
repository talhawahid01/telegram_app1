// Initialize Telegram WebApp
if (!window.Telegram?.WebApp) {
  alert('This page must be opened inside Telegram');
} else {
  window.Telegram.WebApp.ready(); // tell Telegram we’re ready[web:30]
}

const backendUrl = 'https://nemoclawtelegrambackend-production.up.railway.app/chat'; // replace with your public HTTPS URL
const chatDiv = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');

function addMessage(text, sender) {
  const div = document.createElement('div');
  div.style.margin = '8px 0';
  div.style.maxWidth = '80%';
  div.style.alignSelf = sender === 'user' ? 'flex-end' : 'flex-start';
  div.style.background = sender === 'user' ? '#dcf8c6' : '#f0f0f0';
  div.style.padding = '10px';
  div.style.borderRadius = '12px';
  div.textContent = text;
  chatDiv.appendChild(div);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  addMessage(message, 'user');
  input.value = '';

  try {
    const resp = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await resp.json();
    const reply = data.reply ?? 'Sorry, something went wrong.';
    addMessage(reply, 'bot');
  } catch (err) {
    console.error(err);
    addMessage('Error contacting backend', 'bot');
  }
});