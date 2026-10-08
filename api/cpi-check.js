// /api/cpi-check — щомісячна перевірка індексу інфляції (Vercel Cron, див. vercel.json).
// Запускається 12 і 16 числа. Держстат публікує індекс за попередній місяць близько 9–10 числа.
//   12 число: якщо індекс за минулий місяць є — повідомлення «додано»; якщо ні — «ще немає».
//   16 число: повідомлення лише тоді, коли індексу досі немає або дані не пройшли перевірку.
// Доступ лише з заголовком Authorization: Bearer <CRON_SECRET> (Vercel додає його сам).

const cpi = require('./_lib/cpi');
const fallback = require('../assets/data/cpi.json');
const { telegram, escapeHtml } = require('./_lib/util');

function expectedMonth(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const now = new Date();
  const day = now.getUTCDate();
  const expected = expectedMonth(now);
  let msg = null;
  let result;
  try {
    const indices = await cpi.fetchCpi({ timeoutMs: 15000 });
    const check = cpi.validate(indices, fallback);
    if (!check.ok) {
      msg = '⚠️ Індекси інфляції: дані Держстату не пройшли перевірку. Калькулятор використовує запасну копію ' +
        '(останній місяць ' + fallback.latest + ').\n' + escapeHtml(check.errors.join('\n'));
    } else if (check.latest >= expected) {
      if (day < 16) msg = '✅ Індекс інфляції за ' + expected + ' опубліковано: ' + indices[expected] + '%. Калькулятор уже його використовує.';
      if (check.revised.length) msg = (msg ? msg + '\n' : '') + 'Держстат уточнив значення: ' + check.revised.join('; ');
      if (msg) msg += '\nЩоб оновити запасну копію на сайті: node tools/fetch-cpi.js і публікація.';
    } else {
      msg = (day < 16 ? '⏳' : '⚠️') + ' Індекс інфляції за ' + expected + ' ще не опубліковано (останній — ' + check.latest + ').' +
        (day < 16 ? ' Повторна перевірка 16 числа.' : ' Перевірте stat.gov.ua вручну.');
    }
    result = { ok: check.ok, latest: check.latest, expected };
  } catch (err) {
    msg = '⚠️ Індекси інфляції: не вдалося отримати дані Держстату (' + escapeHtml(err.message) + '). Калькулятор використовує запасну копію ' +
      '(останній місяць ' + fallback.latest + ').';
    result = { ok: false, error: err.message };
  }
  if (msg) {
    try { await telegram(msg); } catch (e) { console.error('cpi-check telegram:', e.message); }
  }
  res.status(200).json(result);
};
