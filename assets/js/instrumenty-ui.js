// Інтерфейс сторінок розділу «Інструменти». Розрахунки — у instrumenty-lib.js.
// Нічого з введених даних не надсилається на сервер, крім форми «Перевірка судових справ».

(function () {
  'use strict';
  const L = window.Instrumenty;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (x) => L.fmtMoney(x);

  // Пропозиції ведуть на сторінки товарів. Ціни мають збігатися з api/_lib/catalog.js —
  // це перевіряє tools/test-instrumenty.js.
  const OFFERS = {
    'kupap130-apeliatsiya-shablon': { t: 'Шаблон апеляційної скарги (ч. 1 ст. 130 КУпАП)', d: 'З клопотанням про поновлення строку', price: 590, href: 'zrazok-apeliatsiya-130-kupap.html' },
    'kupap130-apeliatsiya-personal': { t: 'Апеляційну скаргу складе адвокат', d: 'Під обставини вашої справи, за договором', price: 3499, from: true, href: 'zrazok-apeliatsiya-130-kupap.html' },
    'kupap130-zaperechennya-shablon': { t: 'Шаблон письмових заперечень (ч. 1 ст. 130 КУпАП)', d: 'Якщо справа ще розглядається в суді першої інстанції', price: 490, href: 'zrazok-zaperechennya-130-kupap.html' },
    'admin-pozov-shablon': { t: 'Шаблон адміністративного позову', d: 'Оскарження рішення, наказу чи висновку органу влади', price: 490, href: 'zrazok-oskarzhennya-rishennya-vlady.html' },
    'admin-pozov-personal': { t: 'Адміністративний позов складе адвокат', d: 'Під вашу справу, за договором', price: 3499, from: true, href: 'zrazok-oskarzhennya-rishennya-vlady.html' },
    'voiskovi-vlk': { t: 'Шаблон: оскарження висновку ВЛК', d: 'Розділ «Військовим»', price: 250, href: 'index.html#military' },
    'borg-shablon': { t: 'Шаблон позову про стягнення боргу за розпискою', d: 'Цивільне право', price: 449, href: 'zrazok-pozovu-borg-rozpyska.html' },
    'borg-personal': { t: 'Позов про стягнення боргу складе адвокат', d: 'З розрахунком сум під вашу справу', price: 2999, from: true, href: 'zrazok-pozovu-borg-rozpyska.html' },
    'postavka-shablon': { t: 'Шаблон позову про борг за договором поставки', d: 'Для господарського суду', price: 790, href: 'zrazok-styagnennya-borgu-postavka.html' },
    'spadshchyna-shablon': { t: 'Шаблон позову про визнання права на спадщину', d: 'Фактичне прийняття або пропущений строк', price: 590, href: 'zrazok-spadshchyna.html' },
    'spadshchyna-personal': { t: 'Позов щодо спадщини складе адвокат', d: 'Під вашу справу, за договором', price: 3499, from: true, href: 'zrazok-spadshchyna.html' },
    'voiskovi-spadshchyna-fakt': { t: 'Шаблон: встановлення факту для спадщини загиблого', d: 'Розділ «Військовим»', price: 250, href: 'index.html#military' },
    'rozluchennya-shablon': { t: 'Шаблон позову про розірвання шлюбу', d: 'Два варіанти: стислий і розширений', price: 349, href: 'zrazok-pozovu-rozluchennya.html' },
    'konsultatsiya': { t: 'Консультація адвоката, 30 хв', d: 'Онлайн або телефоном', price: 1000, href: 'index.html#contact' }
  };

  function offersHtml(keys, title, text) {
    const rows = keys.map((k) => {
      const o = OFFERS[k];
      return '<div class="offer"><div><div class="t"><a href="' + o.href + '">' + esc(o.t) + '</a></div>' +
        '<div class="d">' + esc(o.d) + '</div></div><div class="p">' + (o.from ? 'від ' : '') +
        o.price.toLocaleString('uk-UA') + ' ₴</div></div>';
    }).join('');
    return '<div class="next"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + rows +
      '<div class="actions"><a class="btn btn-primary" href="index.html#contact">Поставити питання адвокату</a>' +
      '<a class="btn btn-ghost" href="https://t.me/advokatonipko" target="_blank" rel="noopener">Написати в Telegram</a></div></div>';
  }

  function note(kind, html) { return '<div class="note ' + kind + '">' + html + '</div>'; }

  function daysWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'днів';
    if (b === 1) return 'день';
    if (b >= 2 && b <= 4) return 'дні';
    return 'днів';
  }

  // Головний блок результату для строку + кнопки календаря.
  function deadlineHtml(r, label, calTitle, calDesc) {
    const expired = r.daysLeft < 0;
    let s;
    if (expired) s = 'Строк сплив ' + Math.abs(r.daysLeft) + ' ' + daysWord(r.daysLeft) + ' тому.';
    else if (r.daysLeft === 0) s = 'Сьогодні — останній день.';
    else s = 'Залишилося ' + (r.daysLeft + 1) + ' ' + daysWord(r.daysLeft + 1) + ', враховуючи сьогоднішній.';
    let html = '<div class="result-main' + (expired ? ' expired' : '') + '" role="status">' +
      '<div class="k">' + esc(label) + '</div><div class="v">' + esc(L.human(r.end)) + '</div>' +
      '<div class="s">' + esc(s) + '</div></div>';
    if (!expired) {
      html += '<div class="actions">' +
        '<button type="button" class="btn btn-green" data-ics>Додати в календар (.ics)</button>' +
        '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' +
        esc(L.googleCalendarUrl(r.end, calTitle, calDesc)) + '">Google Календар</a>' +
        '<button type="button" class="btn btn-ghost" data-print>Друкувати</button></div>';
    }
    return html;
  }

  function bindResultButtons(box, r, calTitle, calDesc) {
    const icsBtn = box.querySelector('[data-ics]');
    if (icsBtn) icsBtn.addEventListener('click', () => {
      const blob = new Blob([L.ics(r.end, calTitle, calDesc)], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'strok-' + r.end + '.ics';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    const pr = box.querySelector('[data-print]');
    if (pr) pr.addEventListener('click', () => window.print());
  }

  function show(box, html) {
    box.innerHTML = html;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function err(box, msg) { show(box, note('danger', esc(msg))); }

  function holidayNote(r) {
    if (!r.holidayAtEnd) return '';
    return note('warn', '<strong>Останній день припадає на святковий день (' + esc(r.holidayAtEnd) + ').</strong> ' +
      'Під час воєнного стану ст. 73 КЗпП про святкові дні не застосовується, тому ми не переносимо строк. ' +
      'Подайте документ не пізніше цієї дати.');
  }

  // ── 1. Строк оскарження постанови у справі про адмінправопорушення ──
  function initKupap() {
    const form = $('calcForm'), box = $('result');
    const dateLabel = $('dateLabel'), traffic = $('trafficWrap');
    function sync() {
      const v = form.route.value;
      traffic.hidden = v !== 'police-court';
      const byService = v === 'police-court' && $('traffic').checked;
      dateLabel.textContent = byService ? 'Дата вручення постанови' : (v === 'kas-appeal' ? 'Дата проголошення рішення суду' : 'Дата винесення постанови');
    }
    form.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = $('date').value;
      if (!L.parse(date)) return err(box, 'Вкажіть дату.');
      if (L.parse(date) > L.parse(L.today())) return err(box, 'Дата не може бути в майбутньому.');
      const route = form.route.value;
      const is130 = $('art130').checked;
      const kas = route === 'police-court' || route === 'kas-appeal';
      const r = L.term(date, 10, 'days', { shiftWeekend: kas });
      const what = {
        'court-appeal': ['Останній день подання апеляційної скарги', 'ч. 2 ст. 294 КУпАП: 10 днів з дня винесення постанови.'],
        'police-higher': ['Останній день подання скарги до вищестоящого органу', 'ст. 289 КУпАП: 10 днів з дня винесення постанови.'],
        'police-court': ['Останній день подання позову до суду', $('traffic').checked
          ? 'ч. 2 ст. 286 КАС: у сфері дорожнього руху — 10 днів з дня вручення постанови.'
          : 'ч. 2 ст. 286 КАС: 10 днів з дня ухвалення постанови.'],
        'kas-appeal': ['Останній день подання апеляційної скарги', 'ч. 4 ст. 286 КАС: 10 днів з дня проголошення рішення.']
      }[route];
      const calTitle = what[0];
      const calDesc = what[1] + ' Розраховано на advokatonipko.com/instrumenty. Орієнтовний розрахунок — перевірте з адвокатом.';
      let html = deadlineHtml(r, what[0], calTitle, calDesc);
      html += '<ul class="facts"><li><span>Підстава</span><span>' + esc(what[1]) + '</span></li>' +
        '<li><span>Перший день строку</span><span>' + esc(L.human(r.start)) + '</span></li>' +
        (r.shifted ? '<li><span>Перенесено з вихідного</span><span>' + esc(L.human(r.nominal)) + ' → ' + esc(L.human(r.end)) + '</span></li>' : '') +
        '</ul>';
      if (!kas && r.weekendAtNominal) {
        html += note('warn', '<strong>Строк спливає у вихідний.</strong> КУпАП не містить прямого правила про перенесення ' +
          'строку з вихідного дня на робочий. Щоб не ризикувати, подайте скаргу до цієї дати — поштою чи через «Електронний суд» ' +
          'це можна зробити й у вихідний.');
      }
      html += holidayNote(r);
      if (r.daysLeft < 0) {
        html += note('danger', '<strong>Строк уже минув, але це не завжди кінець.</strong> Якщо його пропущено з поважних причин ' +
          '(наприклад, копію постанови ви отримали пізніше), разом зі скаргою чи позовом подається клопотання (заява) про поновлення строку. ' +
          'Чим раніше ви це зробите, тим більше шансів.');
      }
      if (route === 'police-higher') {
        html += note('ok', 'Постанову поліції можна оскаржити або до вищестоящого органу, або одразу до суду (ст. 288 КУпАП). ' +
          'Судовий порядок часто ефективніший — порівняйте варіант «позов до суду».');
      }
      const offers = route === 'court-appeal' || route === 'kas-appeal'
        ? (is130 ? ['kupap130-apeliatsiya-shablon', 'kupap130-apeliatsiya-personal', 'konsultatsiya'] : ['konsultatsiya'])
        : (route === 'police-court' ? ['admin-pozov-shablon', 'admin-pozov-personal', 'konsultatsiya'] : ['konsultatsiya']);
      html += offersHtml(offers, r.daysLeft < 0 ? 'Строк пропущено? Допоможемо з поновленням' : 'Що зробити до кінця строку',
        is130 ? 'У справах за ст. 130 КУпАП (позбавлення права керування) якість скарги часто вирішальна.'
          : 'Скарга має бути подана вчасно і з правильними аргументами.');
      show(box, html);
      bindResultButtons(box, r, calTitle, calDesc);
    });
  }

  // ── 2. Строк звернення до суду у спорах щодо військової служби ──
  function initMilitary() {
    const form = $('calcForm'), box = $('result');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = $('date').value;
      if (!L.parse(date)) return err(box, 'Вкажіть дату.');
      if (L.parse(date) > L.parse(L.today())) return err(box, 'Дата не може бути в майбутньому.');
      const r = L.term(date, 1, 'months', { shiftWeekend: true });
      const calTitle = 'Останній день звернення до адміністративного суду (військова служба)';
      const calDesc = 'ч. 5 ст. 122 КАС: місячний строк у спорах щодо проходження публічної (військової) служби. Орієнтовний розрахунок — перевірте з адвокатом.';
      let html = deadlineHtml(r, 'Останній день подання позову', calTitle, calDesc);
      html += '<ul class="facts"><li><span>Підстава</span><span>ч. 5 ст. 122 КАС — місячний строк</span></li>' +
        '<li><span>Перший день строку</span><span>' + esc(L.human(r.start)) + '</span></li>' +
        (r.shifted ? '<li><span>Перенесено з вихідного</span><span>' + esc(L.human(r.nominal)) + ' → ' + esc(L.human(r.end)) + '</span></li>' : '') +
        '</ul>';
      html += holidayNote(r);
      html += note('warn', '<strong>Від якої дати рахувати — ключове питання.</strong> Строк обчислюється з дня, коли ви дізналися ' +
        'або <em>повинні були дізнатися</em> про порушення (ч. 2–3 ст. 122 КАС): наприклад, день ознайомлення з наказом чи висновком ВЛК. ' +
        'Суд може вважати, що ви мали дізнатися раніше. Якщо сумніваєтеся — рахуйте від найранішої можливої дати.');
      html += note('warn', 'У спорах про грошове забезпечення та виплати при звільненні строки можуть визначатися інакше, ' +
        'а якщо ви оскаржували рішення у досудовому порядку — діють правила ч. 4 ст. 122 КАС. Ці випадки варто перевірити з адвокатом.');
      html += note('ok', 'Військовослужбовці звільняються від сплати судового збору у справах, повʼязаних з виконанням військового ' +
        'обовʼязку (п. 12 ч. 1 ст. 5 Закону «Про судовий збір»).');
      if (r.daysLeft < 0) {
        html += note('danger', '<strong>Місячний строк минув.</strong> Суд може поновити його, якщо причини пропуску поважні ' +
          '(ст. 121 КАС) — наприклад, перебування в зоні бойових дій чи на лікуванні. Заяву про поновлення подають разом із позовом.');
      }
      html += offersHtml(['admin-pozov-shablon', 'admin-pozov-personal', 'voiskovi-vlk', 'konsultatsiya'],
        r.daysLeft < 0 ? 'Строк пропущено? Обґрунтуємо поновлення' : 'Встигнути до кінця строку',
        'Позов до адміністративного суду щодо наказу, висновку ВЛК чи відмови командира.');
      show(box, html);
      bindResultButtons(box, r, calTitle, calDesc);
    });
  }

  // ── 3. Строк прийняття спадщини ──
  function initInheritance() {
    const form = $('calcForm'), box = $('result');
    const secWrap = $('secondaryWrap'), regWrap = $('registrationWrap');
    function sync() {
      const sec = $('secondary').checked;
      secWrap.hidden = !sec;
      regWrap.hidden = sec;
    }
    form.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const death = $('death').value;
      if (!L.parse(death)) return err(box, 'Вкажіть дату смерті спадкодавця.');
      if (L.parse(death) > L.parse(L.today())) return err(box, 'Дата не може бути в майбутньому.');
      let r;
      try {
        r = $('secondary').checked
          ? L.inheritance(death, { secondary: true, eventDate: $('eventDate').value })
          : L.inheritance(death, { registrationDate: $('registration').value || null });
      } catch (ex) { return err(box, ex.message); }
      const basisText = {
        death: '6 місяців з дня відкриття спадщини — дня смерті (ч. 1 ст. 1270 ЦК)',
        registration: '6 місяців з дня державної реєстрації смерті — смерть зареєстровано пізніше ніж через місяць (п. 20 розд. «Прикінцеві та перехідні положення» ЦК)',
        secondary: '3 місяці з моменту неприйняття спадщини або відмови інших спадкоємців (ч. 2 ст. 1270 ЦК)',
        'main-longer': '6 місяців з дня смерті: цей строк спливає пізніше за тримісячний, тож діє він (ч. 2 ст. 1270 ЦК)'
      }[r.basis];
      const calTitle = 'Останній день подання заяви про прийняття спадщини';
      const calDesc = basisText + '. Заяву подають нотаріусу за місцем відкриття спадщини. Орієнтовний розрахунок — перевірте з адвокатом чи нотаріусом.';
      let html = deadlineHtml(r, 'Останній день подання заяви нотаріусу', calTitle, calDesc);
      html += '<ul class="facts"><li><span>Підстава</span><span>' + esc(basisText) + '</span></li>' +
        (r.shifted ? '<li><span>Перенесено з вихідного</span><span>' + esc(L.human(r.nominal)) + ' → ' + esc(L.human(r.end)) + ' (ч. 5 ст. 254 ЦК)</span></li>' : '') +
        '</ul>';
      html += holidayNote(r);
      if (r.basis === 'death' && $('registration').value && L.parse(death) < L.parse(L.MARTIAL_LAW_START)) {
        html += note('warn', 'Смерть настала до 24.02.2022. Правило про відлік від дати реєстрації смерті може застосовуватися і в такому разі, ' +
          'якщо строк не сплив до введення воєнного стану і свідоцтво про право на спадщину нікому не видано. Уточніть у нотаріуса чи адвоката.');
      }
      html += note('ok', 'Заяву не потрібно подавати, якщо ви <strong>постійно проживали разом зі спадкодавцем</strong> на час відкриття спадщини — ' +
        'тоді ви вважаєтеся такими, що прийняли спадщину, якщо в цей строк не заявили про відмову від неї (ч. 3 ст. 1268 ЦК). Але знадобляться документи, що це підтверджують.');
      if (r.daysLeft < 0) {
        html += note('danger', '<strong>Строк минув — але є варіанти.</strong> Інші спадкоємці можуть письмово погодитися, щоб ви подали заяву ' +
          '(ч. 2 ст. 1272 ЦК), або суд може визначити додатковий строк, якщо причини пропуску поважні (ч. 3 ст. 1272 ЦК).');
      }
      html += offersHtml(['spadshchyna-shablon', 'spadshchyna-personal', 'voiskovi-spadshchyna-fakt', 'konsultatsiya'],
        r.daysLeft < 0 ? 'Строк пропущено? Підготуємо позов' : 'Потрібна допомога зі спадщиною?',
        'Позов про визнання права власності в порядку спадкування або про визначення додаткового строку.');
      show(box, html);
      bindResultButtons(box, r, calTitle, calDesc);
    });
  }

  // ── 4. 3% річних та інфляційні втрати ──
  // Індекси інфляції: /api/cpi (офіційний API Держстату, кеш сайту), запасний варіант — assets/data/cpi.json.
  let cpiPromise = null;
  function loadCpi() {
    if (!cpiPromise) {
      cpiPromise = fetch('/api/cpi').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(() => fetch('assets/data/cpi.json').then((r) => r.json()).then((j) => Object.assign(j, { live: false })))
        .catch(() => null);
    }
    return cpiPromise;
  }
  const MONTHS_NOM = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  const ym = (k) => MONTHS_NOM[Number(k.slice(5)) - 1] + ' ' + k.slice(0, 4);
  const dmy = (d) => d.split('-').reverse().join('.');
  const num = (v) => Number(String(v || '').replace(/\s/g, '').replace(',', '.'));

  function initThreePercent() {
    const form = $('calcForm'), box = $('result'), list = $('payments'), srcNote = $('cpiSource');
    $('to').value = L.today();
    loadCpi().then((c) => {
      srcNote.textContent = c
        ? 'Індекси інфляції: Державна служба статистики України (stat.gov.ua, ліцензія CC BY 4.0). Останній опублікований місяць — ' + ym(c.latest) + '.'
        : 'Не вдалося завантажити індекси інфляції — буде розраховано лише 3% річних.';
    });
    function addRow() {
      const row = document.createElement('div');
      row.className = 'pay-row';
      row.innerHTML = '<input type="date" aria-label="Дата оплати" class="pay-date">' +
        '<input type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="Сума оплати, ₴" placeholder="Сума, ₴" class="pay-sum">' +
        '<button type="button" class="pay-del" aria-label="Видалити оплату">✕</button>';
      row.querySelector('.pay-del').addEventListener('click', () => row.remove());
      list.appendChild(row);
      row.querySelector('.pay-date').focus();
    }
    $('addPayment').addEventListener('click', addRow);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = num($('amount').value);
      const due = $('due').value, to = $('to').value;
      if (!(amount > 0)) return err(box, 'Вкажіть суму боргу.');
      if (!L.parse(due) || !L.parse(to)) return err(box, 'Вкажіть обидві дати.');
      const payments = [];
      for (const row of list.querySelectorAll('.pay-row')) {
        const d = row.querySelector('.pay-date').value, a = num(row.querySelector('.pay-sum').value);
        if (!d && !a) continue;
        if (!L.parse(d) || !(a > 0)) return err(box, 'Перевірте часткові оплати: для кожної потрібні дата і сума.');
        payments.push({ date: d, amount: a });
      }
      const credit = form.kind.value === 'credit';
      const c = await loadCpi();
      let r;
      try { r = L.debtClaim({ amount, due, to, payments, creditExemption: credit, indices: c ? c.indices : null }); }
      catch (ex) { return err(box, ex.message); }
      const total = L.round2(r.total3 + r.totalInflation);
      let html = '<div class="result-main" role="status"><div class="k">3% річних та інфляційні втрати</div>' +
        '<div class="v">' + esc(money(total)) + '</div>' +
        '<div class="s">3% річних: ' + esc(money(r.total3)) + ' · інфляційні: ' + esc(c ? money(r.totalInflation) : 'не розраховано') +
        ' · залишок основного боргу: ' + esc(money(r.remaining)) + '</div></div>';
      if (r.rows.length) {
        html += '<div class="table-scroll"><table class="table"><thead><tr><th>Період прострочення</th><th>Борг у періоді</th><th>Днів</th><th>3% річних</th>' +
          '<th>Повні місяці</th><th>Індекс за місяці</th><th>Інфляційні</th></tr></thead><tbody>' +
          r.rows.map((x) => '<tr><td>' + dmy(x.from) + ' – ' + dmy(x.to) + '</td><td class="num">' + esc(money(x.balance)) + '</td>' +
            '<td class="num">' + x.days + '</td><td class="num">' + esc(money(x.threePct)) + '</td>' +
            '<td>' + (x.months.length ? esc(ym(x.months[0]) + (x.months.length > 1 ? ' – ' + ym(x.months[x.months.length - 1]) : '')) + ' (' + x.months.length + ')' : '—') + '</td>' +
            '<td class="num">' + (x.usedMonths ? String(x.cumIndex).replace('.', ',') + '%' : '—') + '</td>' +
            '<td class="num">' + esc(money(x.inflation)) + '</td></tr>').join('') +
          '</tbody></table></div>';
      }
      html += '<ul class="facts"><li><span>3% річних</span><span>борг у періоді × 3% × дні ÷ дні в році</span></li>' +
        '<li><span>Інфляційні</span><span>борг у періоді × (добуток індексів за повні місяці − 1)</span></li>' +
        '<li><span>Перший день прострочення</span><span>' + esc(L.human(L.addDays(due, 1))) + '</span></li></ul>';
      if (credit && r.excludedDays > 0) {
        html += note('warn', '<strong>Не нараховано за ' + r.excludedDays + ' ' + daysWord(r.excludedDays) + ' — з 24.02.2022.</strong> ' +
          'За п. 18 розд. «Прикінцеві та перехідні положення» ЦК під час воєнного стану та 30 днів після нього позичальник за кредитом ' +
          'чи позикою звільняється від відповідальності за ст. 625 ЦК (3% річних та інфляційні) і від неустойки. За буквальним змістом ' +
          'норма охоплює будь-яку позику, зокрема за розпискою між фізичними особами. Чи можна стягнути більше у вашому випадку — ' +
          'питання до адвоката.');
      }
      if (r.missingMonths.length) {
        html += note('warn', '<strong>Індекс ще не опубліковано за: ' + esc(r.missingMonths.map(ym).join(', ')) + '.</strong> ' +
          'Держстат публікує індекс за місяць приблизно 9–10 числа наступного місяця. Ці місяці не враховано в інфляційних.');
      }
      if (!c) html += note('danger', 'Не вдалося завантажити індекси інфляції — інфляційні втрати не розраховано. Спробуйте пізніше.');
      html += note('ok', '<strong>Як рахуємо.</strong> Часткові оплати зменшують основний борг, і кожен період між оплатами рахується окремо. ' +
        'День оплати до періоду прострочення не входить. Інфляційні нараховуються лише за повні календарні місяці прострочення в кожному ' +
        'періоді — враховуються всі такі місяці, зокрема з дефляцією; якщо загальний індекс за період нижчий за 100%, інфляційні = 0. ' +
        'Якщо договором чи ст. 534 ЦК передбачено іншу черговість погашення (спершу проценти, неустойка), результат буде іншим.');
      if (c) html += '<p class="disclaimer" style="margin-top:8px">Індекси споживчих цін: Державна служба статистики України, stat.gov.ua, ' +
        'ліцензія CC BY 4.0. Дані станом на ' + esc(ym(c.latest)) + (c.live === false ? ' (резервна копія)' : '') + '.</p>';
      html += offersHtml(form.kind.value === 'supply' ? ['postavka-shablon', 'konsultatsiya'] : ['borg-shablon', 'borg-personal', 'konsultatsiya'],
        'Стягнути борг через суд', 'Позов з розрахунком 3% річних та інфляційних, судового збору і порядком подання.');
      show(box, html);
    });
  }

  // ── 5. Судовий збір ──
  function initCourtFee() {
    const form = $('calcForm'), box = $('result');
    const claimWrap = $('claimWrap'), appealWrap = $('appealWrap');
    $('pmYear').textContent = L.PM_LATEST_YEAR;
    $('pmValue').textContent = money(L.PM[L.PM_LATEST_YEAR]);
    function sync() {
      const rule = L.FEE_RULES[$('type').value];
      claimWrap.hidden = !rule.pct;
      const civRule = /^civ-(property|nonproperty|divorce|divorce-split)$/.test($('type').value) || /^adm-/.test($('type').value);
      appealWrap.hidden = !civRule;
      if (!civRule) $('appeal').checked = false;
      $('socialWrap').hidden = !$('appeal').checked || !/^civ-/.test($('type').value);
    }
    form.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const claim = Number(String($('claim').value).replace(/\s/g, '').replace(',', '.')) || 0;
      let r;
      try {
        r = L.courtFee($('type').value, form.payer.value, claim, {
          electronic: $('electronic').checked, appeal: $('appeal').checked, socialFamily: $('social').checked
        });
      } catch (ex) { return err(box, ex.message); }
      let html = '<div class="result-main" role="status"><div class="k">Судовий збір за подання</div><div class="v">' + esc(money(r.amount)) + '</div>' +
        '<div class="s">' + esc(r.title) + '</div></div>';
      html += '<ul class="facts"><li><span>Розрахунок</span><span>' + esc(r.formula) + '</span></li>' +
        '<li><span>Прожитковий мінімум на 01.01.' + r.year + '</span><span>' + esc(money(r.pm)) + '</span></li>' +
        (r.appealAmount !== null ? '<li><span>Апеляційна скарга на рішення</span><span>' + esc(money(r.appealAmount)) + '</span></li>' : '') +
        '</ul>';
      html += note('warn', '<strong>Перевірте пільги.</strong> Від сплати судового збору звільняються окремі категорії позивачів і справ ' +
        '(ст. 5 Закону «Про судовий збір»). Серед них: позивачі у справах про стягнення заробітної плати та аліментів, ' +
        'особи з інвалідністю I–II груп, військовослужбовці — у справах, повʼязаних з виконанням військового обовʼязку, ' +
        'учасники бойових дій — у справах про порушення їхніх прав, заявники у справах про встановлення фактів, повʼязаних зі збройною агресією. ' +
        'Повний перелік і умови — у ст. 5 Закону.');
      html += note('ok', 'Реквізити для сплати беріть на сайті суду, до якого подаєте документ. Квитанцію додають до позову.');
      const t = $('type').value;
      const offers = t === 'civ-divorce' ? ['rozluchennya-shablon', 'konsultatsiya']
        : t.startsWith('adm') ? ['admin-pozov-shablon', 'admin-pozov-personal', 'konsultatsiya']
        : t.startsWith('gos') ? ['postavka-shablon', 'konsultatsiya']
        : ['borg-shablon', 'konsultatsiya'];
      html += offersHtml(offers, 'Готові документи для подання', 'Шаблони з інструкцією щодо заповнення та сплати збору або документ від адвоката.');
      show(box, html);
    });
  }

  // ── 6. Перевірка судових справ (форма → Telegram адвоката) ──
  function initCheckForm() {
    const form = $('checkForm'), box = $('formResult'), btn = $('submitBtn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (!$('consent').checked) return;
      btn.disabled = true;
      btn.textContent = 'Надсилаємо…';
      const message = 'ПЕРЕВІРКА СУДОВИХ СПРАВ\n' +
        'Кого перевірити: ' + ($('subject').value === 'company' ? 'компанію / ФОП' : 'фізичну особу') + '\n' +
        'Код ЄДРПОУ (для компанії): ' + ($('edrpou').value.trim() || '—') + '\n' +
        'Область: ' + ($('region').value || '—') + '\n' +
        'Ситуація: ' + ($('reason').value || '—') + '\n' +
        'Коментар: ' + ($('comment').value.trim() || '—');
      try {
        const res = await fetch('/api/notify-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: $('fullname').value.trim(), phone: $('phone').value.trim(), email: $('email').value.trim(),
            practice: 'Перевірка судових справ', message, website: $('website').value
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.hidden = true;
        box.innerHTML = '<div class="form-ok" role="status"><h3>Запит отримано</h3><p>Адвокат перевірить відкриті дані судів і звʼяжеться з вами ' +
          'протягом 1–2 робочих днів. Якщо справа термінова — зателефонуйте: <a href="tel:+380509185870">+380 50 918 58 70</a>.</p></div>';
        box.hidden = false;
      } catch (ex) {
        box.innerHTML = note('danger', 'Не вдалося надіслати запит. Будь ласка, зателефонуйте <a href="tel:+380509185870">+380 50 918 58 70</a> ' +
          'або напишіть у <a href="https://t.me/advokatonipko" target="_blank" rel="noopener">Telegram</a>.');
        box.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Надіслати запит';
      }
    });
    $('subject').addEventListener('change', () => { $('edrpouWrap').hidden = $('subject').value !== 'company'; });
  }

  const init = {
    kupap: initKupap, military: initMilitary, inheritance: initInheritance,
    threepercent: initThreePercent, courtfee: initCourtFee, check: initCheckForm
  }[document.body.dataset.tool];
  if (init) init();
})();
