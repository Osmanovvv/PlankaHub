(() => {
  const mobileQuery = window.matchMedia('(max-width: 1180px)');
  const originalValues = new Map();

  const remember = (element, mode) => {
    if (!element || originalValues.has(element)) {
      return;
    }

    originalValues.set(element, {
      mode,
      value: mode === 'html' ? element.innerHTML : element.textContent,
    });
  };

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) {
      return;
    }

    remember(element, 'text');
    element.textContent = value;
  };

  const setHtml = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) {
      return;
    }

    remember(element, 'html');
    element.innerHTML = value;
  };

  const applyMobileCopy = () => {
    setText('.blogger-card--right .blogger-time', '11:45');

    setText('.preseed-current p', '21 день - проверка идеи и собранный MVP продукта с менторами.');
    setText('.preseed-stats span:nth-child(2) small', 'Этапы');

    setHtml('.pablo-copy h2', '<span>HIT Venture</span> <em>открыл прием</em><br>заявок на получение грантов');
    setText('.pablo-copy > p', 'Размер грантов до 100.000$ на проект, только для участников Planka Hub.');
    setText('.pablo-card__header div > span', 'Слоты');
    setText('.pablo-link--telegram strong', 'Подать заявку через Telegram');
    setText('.pablo-link--telegram small', '@planka_manager');
    setText('.pablo-mobile-note', 'Для участия нужно подать заявку через телеграм, условия и подробности уточняйте у менеджера hit venture.');

    setHtml('.telegram-copy h2', 'Подпишитесь и получите билет');
    setHtml(
      '.telegram-ticket',
      `
        <div class="telegram-ticket__date">
          <div>
            <span>PLANKA HUB · TELEGRAM</span>
            <strong>@planka_hub</strong>
          </div>
        </div>

        <div class="telegram-ticket__perforation" aria-hidden="true"></div>

        <div class="telegram-ticket__body">
          <span class="telegram-ticket__eyebrow">БИЛЕТ · PH-2026</span>
          <h3>на раскрытие <span>идеи</span></h3>
          <p>Внутри еженедельные разборы продуктов, AI-промты под задачи и приглашения на закрытые встречи.</p>

          <div class="telegram-ticket__details">
            <span><small>ДОСТУП</small>Бесплатно</span>
            <span><small>ФОРМАТ</small>Канал</span>
            <span><small>СРОК</small>∞</span>
          </div>

          <footer class="telegram-ticket__footer">
            <span class="telegram-barcode" aria-hidden="true"></span>
            <span class="telegram-vip">VIP</span>
          </footer>
        </div>
      `,
    );

    setText('.onas-card--people > p', 'Без анкеты на 100 пунктов, без NDA, без оплат. Заходите и пробуйте.');
    setText('.onas-card--stats > p', 'Работаем не по системе play-off, а каждого ведём за руку до работающего продукта.');
    setText('.onas-card--no > p', 'Партнерский доступ к фондам, ангелам и крупным LP, а не только питч-мероприятия раз в полгода.');

    setText('.quest-card--featured .quest-answer', 'Это экосистема для ранних фаундеров: AI-доступы, обучение, менторы, инвесторы и инструменты для запуска');

    setText('.footer-intro p', 'Экосистема для фаундеров, которая бесплатно предоставляет ресурсы для старта и масштабирования стартапа.');
    setText('.footer-menu:nth-child(1) a:nth-of-type(1)', 'Главная');
    setText('.footer-menu:nth-child(1) a:nth-of-type(3)', 'Менторы');
    setText('.footer-menu:nth-child(2) a:nth-of-type(2)', 'Условия');
    setText('.footer-menu:nth-child(2) a:nth-of-type(3)', 'Политика');
    setText('.footer-bottom > span', '© 2025 Planka Hub · Все права защищены · syedoss@plan.com');
  };

  const restoreDesktopCopy = () => {
    originalValues.forEach((entry, element) => {
      if (!element.isConnected) {
        return;
      }

      if (entry.mode === 'html') {
        element.innerHTML = entry.value;
      } else {
        element.textContent = entry.value;
      }
    });

    originalValues.clear();
  };

  const syncCopy = () => {
    if (mobileQuery.matches) {
      applyMobileCopy();
    } else {
      restoreDesktopCopy();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncCopy, { once: true });
  } else {
    syncCopy();
  }

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', syncCopy);
  } else {
    mobileQuery.addListener(syncCopy);
  }
})();
