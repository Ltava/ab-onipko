// Тести бібліотеки розрахунків розділу «Інструменти».
// Запуск: node tools/test-instrumenty.js   (папка tools/ не потрапляє на хостинг — див. .vercelignore)

const assert = require('assert');
const L = require('../assets/js/instrumenty-lib.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

// ── Дати ──────────────────────────────────────────────────────────────
t('parse відхиляє неіснуючу дату', () => assert.strictEqual(L.parse('2026-02-30'), null));
t('addMonths: 31 січня + 1 місяць = 28 лютого (ч. 4 ст. 120 КАС)', () => assert.strictEqual(L.addMonths('2026-01-31', 1), '2026-02-28'));
t('addMonths: 31 січня 2024 + 1 = 29 лютого (високосний)', () => assert.strictEqual(L.addMonths('2024-01-31', 1), '2024-02-29'));
t('addMonths: перехід через рік', () => assert.strictEqual(L.addMonths('2026-11-15', 3), '2027-02-15'));
t('addMonths: 31 серпня + 6 = 28 лютого', () => assert.strictEqual(L.addMonths('2026-08-31', 6), '2027-02-28'));

// ── Строки ────────────────────────────────────────────────────────────
t('10 днів від середи 01.10.2026 → неділя 11.10, без перенесення (КУпАП)', () => {
  const r = L.term('2026-10-01', 10, 'days');
  assert.strictEqual(r.start, '2026-10-02');
  assert.strictEqual(r.end, '2026-10-11');
  assert.strictEqual(r.weekendAtNominal, true);
  assert.strictEqual(r.shifted, false);
});
t('10 днів з перенесенням вихідного → понеділок 12.10 (ч. 6 ст. 120 КАС)', () => {
  const r = L.term('2026-10-01', 10, 'days', { shiftWeekend: true });
  assert.strictEqual(r.end, '2026-10-12');
  assert.strictEqual(r.shifted, true);
});
t('Місячний строк від 15.09.2026 → 15.10.2026 (четвер)', () => {
  assert.strictEqual(L.term('2026-09-15', 1, 'months', { shiftWeekend: true }).end, '2026-10-15');
});
t('Святковий день не переносить строк, але позначається', () => {
  const r = L.term('2026-08-14', 10, 'days', { shiftWeekend: true }); // 24.08.2026 — понеділок
  assert.strictEqual(r.end, '2026-08-24');
  assert.ok(/Незалежності/.test(r.holidayAtEnd));
});

// ── 3% річних ────────────────────────────────────────────────────────
t('3% річних: 100 000 ₴ за 365 днів 2025 року = 3 000 ₴', () => {
  const r = L.threePercent(100000, '2025-01-01', '2025-12-31');
  assert.strictEqual(r.total, 3000);
  assert.strictEqual(r.days, 365);
});
t('3% річних: високосний 2024 рік ділиться на 366', () => {
  const r = L.threePercent(100000, '2024-01-01', '2024-12-31');
  assert.strictEqual(r.total, 3000);
  assert.strictEqual(r.rows[0].yearDays, 366);
});
t('3% річних: розбиття на два роки', () => {
  const r = L.threePercent(36500, '2025-12-31', '2026-01-01');
  assert.strictEqual(r.rows.length, 2);
  assert.strictEqual(r.total, 6);
});
t('3% річних: кредит/позика — дні з 24.02.2022 не нараховуються', () => {
  const r = L.threePercent(100000, '2022-01-01', '2026-10-08', { creditExemption: true });
  assert.strictEqual(r.days, 54); // 01.01–23.02.2022
  assert.strictEqual(r.rows[r.rows.length - 1].to, '2022-02-23');
  assert.ok(r.excludedDays > 1600);
});
t('3% річних: кредит, прострочення після 24.02.2022 → 0', () => {
  const r = L.threePercent(50000, '2023-05-01', '2026-10-08', { creditExemption: true });
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.days, 0);
});
t('3% річних: кінцева дата раніша за початкову → помилка', () => {
  assert.throws(() => L.threePercent(1000, '2026-02-01', '2026-01-01'));
});

