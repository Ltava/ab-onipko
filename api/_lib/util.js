// Дрібні спільні утиліти серверних функцій.

const SITE_URL = (process.env.SITE_URL || 'https://www.advokatonipko.com').replace(/\/+$/, '');

// Ідентифікатор замовлення: <product_id>--<uuid>. Товар відновлюється з order_id,
// а сума платежу підписана сервером, тож підмінити товар чи ціну неможливо.
const ORDER_RE = /^([a-z0-9-]{2,60})--([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function parseOrder(orderId) {
  const m = ORDER_RE.exec(String(orderId || ''));
  return m ? { productId: m[1] } : null;
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function clip(str, n) {
  return String(str == null ? '' : str).trim().slice(0, n);
}

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error('Telegram is not configured');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  if (!res.ok) throw new Error('Telegram HTTP ' + res.status);
}

module.exports = { SITE_URL, parseOrder, escapeHtml, clip, EMAIL_RE, telegram };
