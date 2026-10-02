// Спільні функції LiqPay (API v3). Ключі — лише зі змінних середовища Vercel.
const crypto = require('crypto');

function keys() {
  const pub = process.env.LIQPAY_PUBLIC_KEY;
  const priv = process.env.LIQPAY_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('LiqPay keys are not configured');
  return { pub, priv };
}

function sign(data, priv) {
  return crypto.createHash('sha1').update(priv + data + priv).digest('base64');
}

function encode(params) {
  const { pub, priv } = keys();
  const data = Buffer.from(JSON.stringify({ version: 3, public_key: pub, ...params }), 'utf-8').toString('base64');
  return { data, signature: sign(data, priv) };
}

// Перевірка підпису callback-запиту від LiqPay (порівняння за сталий час).
function verify(data, signature) {
  const { priv } = keys();
  if (typeof data !== 'string' || typeof signature !== 'string') return false;
  const expected = Buffer.from(sign(data, priv));
  const got = Buffer.from(signature);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

function decode(data) {
  return JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
}

// Серверний запит статусу платежу — єдине джерело істини, чи оплачено замовлення.
async function status(orderId) {
  const { data, signature } = encode({ action: 'status', order_id: orderId });
  const res = await fetch('https://www.liqpay.ua/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data, signature }).toString()
  });
  if (!res.ok) throw new Error('LiqPay status HTTP ' + res.status);
  return res.json();
}

// Статуси, які вважаються успішною оплатою. 'sandbox' — лише для тестового режиму.
function isPaid(st) {
  if (st === 'success') return true;
  return st === 'sandbox' && process.env.LIQPAY_SANDBOX === '1';
}

module.exports = { encode, verify, decode, status, isPaid };
