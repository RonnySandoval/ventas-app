const Icons = (function () {
  const base =
    'class="ui-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  function svg(paths, extraClass) {
    const cls = extraClass ? 'ui-icon ' + extraClass : 'ui-icon';
    return (
      '<svg class="' + cls + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  function svgFilled(pathD, extraClass) {
    const cls = extraClass ? 'ui-icon ' + extraClass : 'ui-icon';
    return (
      '<svg class="' + cls + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
      '<path d="' + pathD + '"/>' +
      '</svg>'
    );
  }

  const icons = {
    home: () => svg('<path d="M4 10.5 12 3l8 7.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"/>'),
    sale: () => svg('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>'),
    box: () => svg('<path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z"/><path d="M3.5 8.5 12 13l8.5-4.5M12 13v8"/>'),
    catalog: () => svg('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>'),
    chart: () => svg('<path d="M4 19V5M4 19h16M8 17V11M12 17V7M16 17v-4"/>'),
    sun: () => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'),
    moon: () => svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/>'),
    chevron: (open) => svg(
      '<path d="m9 6 6 6-6 6"/>',
      'ui-icon--chevron' + (open ? ' is-open' : '')
    ),
    close: () => svg('<path d="M18 6 6 18M6 6l12 12"/>', 'ui-icon--sm'),
    trash: () => svg('<path d="M3 6h18M8 6V4h8v2M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/>', 'ui-icon--sm'),
    plus: () => svg('<path d="M12 5v14M5 12h14"/>', 'ui-icon--sm'),
    inbox: () => svg('<path d="M22 12h-6l-2 3H10l-2-3H4"/><path d="M5.5 5A2.5 2.5 0 0 1 8 2.5h8A2.5 2.5 0 0 1 18.5 5H20v14H4V5h1.5Z"/>', 'ui-icon--lg'),
    pencil: () => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'ui-icon--sm'),
    arrowUp: () => svg('<path d="m12 19V5M5 12l7-7 7 7"/>', 'ui-icon--sm'),
    arrowDown: () => svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 'ui-icon--sm'),
    arrowIn: () => svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 'ui-icon--sm'),
    arrowOut: () => svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 'ui-icon--sm'),
    check: () => svg('<path d="m5 12 4 4L19 6"/>', 'ui-icon--sm'),
    alert: () => svg('<path d="M12 8v4M12 16h.01"/><path d="M10.3 3.6 1.8 18a1 1 0 0 0 .9 1.5h18.6a1 1 0 0 0 .9-1.5L13.7 3.6a1 1 0 0 0-1.8 0Z"/>', 'ui-icon--sm'),
    download: () => svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', 'ui-icon--sm'),
    share: () => svgFilled(
      'M6 19.5C6 11 10.5 7.5 15.5 7.5H18.2L22.2 11L18.2 14.5H15.5C10.5 14.5 7.8 16.5 6 19.5Z',
      'ui-icon--sm ui-icon--filled'
    ),
    upload: () => svg('<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 21h14"/>', 'ui-icon--sm'),
    database: () => svg(
      '<ellipse cx="12" cy="5" rx="8" ry="3"/>' +
      '<path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>' +
      '<path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      'ui-icon--sm'
    )
  };

  function mount(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      if (icons[name]) el.innerHTML = icons[name]();
    });
  }

  return Object.assign({ mount, svg }, icons);
})();
