// /api/cpi — індекси інфляції для калькулятора інфляційних втрат.
//   GET /api/cpi → { source, latest, retrieved, live, indices: { 'YYYY-MM': 100.1, ... } }
//
// Ряд береться з офіційного API Держстату й кешується на CDN Vercel на 12 годин.
// Якщо Держстат недоступний або дані не пройшли перевірку — віддається запасна копія
// assets/data/cpi.json (live: false), тож калькулятор працює завжди.

const cpi = require('./_lib/cpi');
const fallback = require('../assets/data/cpi.json');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let body;
  try {
    const indices = await cpi.fetchCpi();
    const check = cpi.validate(indices, fallback);
    if (!check.ok) throw new Error(check.errors.join('; '));
    body = { source: cpi.SOURCE, latest: check.latest, retrieved: new Date().toISOString().slice(0, 10), live: true, indices };
    res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
  } catch (err) {
    console.error('cpi:', err.message);
    body = { source: fallback.source, latest: fallback.latest, retrieved: fallback.retrieved, live: false, indices: fallback.indices };
    res.setHeader('Cache-Control', 'public, s-maxage=1800');
  }
  res.status(200).json(body);
};
