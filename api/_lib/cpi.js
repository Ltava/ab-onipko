// Індекси споживчих цін (інфляції) з офіційного SDMX API Держстату.
// Ряд: ІСЦ до попереднього місяця, Україна, усі товари й послуги, місячний.
// Ліцензія даних — Creative Commons Attribution 4.0: на сторінці калькулятора зазначається джерело.
//
// Використовують: /api/cpi (віддає ряд калькулятору), /api/cpi-check (щомісячна перевірка за розкладом),
// tools/fetch-cpi.js (оновлює запасну копію assets/data/cpi.json перед публікацією).

const SDMX_BASE = 'https://stat.gov.ua/sdmx/workspaces/default:integration/registry/sdmx/3.0/data/dataflow/SSSU/DF_PRICE_CHANGE_CONSUMER_GOODS_SERVICE/~/';
const SERIES_KEY = 'INDEX_CONSUMPRICE.PREV_MONTH.UA00000000000000000.0.M';
const FROM_PERIOD = '2000-M01';
const SOURCE = {
  name: 'Державна служба статистики України',
  url: 'https://stat.gov.ua/',
  license: 'CC BY 4.0'
};

function sourceUrl(from = FROM_PERIOD) {
  return SDMX_BASE + SERIES_KEY + '?c[TIME_PERIOD]=ge:' + from;
}

// SDMX-JSON 2.0 → { '2026-08': 100.1, ... }
function parseSdmx(json) {
  const data = json && json.data;
  const structure = data && data.structures && data.structures[0];
  const dataSet = data && data.dataSets && data.dataSets[0];
  if (!structure || !dataSet || !dataSet.series) throw new Error('Неочікувана структура відповіді SDMX');
  const tp = (structure.dimensions.observation || []).find(d => d.id === 'TIME_PERIOD');
  if (!tp) throw new Error('У відповіді немає виміру TIME_PERIOD');
  const seriesList = Object.values(dataSet.series);
  if (seriesList.length !== 1) throw new Error('Очікувався один ряд, отримано ' + seriesList.length);
  const out = {};
  for (const [idx, obs] of Object.entries(seriesList[0].observations || {})) {
    const period = tp.values[Number(idx)] && (tp.values[Number(idx)].value || tp.values[Number(idx)].id);
    const m = /^(\d{4})-M(\d{2})$/.exec(period || '');
    if (!m) throw new Error('Неочікуваний формат періоду: ' + period);
    const v = Number(String(obs[0]).replace(',', '.'));
    out[m[1] + '-' + m[2]] = v;
  }
  return sortObj(out);
}

function sortObj(o) {
  const r = {};
  for (const k of Object.keys(o).sort()) r[k] = o[k];
  return r;
}

function nextMonth(ym) {
  let [y, m] = ym.split('-').map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return y + '-' + String(m).padStart(2, '0');
}

// Перевірки перед використанням: ряд безперервний, значення правдоподібні,
// і він не коротший за вже відому (запасну) копію.
function validate(indices, fallback) {
  const keys = Object.keys(indices);
  const errors = [];
  if (keys.length < 120) errors.push('Замало місяців у ряді: ' + keys.length);
  if (keys[0] !== '2000-01') errors.push('Ряд починається не з 2000-01, а з ' + keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] !== nextMonth(keys[i - 1])) { errors.push('Розрив у ряді після ' + keys[i - 1]); break; }
  }
  for (const k of keys) {
    const v = indices[k];
    if (!Number.isFinite(v) || v < 80 || v > 130) { errors.push('Неправдоподібне значення ' + k + ' = ' + v); break; }
  }
  const revised = [];
  if (fallback && fallback.indices) {
    const fbKeys = Object.keys(fallback.indices);
    const fbLast = fbKeys[fbKeys.length - 1];
    if (keys[keys.length - 1] < fbLast) errors.push('Останній місяць (' + keys[keys.length - 1] + ') раніший за запасну копію (' + fbLast + ')');
    for (const k of fbKeys) {
      if (k in indices && Math.abs(indices[k] - fallback.indices[k]) > 1e-9) revised.push(k + ': ' + fallback.indices[k] + ' → ' + indices[k]);
    }
  }
  return { ok: errors.length === 0, errors, revised, latest: keys[keys.length - 1] };
}

async function fetchCpi({ timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(sourceUrl(), {
      headers: { Accept: 'application/vnd.sdmx.data+json;version=2.0.0' },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('Держстат HTTP ' + res.status);
    return parseSdmx(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { SOURCE, SERIES_KEY, sourceUrl, parseSdmx, validate, fetchCpi, nextMonth };
