// /api/notify-telegram — заявка з контактної форми → сповіщення адвоката в Telegram.
// Токен бота зберігається лише у змінних середовища Vercel:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const { escapeHtml, clip, EMAIL_RE, telegram } = require('./_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const b = req.body || {};

    // Пастка для ботів: приховане поле, яке людина не бачить і не заповнює.
    if (b.website) {
      res.status(200).json({ ok: true });
      return;
    }

    const name = clip(b.name, 80);
    const phone = clip(b.phone, 30);
    const email = clip(b.email, 254);
    if (!name || !/^[+\d][\d\s()-]{8,}$/.test(phone) || (email && !EMAIL_RE.test(email))) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const text = `🔔 Новий запит з сайту АБ «Євгена Оніпка»\n\n` +
      `👤 Ім'я: ${escapeHtml(name)}\n📞 Телефон: ${escapeHtml(phone)}\n` +
      `📧 Email: ${escapeHtml(email) || '—'}\n⚖️ Напрямок: ${escapeHtml(clip(b.practice, 80)) || '—'}\n` +
      `💬 Повідомлення: ${escapeHtml(clip(b.message, 1500)) || '—'}`;

    await telegram(text);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-telegram:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
};
