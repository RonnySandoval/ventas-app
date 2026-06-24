const UI = (function () {
  const VIEW_MS = 220;
  const ACCORDION_MS = 280;
  const TOAST_MS = 2800;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function updateView(main, getHtml) {
    if (!main) return Promise.resolve();
    return Promise.resolve(getHtml()).then((html) => {
      main.innerHTML = html;
      initAccordions(main);
    });
  }

  function transitionView(main, getHtml) {
    if (!main) return Promise.resolve();

    if (reducedMotion()) {
      return updateView(main, getHtml);
    }

    main.classList.add('view-leave');
    return new Promise((resolve) => setTimeout(resolve, VIEW_MS))
      .then(() => Promise.resolve(getHtml()))
      .then((html) => {
        main.innerHTML = html;
        main.classList.remove('view-leave');
        main.classList.add('view-enter');
        requestAnimationFrame(() => {
          main.classList.add('view-enter-active');
          setTimeout(() => {
            main.classList.remove('view-enter', 'view-enter-active');
          }, VIEW_MS);
          staggerIn(main);
          initAccordions(main);
          resolve();
        });
      });
  }

  function staggerIn(root) {
    const items = root.querySelectorAll('.card, .accordion, .stat-box, .tabs, .inv-bulk-footer');
    items.forEach((el, index) => {
      el.classList.add('fx-stagger');
      el.style.setProperty('--fx-delay', index * 45 + 'ms');
    });
  }

  function setAccordion(header, body, open, animate) {
    if (!header || !body) return;

    const chevron = header.querySelector('.ui-icon--chevron');
    const shouldAnimate = animate !== false && !reducedMotion();

    if (open) {
      header.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
      body.classList.add('is-open');
      if (chevron) chevron.classList.add('is-open');
      if (shouldAnimate) {
        body.classList.add('is-animating');
        requestAnimationFrame(() => body.classList.add('is-visible'));
      } else {
        body.classList.add('is-visible');
      }
      return;
    }

    header.classList.remove('open');
    header.setAttribute('aria-expanded', 'false');
    if (chevron) chevron.classList.remove('is-open');
    body.classList.remove('is-visible');
    if (!shouldAnimate) {
      body.classList.remove('is-open', 'is-animating');
      return;
    }
    body.classList.add('is-animating');
    setTimeout(() => {
      body.classList.remove('is-open', 'is-animating');
    }, ACCORDION_MS);
  }

  function initAccordions(root) {
    (root || document).querySelectorAll('.accordion-header.open').forEach((header) => {
      const body = header.nextElementSibling;
      if (body && body.classList.contains('accordion-body')) {
        setAccordion(header, body, true, false);
      }
    });
  }

  function bindAccordions(selector, idAttr, openSet) {
    document.querySelectorAll(selector).forEach((header) => {
      const id = header.dataset[idAttr];
      const body = header.nextElementSibling;
      if (!body) return;

      const isOpen = openSet.has(id);
      header.classList.toggle('open', isOpen);
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      setAccordion(header, body, isOpen, false);

      header.addEventListener('click', () => {
        const willOpen = !header.classList.contains('open');
        if (willOpen) openSet.add(id);
        else openSet.delete(id);
        setAccordion(header, body, willOpen, true);
      });
    });
  }

  function showToast(toastEl, message, type) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.remove('hidden', 'toast--success', 'toast--error', 'toast--info');
    if (type) toastEl.classList.add('toast--' + type);
    toastEl.classList.add('toast--show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.remove('toast--show');
      setTimeout(() => toastEl.classList.add('hidden'), 200);
    }, TOAST_MS);
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    requestAnimationFrame(() => modalEl.classList.add('modal--open'));
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('modal--open');
    setTimeout(() => modalEl.classList.add('hidden'), reducedMotion() ? 0 : 220);
  }

  function actionPulse(kind) {
    const shell = document.getElementById('app-shell');
    if (!shell || reducedMotion()) return;
    shell.classList.remove('fx-pulse-success', 'fx-pulse-danger');
    shell.classList.add(kind === 'danger' ? 'fx-pulse-danger' : 'fx-pulse-success');
    setTimeout(() => shell.classList.remove('fx-pulse-success', 'fx-pulse-danger'), 420);
  }

  function flashListItem(el) {
    if (!el || reducedMotion()) return;
    el.classList.add('fx-highlight');
    setTimeout(() => el.classList.remove('fx-highlight'), 600);
  }

  return {
    updateView,
    transitionView,
    staggerIn,
    setAccordion,
    initAccordions,
    bindAccordions,
    showToast,
    openModal,
    closeModal,
    actionPulse,
    flashListItem
  };
})();
