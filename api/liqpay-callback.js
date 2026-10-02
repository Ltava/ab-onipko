// /api/liqpay-callback — server_url для LiqPay. Перевіряє підпис, надсилає адвокату
// сповіщення в Telegram і (якщо налаштовано пошту) лист-підтвердження покупцю.
// Видача файлу від цього не залежить: /api/download сам перевіряє оплату в LiqPay.
//
// Необов'язкові змінні для листа покупцю (сервіс Resend, resend.com):
//   RESEND_API_KEY, MAIL_FROM (напр. "АБ «Євгена Оніпка» <shop@advokatonipko.com>")

const catalog = require('./_lib/catalog');
const liqpay = require('./_lib/liqpay');
const { SITE_URL, parseOrder, escapeHtml, telegram, EMAIL_RE } = require('./_lib/util');

const KIND_LABEL = {
  template: '📄 Шаблон (файл видано на сайті)',
  personal: '✍️ Складання документа адвокатом — надіслати договір на підпис',
  consultation: '💼 Консультація — зв\'язатися з клієнтом'
};

async function sendConfirmation(to, product, orderId) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || !EMAIL_RE.test(to || '')) return;

  const link = `${SITE_URL}/dyakuyu.html?order=${encodeURIComponent(orderId)}`;
  const isTemplate = product.kind === 'template';
  const html = `
    <p>Дякуємо за замовлення!</p>
    <p><b>${escapeHtml(product.title)}</b> — ${product.price} грн. Номер замовлення: ${escapeHtml(orderId)}.</p>
    ${isTemplate
      ? `<p>Завантажити шаблон: <a href="${link}">${link}</a> (посилання дійсне 7 днів).</p>
         <p>Шаблон надано електронними засобами за вашою згодою до закінчення 14-денного строку, тому відповідно до п. 1 ч. 5 ст. 13 Закону України «Про захист прав споживачів» право розірвати договір у цей строк не застосовується. Право на заміну файлу або повернення коштів у разі дефекту чи невідповідності опису зберігається.</p>`
      : `<p>Адвокат особисто зв'яжеться з вами найближчим часом. Деталі замовлення: <a href="${link}">${link}</a>.</p>`}
    <p>Продавець: Адвокатське бюро «Євгена Оніпка», ЄДРПОУ 45219345, 36011, м. Полтава, вул. Європейська, 18А (для листування); onipko_evgen@ukr.net; +38 050 918 58 70. Претензії розглядаються протягом 14 днів.</p>
    <p>Умови: <a href="${SITE_URL}/oferta.html">Публічна оферта</a> · <a href="${SITE_URL}/povernennya.html">Умови оплати та повернення</a> · <a href="${SITE_URL}/privacy.html">Політика конфіденційності</a>.</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: 'onipko_evgen@ukr.net', subject: `Замовлення: ${product.title}`, html })
  });
  if (!res.ok) throw new Error('Resend HTTP ' + res.status);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  try {
    const { data, signature } = req.body || {};
    if (!liqpay.verify(data, signature)) {
      res.status(400).end();
      return;
    }

    const p = liqpay.decode(data);
    const order = parseOrder(p.order_id);
    const product = order && catalog[order.productId];

    if (product && liqpay.isPaid(p.status)) {
      let info = {};
      try { info = JSON.parse(p.info || '{}'); } catch (e) { /* поле info необов'язкове */ }

      const manualFile = product.kind === 'template' && !/^[0-9a-f]{64}$/i.test(process.env.DOCS_KEY || '');
      const text =
        `💳 <b>ОПЛАЧЕНО: ${escapeHtml(p.amount)} ${escapeHtml(p.currency)}</b>\n` +
        `${KIND_LABEL[product.kind] || ''}\n` +
        (manualFile ? `⚠️ <b>Автоматична видача вимкнена (немає DOCS_KEY) — надішліть файл на email вручну!</b>\n` : '') +
        `🛒 ${escapeHtml(product.title)}\n` +
        `👤 ${escapeHtml(info.n) || '—'}\n` +
        `📧 ${escapeHtml(info.e) || '—'}\n` +
        (info.p ? `📞 ${escapeHtml(info.p)}\n` : '') +
        (info.t ? `💬 ${escapeHtml(info.t)}\n` : '') +
        `🧾 ${escapeHtml(p.order_id)}${p.status === 'sandbox' ? ' (ТЕСТ)' : ''}`;

      await Promise.all([
        telegram(text).catch(err => console.error('callback telegram:', err.message)),
        sendConfirmation(info.e, product, p.order_id).catch(err => console.error('callback mail:', err.message))
      ]);
    }

    res.status(200).end();
  } catch (err) {
    console.error('liqpay-callback:', err.message);
    res.status(500).end();
  }
};
