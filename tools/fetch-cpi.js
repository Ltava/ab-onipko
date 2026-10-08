// Оновлює запасну копію індексів інфляції assets/data/cpi.json з офіційного API Держстату.
// Запуск перед публікацією: node tools/fetch-cpi.js
// Запасна копія використовується, якщо API Держстату тимчасово недоступний.

const fs = require('fs');
const path = require('path');
const cpi = require('../api/_lib/cpi');

const FILE = path.join(__dirname, '..', 'assets', 'data', 'cpi.json');

(async () => {
  let fallback = null;
  try { fallback = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* перший запуск */ }
  const indices = await cpi.fetchCpi({ timeoutMs: 20000 });
  const check = cpi.validate(indices, fallback);
  if (!check.ok) {
    console.error('✗ Дані не пройшли перевірку:\n  ' + check.errors.join('\n  '));
    process.exit(1);
  }
  const out = {
    source: cpi.SOURCE,
    series: cpi.SERIES_KEY,
    retrieved: new Date().toISOString().slice(0, 10),
    latest: check.latest,
    indices
  };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(out, null, 0) + '\n', 'utf8');
  console.log('✓ Збережено ' + Object.keys(indices).length + ' місяців, останній — ' + check.latest);
  if (check.revised.length) console.log('Держстат уточнив значення:\n  ' + check.revised.join('\n  '));
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
