// /api/liqpay-sign — формує підписаний платіж LiqPay НА СЕРВЕРІ.
// Браузер передає лише ідентифікатор товару та контакти; ціну, опис і order_id
// визначає сервер за каталогом (api/_lib/catalog.js).
//
// Змінні середовища (Vercel → Project → Settings → Environment Variables):
//   LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY — ключі з кабінету LiqPay
//   LIQPAY_SANDBOX=1 — лише для тестування (тестові оплати вважаються успішними)
//   SITE_URL — необов'язково, за замовчуванням https://www.advokatonipko.com
//   LIQPAY_RRO_IDS — необов'язково, ID товарів ПРРО LiqPay для автоматичних фіскальних чеків

const crypto = require('crypto');
const catalog = require('./_lib/catalog');
const liqpay = require('./_lib/liqpay');
const { SITE_URL, clip, EMAIL_RE } = require('./_lib/util');

function rroIds() {
  try {
    return JSON.parse(process.env.LIQPAY_RRO_IDS || '{}');
  } catch (e) {
    console.error('LIQPAY_RRO_IDS is not valid JSON');
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const product = catalog[body.product_id];
    if (!product) {
      res.status(400).json({ error: 'Unknown product' });
      return;
    }

    const email = clip(body.email, 254);
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    if (body.consent !== true) {
      res.status(400).json({ error: 'Consent required' });
      return;
    }

    const phone = clip(body.phone, 30);
    if (product.kind !== 'template' && !/^[+\d][\d\s()-]{8,}$/.test(phone)) {
      res.status(400).json({ error: 'Invalid phone' });
      return;
    }

    const orderId = `${body.product_id}--${crypto.randomUUID()}`;
    // Контакти покупця повертаються в callback через поле info — для сповіщення адвоката.
    const info = JSON.stringify({
      n: clip(body.name, 80),
      e: email,
      p: phone,
      t: clip(body.topic, 300)
    });

    const params = {
      action: 'pay',
      amount: product.price,
      currency: 'UAH',
      description: `АБ «Євгена Оніпка»: ${product.title}`.slice(0, 250),
      order_id: orderId,
      language: 'uk',
      info,
      result_url: `${SITE_URL}/dyakuyu.html?order=${encodeURIComponent(orderId)}`,
      server_url: `${SITE_URL}/api/liqpay-callback`
    };
    if (process.env.LIQPAY_SANDBOX === '1') params.sandbox = 1;

    // Фіскалізація через вбудований ПРРО LiqPay: чек автоматично надсилається покупцю на email.
    // LIQPAY_RRO_IDS — JSON {"<product_id>": <ID товару в каталозі ПРРО кабінету LiqPay>, ...}
    const rroId = rroIds()[body.product_id];
    if (rroId) {
      params.rro_info = {
        items: [{ amount: 1, price: product.price, cost: product.price, id: rroId }],
        delivery_emails: [email]
      };
    }

    const { data, signature } = liqpay.encode(params);
    res.status(200).json({ data, signature, order_id: orderId });
  } catch (err) {
    console.error('liqpay-sign:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
};
