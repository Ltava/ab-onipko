// Бібліотека розрахунків для розділу «Інструменти».
// Чисті функції без доступу до DOM: їх використовують сторінки калькуляторів у браузері
// і тести tools/test-instrumenty.js у Node.
//
// Дати — рядки 'YYYY-MM-DD'. Усередині — UTC, щоб часовий пояс не зсував день.
// Норми звірено з текстами на zakon.rada.gov.ua станом на 08.10.2026:
//   КАС ст. 120, 122, 286; КУпАП ст. 289, 294; ЦК ст. 625, 1270, п. 18, 20 розд. «Прикінцеві
//   та перехідні положення»; КЗпП ст. 73; Закон № 2136-IX ч. 6 ст. 6; Закон «Про судовий збір» ст. 4.

(function (root) {
  'use strict';

  // ── Дані, які оновлюються щороку ────────────────────────────────────
  // Прожитковий мінімум для працездатних осіб на 1 січня (Закон про Державний бюджет).
  const PM = { 2026: 3328 };
  const PM_LATEST_YEAR = 2026;

  // Дата введення воєнного стану (Указ № 64/2022).
  const MARTIAL_LAW_START = '2022-02-24';

  // Святкові дні за ст. 73 КЗпП (фіксовані дати; Великдень і Трійця завжди неділя).
  // Під час воєнного стану ст. 73 не застосовується (ч. 6 ст. 6 Закону № 2136-IX),
  // тому калькулятори НЕ переносять строк зі святкового дня, а лише попереджають.
  const HOLIDAYS = {
    '01-01': 'Новий рік', '03-08': 'Міжнародний жіночий день', '05-01': 'День праці',
    '05-08': 'День пам’яті та перемоги над нацизмом', '06-28': 'День Конституції України',
    '07-15': 'День Української Державності', '08-24': 'День Незалежності України',
    '10-01': 'День захисників і захисниць України', '12-25': 'Різдво Христове'
  };

  const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня',
    'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];

  // ── Дати ────────────────────────────────────────────────────────────
  function parse(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d);
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return t;
  }
  function fmt(t) { return new Date(t).toISOString().slice(0, 10); }
  function addDays(s, n) { return fmt(parse(s) + n * 86400000); }
  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }
  function addMonths(s, n) {
    const d = new Date(parse(s));
    const y = d.getUTCFullYear(), m0 = d.getUTCMonth() + n, day = d.getUTCDate();
    const ty = y + Math.floor(m0 / 12), tm = ((m0 % 12) + 12) % 12;
    return fmt(Date.UTC(ty, tm, Math.min(day, daysInMonth(ty, tm))));
  }
  function weekday(s) { return new Date(parse(s)).getUTCDay(); }
  function isWeekend(s) { const w = weekday(s); return w === 0 || w === 6; }
  function holiday(s) { return HOLIDAYS[s.slice(5)] || null; }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function human(s) {
    const d = new Date(parse(s));
    return d.getUTCDate() + ' ' + MONTHS_GEN[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ' р. (' + WEEKDAYS[d.getUTCDay()] + ')';
  }
  function today() {
    const n = new Date();
    return fmt(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }

  // Строк, що обчислюється днями або місяцями від події (ч. 1, 3, 4 ст. 120 КАС; ст. 253, 254 ЦК):
  // перебіг починається з наступного дня; місячний строк спливає у відповідне число,
  // а якщо такого числа немає — в останній день місяця.
  //
  // opts.shiftWeekend — чи переносити кінець строку з суботи/неділі на понеділок (ч. 6 ст. 120 КАС,
  // ч. 5 ст. 254 ЦК). Святкові дні не переносимо (воєнний стан), але повертаємо попередження.
  function term(eventDate, amount, unit, opts) {
    opts = opts || {};
    if (parse(eventDate) === null) throw new Error('Некоректна дата');
    const nominal = unit === 'months' ? addMonths(eventDate, amount) : addDays(eventDate, amount);
    let end = nominal;
    let shifted = false;
    if (opts.shiftWeekend) {
      while (isWeekend(end)) { end = addDays(end, 1); shifted = true; }
    }
    return {
      start: addDays(eventDate, 1),
      nominal,
      end,
      shifted,
      weekendAtNominal: isWeekend(nominal),
      holidayAtEnd: holiday(end),
      daysLeft: diffDays(today(), end)
    };
  }

  // ── 3% річних (ч. 2 ст. 625 ЦК) ─────────────────────────────────────
  // Нараховуються за кожен календарний день прострочення: сума × 3% × дні / кількість днів року.
  // from — перший день прострочення, to — останній день (включно).
  // opts.creditExemption — борг за кредитом/позикою: з 24.02.2022 позичальник звільняється від
  //   відповідальності за ст. 625 (п. 18 розд. «Прикінцеві та перехідні положення» ЦК), тож
  //   дні від цієї дати не нараховуються, доки триває воєнний стан і 30 днів після нього.
  function threePercent(amount, from, to, opts) {
    opts = opts || {};
    const rate = typeof opts.rate === 'number' ? opts.rate : 3;
    if (!(amount > 0) || parse(from) === null || parse(to) === null) throw new Error('Некоректні дані');
    if (parse(to) < parse(from)) throw new Error('Кінцева дата раніша за початкову');
    let end = to;
    let excludedDays = 0;
    if (opts.creditExemption && parse(to) >= parse(MARTIAL_LAW_START)) {
      const lastCounted = addDays(MARTIAL_LAW_START, -1);
      excludedDays = diffDays(parse(from) > parse(MARTIAL_LAW_START) ? from : MARTIAL_LAW_START, to) + 1;
      if (parse(lastCounted) < parse(from)) {
        return { total: 0, days: 0, excludedDays, rows: [], rate };
      }
      end = lastCounted;
    }
    const rows = [];
    let cur = from;
    let total = 0;
    let days = 0;
    while (parse(cur) <= parse(end)) {
      const y = new Date(parse(cur)).getUTCFullYear();
      const yearEnd = y + '-12-31';
      const segEnd = parse(yearEnd) < parse(end) ? yearEnd : end;
      const n = diffDays(cur, segEnd) + 1;
      const yd = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
      const sum = amount * rate / 100 * n / yd;
      rows.push({ from: cur, to: segEnd, days: n, yearDays: yd, sum: round2(sum) });
      total += sum;
      days += n;
      cur = addDays(segEnd, 1);
    }
    return { total: round2(total), days, excludedDays, rows, rate };
  }

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  // ── Строк прийняття спадщини (ст. 1270 ЦК, п. 20 розд. «Прикінцеві та перехідні положення») ──
  // opts.registrationDate — дата державної реєстрації смерті. Якщо смерть зареєстровано пізніше
  //   ніж через один місяць після смерті, строки під час воєнного стану обчислюються з дня реєстрації.
  // opts.secondary — право на спадкування залежить від неприйняття/відмови інших спадкоємців
  //   (ч. 2 ст. 1270): три місяці від цієї події (eventDate).
  function inheritance(deathDate, opts) {
    opts = opts || {};
    if (parse(deathDate) === null) throw new Error('Некоректна дата');
    if (opts.secondary) {
      if (parse(opts.eventDate) === null) throw new Error('Вкажіть дату неприйняття чи відмови');
      const r = term(opts.eventDate, 3, 'months', { shiftWeekend: true });
      const main = term(deathDate, 6, 'months', { shiftWeekend: true });
      // Якщо від основного шестимісячного строку лишилося більше трьох місяців — діє він.
      if (parse(main.end) > parse(r.end)) return Object.assign(main, { basis: 'main-longer' });
      return Object.assign(r, { basis: 'secondary' });
    }
    let from = deathDate;
    let basis = 'death';
    if (opts.registrationDate && parse(opts.registrationDate) !== null) {
      const lateThreshold = addMonths(deathDate, 1);
      if (parse(opts.registrationDate) > parse(lateThreshold) &&
          parse(deathDate) >= parse(MARTIAL_LAW_START)) {
        from = opts.registrationDate;
        basis = 'registration';
      }
    }
    return Object.assign(term(from, 6, 'months', { shiftWeekend: true }), { basis, from });
  }

  // ── Судовий збір (ст. 4 Закону «Про судовий збір») ─────────────────
  // Повертає { amount, formula, pm } або кидає помилку. Ставки — частки ПМ або відсотки ціни позову.
  const FEE_RULES = {
    // Цивільний процес
    'civ-property':        { title: 'Позов майнового характеру', pct: { fiz: 1, fop: 1, yur: 1.5 }, min: { fiz: 0.4, fop: 0.4, yur: 1 }, max: { fiz: 5, fop: 5, yur: 350 } },
    'civ-nonproperty':     { title: 'Позов немайнового характеру', fixed: { fiz: 0.4, fop: 1, yur: 1 } },
    'civ-divorce':         { title: 'Позов про розірвання шлюбу', fixed: { fiz: 0.4, fop: 0.4, yur: 0.4 } },
    'civ-divorce-split':   { title: 'Поділ майна при розірванні шлюбу', pct: { fiz: 1, fop: 1, yur: 1 }, min: { fiz: 0.4, fop: 0.4, yur: 0.4 }, max: { fiz: 3, fop: 3, yur: 3 } },
    'civ-special':         { title: 'Заява в окремому провадженні, про забезпечення позову чи доказів, про перегляд заочного рішення', fixed: { fiz: 0.2, fop: 0.5, yur: 0.5 } },
    'civ-order':           { title: 'Заява про видачу судового наказу', fixed: { fiz: 0.1, fop: 0.1, yur: 0.1 } },
    'civ-appeal-ruling':   { title: 'Апеляційна скарга на ухвалу суду', fixed: { fiz: 0.2, fop: 1, yur: 1 } },
    // Адміністративний процес
    'adm-property':        { title: 'Адміністративний позов майнового характеру', pct: { fiz: 1, fop: 1, yur: 1.5 }, min: { fiz: 0.4, fop: 0.4, yur: 1 }, max: { fiz: 5, fop: 5, yur: 10 } },
    'adm-nonproperty':     { title: 'Адміністративний позов немайнового характеру', fixed: { fiz: 0.4, fop: 1, yur: 1 } },
    // Господарський процес
    'gos-property':        { title: 'Позов майнового характеру до господарського суду', pct: { fiz: 1.5, fop: 1.5, yur: 1.5 }, min: { fiz: 1, fop: 1, yur: 1 }, max: { fiz: 350, fop: 350, yur: 350 } },
    'gos-nonproperty':     { title: 'Позов немайнового характеру до господарського суду', fixed: { fiz: 1, fop: 1, yur: 1 } }
  };

  function courtFee(type, payer, claim, opts) {
    opts = opts || {};
    const year = opts.year || PM_LATEST_YEAR;
    const pm = PM[year];
    if (!pm) throw new Error('Немає даних про прожитковий мінімум на ' + year + ' рік');
    const rule = FEE_RULES[type];
    if (!rule) throw new Error('Невідомий тип документа');
    if (!['fiz', 'fop', 'yur'].includes(payer)) throw new Error('Невідомий платник');
    let amount;
    let formula;
    if (rule.fixed) {
      amount = rule.fixed[payer] * pm;
      formula = fmtNum(rule.fixed[payer]) + ' × ПМ (' + fmtMoney(pm) + ')';
    } else {
      if (!(claim > 0)) throw new Error('Вкажіть ціну позову');
      const raw = claim * rule.pct[payer] / 100;
      const lo = rule.min[payer] * pm;
      const hi = rule.max[payer] * pm;
      amount = Math.min(Math.max(raw, lo), hi);
      formula = fmtNum(rule.pct[payer]) + '% ціни позову, не менше ' + fmtNum(rule.min[payer]) +
        ' ПМ і не більше ' + fmtNum(rule.max[payer]) + ' ПМ';
      if (amount === lo && raw < lo) formula += ' → застосовано мінімум';
      if (amount === hi && raw > hi) formula += ' → застосовано максимум';
    }
    let appealAmount = null;
    if (opts.appeal) {
      // Апеляційна скарга на рішення: 150% ставки за позов; для фізособи/ФОП у цивільному процесі —
      // не більше 8 ПМ (майнові) або 3 ПМ (соціальні, трудові, сімейні, житлові права);
      // в адміністративному — не більше 15 ПМ.
      appealAmount = amount * 1.5;
      if (type.startsWith('civ') && payer !== 'yur') {
        const cap = (opts.socialFamily ? 3 : 8) * pm;
        appealAmount = Math.min(appealAmount, cap);
      }
      if (type.startsWith('adm')) appealAmount = Math.min(appealAmount, 15 * pm);
    }
    const k = opts.electronic ? 0.8 : 1;
    return {
      title: rule.title,
      amount: round2(amount * k),
      appealAmount: appealAmount === null ? null : round2(appealAmount * k),
      formula: formula + (opts.electronic ? '; × 0,8 за подання в електронній формі' : ''),
      pm,
      year
    };
  }

  function fmtNum(x) { return String(x).replace('.', ','); }
  function fmtMoney(x) {
    return x.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₴';
  }

  // ── Календар (.ics і Google Календар) ───────────────────────────────
  function icsEscape(s) { return String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n'); }
  function ics(date, title, description) {
    const d = date.replace(/-/g, '');
    const next = addDays(date, 1).replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const uid = d + '-' + Math.random().toString(36).slice(2) + '@advokatonipko.com';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//advokatonipko.com//Instrumenty//UK', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + next,
      'SUMMARY:' + icsEscape(title), 'DESCRIPTION:' + icsEscape(description),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(title), 'TRIGGER:-P3D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(title), 'TRIGGER:-P1D', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', ''
    ].join('\r\n');
  }
  function googleCalendarUrl(date, title, description) {
    const d = date.replace(/-/g, '');
    const next = addDays(date, 1).replace(/-/g, '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(title) +
      '&dates=' + d + '/' + next +
      '&details=' + encodeURIComponent(description);
  }

  const Lib = {
    PM, PM_LATEST_YEAR, MARTIAL_LAW_START, HOLIDAYS, FEE_RULES,
    parse, fmt, addDays, addMonths, isWeekend, holiday, diffDays, human, today,
    term, threePercent, inheritance, courtFee, round2, fmtMoney, ics, googleCalendarUrl
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Lib;
  else root.Instrumenty = Lib;
})(this);
