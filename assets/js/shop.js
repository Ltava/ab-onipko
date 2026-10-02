// Спільна логіка сайту: меню, FAQ, модальне вікно оплати, форма заявки.
// Підключається на головній і на всіх сторінках зразків.
// Ціна, яку показує сторінка, — лише інформаційна: суму платежу визначає сервер (/api/liqpay-sign).

(function () {
  const RETURN = '<a href="povernennya.html" target="_blank">Умовами оплати та повернення коштів</a>';
  const OFFER = '<a href="oferta.html" target="_blank">Публічною офертою</a>';
  const PRIVACY = '<a href="privacy.html" target="_blank">Політикою конфіденційності</a>';

  const CONSENT = {
    template: `Я ознайомився(-лася) з ${OFFER}, ${RETURN} і ${PRIVACY}. Погоджуюся, що шаблон буде надано мені електронними засобами одразу після оплати, і розумію, що відповідно до п. 1 ч. 5 ст. 13 Закону України «Про захист прав споживачів» після цього я не зможу розірвати договір у 14-денний строк. Права на заміну файлу або повернення коштів у разі дефекту чи невідповідності опису за мною зберігаються.`,
    personal: `Я ознайомився(-лася) з ${OFFER}, ${RETURN} і ${PRIVACY}. Розумію, що складання документа — це правнича допомога: після оплати адвокат надішле мені договір про надання правничої допомоги для підписання електронним підписом; до підписання договору та перевірки конфлікту інтересів робота не розпочинається, а в разі відмови від договору кошти повертаються в повному обсязі.`,
    consultation: `Я ознайомився(-лася) з ${RETURN} і ${PRIVACY}. Розумію, що консультація є платною послугою вартістю 1000,00 грн, і до її початку я можу відмовитися від неї з поверненням коштів у повному обсязі.`
  };

  const SECURE = {
    template: '🔒 Безпечна оплата LiqPay · Файл — одразу після оплати',
    personal: '🔒 Безпечна оплата LiqPay · Адвокат особисто звʼяжеться і надішле договір',
    consultation: '🔒 Безпечна оплата LiqPay · Звʼяжусь особисто після оплати'
  };

  let current = {};

  function $(id) { return document.getElementById(id); }

  function fillModal(item) {
    current = item;
    $('modalTitle').textContent = item.title;
    $('modalCat').textContent = item.cat;
    $('modalPrice').textContent = item.price + ' ₴';
    $('modalDesc').textContent = item.desc;
    $('payEmailLabel').textContent = item.kind === 'template'
      ? 'Email (для підтвердження замовлення)'
      : 'Email для звʼязку';
    const needContact = item.kind !== 'template';
    $('consultExtra').style.display = needContact ? 'block' : 'none';
    if (needContact) $('payPhone').setAttribute('required', ''); else $('payPhone').removeAttribute('required');
    $('btnPay').textContent = item.kind === 'consultation'
      ? 'Оплатити консультацію — ' + item.price + ' ₴'
      : 'Оплатити ' + item.price + ' ₴ через LiqPay →';
    $('paySecureText').textContent = SECURE[item.kind];
    $('consentText').innerHTML = CONSENT[item.kind];
    $('payConsent').checked = false;
    ['payEmail', 'payName', 'payPhone', 'payTopic'].forEach(id => { if ($(id)) $(id).value = ''; });
    $('payModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('payEmail').focus(), 50);
  }

  // Сигнатуру збережено сумісною зі старою розміткою: openModal(id, title, price, desc, cat, file, instant)
  window.openModal = function (id, title, price, desc, cat, file, instant) {
    fillModal({ id, title, price, desc, cat, kind: instant === false ? 'personal' : 'template' });
  };

  window.openConsultModal = function () {
    fillModal({
      id: 'konsultatsiya',
      title: 'Юридична консультація',
      price: 1000,
      desc: 'Особиста консультація з адвокатом Оніпком Євгеном. Телефоном, онлайн або з виїздом у зручне для вас місце в Полтаві. Після оплати я особисто звʼяжуся з вами для погодження часу та формату.',
      cat: 'Консультація з адвокатом · 1 год',
      kind: 'consultation'
    });
  };

  window.closeModal = function () {
    $('payModal').classList.remove('active');
    document.body.style.overflow = '';
  };

  window.processPayment = async function () {
    const email = $('payEmail').value.trim();
    const name = $('payName').value.trim();
    const phone = $('payPhone') ? $('payPhone').value.trim() : '';
    const topic = $('payTopic') ? $('payTopic').value.trim() : '';
    const needContact = current.kind !== 'template';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { alert('Будь ласка, вкажіть коректний email.'); return; }
    if (needContact && !/^[+\d][\d\s()-]{8,}$/.test(phone)) { alert('Будь ласка, вкажіть номер телефону.'); return; }
    if (!$('payConsent').checked) {
      alert('Будь ласка, підтвердіть ознайомлення з умовами.');
      return;
    }

    const btn = $('btnPay');
    btn.disabled = true;
    try {
      const res = await fetch('/api/liqpay-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: current.id, email, name, phone, topic, consent: true })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { data, signature } = await res.json();

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://www.liqpay.ua/api/3/checkout';
      form.acceptCharset = 'utf-8';
      [['data', data], ['signature', signature]].forEach(([n, v]) => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = n; inp.value = v;
        form.appendChild(inp);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      alert('Не вдалося ініціювати оплату. Спробуйте ще раз або звʼяжіться з адвокатом: +38 050 918 58 70.');
      btn.disabled = false;
    }
  };

  // Форма «Надіслати запит» (є лише на головній)
  window.submitForm = async function (e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/notify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.value, phone: form.phone.value, email: form.email.value,
          practice: form.practice.value, message: form.message.value,
          website: form.website ? form.website.value : ''
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.reset();
      showToast('✓ Запит надіслано! Я звʼяжуся з вами найближчим часом.');
    } catch (err) {
      showToast('Не вдалося надіслати запит. Зателефонуйте: +38 050 918 58 70 або напишіть у Telegram @advokatonipko.', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  function showToast(msg, isError) {
    const toast = $('toast');
    if (!toast) return;
    $('toastMsg').textContent = msg;
    toast.classList.toggle('toast-error', !!isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), isError ? 8000 : 4000);
  }
  window.showToast = showToast;

  window.toggleFaq = function (btn) {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  };

  window.toggleMenu = function () {
    const open = $('mobileMenu').classList.toggle('open');
    const b = document.querySelector('.burger');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  document.addEventListener('DOMContentLoaded', function () {
    const modal = $('payModal');
    if (modal) {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.addEventListener('click', e => { if (e.target === modal) window.closeModal(); });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) window.closeModal();
    });

    // Підсвічування пункту меню поточного розділу (лише якщо розділи є на сторінці)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    if (sections.length) {
      window.addEventListener('scroll', () => {
        let cur = '';
        sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) cur = s.id; });
        navLinks.forEach(a => { a.style.color = a.getAttribute('href') === '#' + cur ? 'white' : ''; });
      }, { passive: true });
    }
  });
})();
