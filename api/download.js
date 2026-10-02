// /api/download — видача придбаного шаблону.
//   GET /api/download?order=<order_id>&info=1  → JSON зі статусом замовлення і списком файлів
//   GET /api/download?order=<order_id>&f=<n>   → сам файл .docx
//
// Оплата щоразу перевіряється запитом статусу до LiqPay, тому база даних не потрібна.
// Файли зберігаються в репозиторії лише зашифрованими (private/docs/*.enc, AES-256-GCM)
// і розшифровуються ключем DOCS_KEY зі змінних середовища Vercel.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const catalog = require('./_lib/catalog');
const liqpay = require('./_lib/liqpay');
const { parseOrder } = require('./_lib/util');

const DOCS_DIR = path.join(__dirname, '..', 'private', 'docs');
const LINK_DAYS = Number(process.env.DOWNLOAD_DAYS || 7);
const FAILED = new Set(['failure', 'error', 'reversed', 'unsubscribed']);

function decryptDoc(id) {
  const key = Buffer.from(process.env.DOCS_KEY || '', 'hex');
  if (key.length !== 32) throw new Error('DOCS_KEY is not configured');
  const buf = fs.readFileSync(path.join(DOCS_DIR, id + '.enc'));
  // Формат файлу: 12 байт IV | 16 байт тег автентифікації | шифротекст
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

function docsKeyConfigured() {
  return /^[0-9a-f]{64}$/i.test(process.env.DOCS_KEY || '');
}

function classify(st) {
  if (liqpay.isPaid(st.status)) return 'paid';
  if (st.err_code === 'payment_not_found') return 'pending';
  if (FAILED.has(st.status)) return 'failed';
  return 'pending';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Самоперевірка ключа: розшифровує всі шаблони й повідомляє лише результат (файли не віддаються).
  if (req.query.selftest) {
    if (!docsKeyConfigured()) {
      res.status(200).json({ ok: false, reason: 'DOCS_KEY not configured' });
      return;
    }
    const ids = [...new Set(Object.values(catalog).flatMap(p => (p.files || []).map(f => f.id)))];
    const failed = ids.filter(id => {
      try { return decryptDoc(id).subarray(0, 2).toString() !== 'PK'; } catch (e) { return true; }
    });
    res.status(200).json({ ok: failed.length === 0, checked: ids.length, failed });
    return;
  }

  const orderId = String(req.query.order || '');
  const order = parseOrder(orderId);
  const product = order && catalog[order.productId];
  if (!product) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  try {
    const st = await liqpay.status(orderId);
    const state = classify(st);

    const paidAt = Number(st.end_date || st.create_date || 0);
    const expired = state === 'paid' && paidAt > 0 && Date.now() - paidAt > LINK_DAYS * 864e5;

    // Якщо ключ шифрування ще не задано на сервері — файл надсилається вручну (див. сповіщення в Telegram).
    const manual = !docsKeyConfigured();

    if (req.query.info) {
      res.status(200).json({
        status: expired ? 'expired' : state,
        kind: product.kind,
        title: product.title,
        manual: manual && !!product.files,
        files: state === 'paid' && !expired && product.files && !manual
          ? product.files.map((f, i) => ({ index: i, name: f.name }))
          : []
      });
      return;
    }

    if (state !== 'paid' || expired || !product.files || manual) {
      res.status(403).json({ error: expired ? 'Link expired' : 'Not paid' });
      return;
    }

    const file = product.files[Number(req.query.f || 0)];
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const body = decryptDoc(file.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition',
      `attachment; filename="${file.id}.docx"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Content-Length', body.length);
    res.status(200).send(body);
  } catch (err) {
    console.error('download:', err.message);
    res.status(502).json({ error: 'Temporary error' });
  }
};
