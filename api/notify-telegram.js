// /api/notify-telegram.js — Vercel serverless function (Node.js).
// Шле Telegram-нотифікацію НА СЕРВЕРІ, щоб BOT_TOKEN ніколи не потрапляв у браузер.
//
// Налаштування (Vercel → Project → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN = <НОВИЙ токен, отриманий після /revoke у @BotFather>
//   TELEGRAM_CHAT_ID   = 1073109260   (можна залишити — це не секрет, лише ID чату)
//
// Старий токен "8928625265:AAG3-a4YIeVuZve5a-vatHUOrUcj5oKUpC4" вже публічний — обов'язково
// зробити /revoke у @BotFather і вставити сюди новий токен через Vercel env vars.

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { kind, name, phone, email, practice, message, topic, amount } = req.body || {};

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      res.status(500).json({ error: 'Telegram is not configured on the server' });
      return;
    }

    let text;
    if (kind === 'payment') {
      text = `💼 <b>НОВА ОПЛАТА КОНСУЛЬТАЦІЇ</b>\n` +
        `👤 Ім'я: ${escapeHtml(name) || '—'}\n` +
        `📞 Телефон: ${escapeHtml(phone)}\n` +
        `📧 Email: ${escapeHtml(email)}\n` +
        `💬 Ситуація: ${escapeHtml(topic) || '—'}\n` +
        `💰 Сума: ${escapeHtml(amount)} грн\n` +
        `🕐 ${new Date().toLocaleString('uk-UA')}`;
    } else {
      text = `🔔 Новий запит з сайту АБ «Євгена Оніпка»\n\n` +
        `👤 Ім'я: ${escapeHtml(name)}\n📞 Телефон: ${escapeHtml(phone)}\n` +
        `📧 Email: ${escapeHtml(email) || '—'}\n⚖️ Напрямок: ${escapeHtml(practice) || '—'}\n` +
        `💬 Повідомлення: ${escapeHtml(message) || '—'}\n\n🕐 ${new Date().toLocaleString('uk-UA')}`;
    }

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
};