// ── Спадщина ─────────────────────────────────────────────────────────
t('Спадщина: 6 місяців від 10.03.2026 → 10.09.2026 (четвер)', () => {
  const r = L.inheritance('2026-03-10');
  assert.strictEqual(r.end, '2026-09-10');
  assert.strictEqual(r.basis, 'death');
});
t('Спадщина: реєстрація смерті пізніше ніж через місяць → від дня реєстрації', () => {
  const r = L.inheritance('2025-01-05', { registrationDate: '2025-04-20' });
  assert.strictEqual(r.basis, 'registration');
  assert.strictEqual(r.end, '2025-10-20');
});
t('Спадщина: реєстрація в межах місяця → від дня смерті', () => {
  const r = L.inheritance('2025-01-05', { registrationDate: '2025-02-01' });
  assert.strictEqual(r.basis, 'death');
});
t('Спадщина: вихідний в кінці строку переноситься (ч. 5 ст. 254 ЦК)', () => {
  const r = L.inheritance('2026-04-11'); // 11.10.2026 — неділя
  assert.strictEqual(r.end, '2026-10-12');
});
t('Спадщина: ч. 2 ст. 1270 — три місяці від неприйняття', () => {
  const r = L.inheritance('2025-01-10', { secondary: true, eventDate: '2025-07-11' });
  assert.strictEqual(r.basis, 'secondary');
  assert.strictEqual(r.end, '2025-10-13'); // 11.10.2025 — субота
});

// ── Судовий збір 2026 (ПМ = 3 328 ₴) ─────────────────────────────────
t('Розірвання шлюбу: 0,4 ПМ = 1 331,20 ₴', () => assert.strictEqual(L.courtFee('civ-divorce', 'fiz').amount, 1331.2));
t('Розірвання шлюбу через «Електронний суд»: 1 064,96 ₴', () => assert.strictEqual(L.courtFee('civ-divorce', 'fiz', 0, { electronic: true }).amount, 1064.96));
t('Майновий позов фізособи 50 000 ₴ → мінімум 1 331,20 ₴', () => assert.strictEqual(L.courtFee('civ-property', 'fiz', 50000).amount, 1331.2));
t('Майновий позов фізособи 500 000 ₴ → 1% = 5 000 ₴', () => assert.strictEqual(L.courtFee('civ-property', 'fiz', 500000).amount, 5000));
t('Майновий позов фізособи 5 000 000 ₴ → максимум 5 ПМ = 16 640 ₴', () => assert.strictEqual(L.courtFee('civ-property', 'fiz', 5000000).amount, 16640));
t('Господарський позов 1 000 000 ₴ → 15 000 ₴', () => assert.strictEqual(L.courtFee('gos-property', 'yur', 1000000).amount, 15000));
t('Апеляція фізособи у майновому спорі: 150%, не більше 8 ПМ', () => {
  const r = L.courtFee('civ-property', 'fiz', 5000000, { appeal: true });
  assert.strictEqual(r.appealAmount, 24960); // 16 640 × 1,5 = 24 960 < 26 624
});
t('Апеляція у сімейному спорі: не більше 3 ПМ', () => {
  const r = L.courtFee('civ-property', 'fiz', 5000000, { appeal: true, socialFamily: true });
  assert.strictEqual(r.appealAmount, 9984);
});
t('Окреме провадження фізособи: 0,2 ПМ = 665,60 ₴', () => assert.strictEqual(L.courtFee('civ-special', 'fiz').amount, 665.6));
t('Майновий позов без ціни → помилка', () => assert.throws(() => L.courtFee('civ-property', 'fiz', 0)));

// ── Календар ─────────────────────────────────────────────────────────
t('ICS містить подію на весь день і нагадування', () => {
  const s = L.ics('2026-10-12', 'Останній день; строк', 'Опис, з комою');
  assert.ok(s.includes('DTSTART;VALUE=DATE:20261012'));
  assert.ok(s.includes('DTEND;VALUE=DATE:20261013'));
  assert.ok(s.includes('TRIGGER:-P3D'));
  assert.ok(s.includes('Останній день\\; строк'));
});
t('Посилання Google Календаря коректне', () => {
  const u = L.googleCalendarUrl('2026-10-12', 'Строк', 'Опис');
  assert.ok(u.includes('dates=20261012/20261013'));
});

// ── Ціни в пропозиціях калькуляторів збігаються з серверним каталогом ──
t('Ціни в instrumenty-ui.js = ціни в api/_lib/catalog.js', () => {
  const fs = require('fs');
  const path = require('path');
  const catalog = require('../api/_lib/catalog.js');
  const ui = fs.readFileSync(path.join(__dirname, '../assets/js/instrumenty-ui.js'), 'utf8');
  const re = /'([a-z0-9-]+)':\s*\{[^}]*?price:\s*(\d+)/g;
  let m, n = 0;
  while ((m = re.exec(ui))) {
    assert.ok(catalog[m[1]], 'Немає в каталозі: ' + m[1]);
    assert.strictEqual(Number(m[2]), catalog[m[1]].price, 'Ціна не збігається: ' + m[1]);
    n++;
  }
  assert.ok(n >= 10, 'Знайдено замало пропозицій: ' + n);
});

console.log((process.exitCode ? '✗ Є помилки. ' : '✓ ') + 'Пройдено тестів: ' + passed);
