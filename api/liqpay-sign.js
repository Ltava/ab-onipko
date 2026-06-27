// /api/liqpay-sign.js — Vercel serverless function (Node.js).
// Будує LiqPay data+signature НА СЕРВЕРІ, щоб PRIVATE_KEY ніколи не потрапляв у браузер.
//
// Налаштування (зробити в Vercel → Project → Settings → Environment Variables):
//   LIQPAY_PUBLIC_KEY  = i53924086051   (старий публічний ключ можна залишити, або взяти новий після ротації)
//   LIQPAY_PRIVATE_KEY = <НОВИЙ ключ, отриманий після ротації в кабінеті LiqPay>
//
// Старий приватний ключ "a7l04PJdPUaiLBCFqHaAql81E5wGhddUzs66UwYe" вже публічний —
// його треба замінити в кабінеті LiqPay ДО того, як ця функція піде в продакшн.

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { amount, description, order_id, customer_user_id, result_url } = req.body || {};

    if (!amount || !description || !order_id || !customer_user_id || !result_url) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Базова валідація типів/довжини, щоб не пробросити сміття в LiqPay
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0 || safeAmount > 100000) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY;
    const PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY;

    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      res.status(500).json({ error: 'LiqPay keys are not configured on the server' });
      return;
    }

    const params = {
      version: 3,
      public_key: PUBLIC_KEY,
      action: 'pay',
      amount: safeAmount,
      currency: 'UAH',
      description: String(description).slice(0, 500),
      order_id: String(order_id).slice(0, 200),
      customer_user_id: String(customer_user_id).slice(0, 200),
      language: 'uk',
      result_url: String(result_url),
      server_url: ''
    };

    const data = Buffer.from(JSON.stringify(params), 'utf-8').toString('base64');
    const signature = crypto
      .createHash('sha1')
      .update(PRIVATE_KEY + data + PRIVATE_KEY)
      .digest('base64');

    res.status(200).json({ data, signature });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
};
