const App = (function () {
  let currentView = 'inicio';
  let catalogTab = 'productos';
  let inventoryTab = 'movimiento';
  let reportTab = 'resumen';
  let dailySummary = null;
  let reportSummary = null;
  let reportDate = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  let openCatalogAccordions = new Set();
  let openInvPresAccordions = new Set();
  let saleMode = 'unica';
  let saleCatalogData = null;
  let singleSaleSelection = { categoryId: null, presentationId: null };
  let singleSaleDraft = { qty: '1', price: null };
  let singleSaleProductId = null;
  let multiSaleRows = [];
  let multiSaleReviewOpen = false;
  let inventoryMode = 'masa';
  let bulkMovementPresState = {};
  let movementEntryType = 'in';
  let inventoryCatalogData = null;
  let inventoryStockMap = null;
  let inventoryCategories = null;
  let saleStockMap = null;
  let stockSortState = { groupBy: 'cat', dir: 'asc' };
  let reportSalesSortState = { groupBy: 'time', dir: 'desc' };
  let reportEntriesSortState = { groupBy: 'time', dir: 'desc' };
  let reportExitsSortState = { groupBy: 'time', dir: 'desc' };

  const GROUP_MODES = [
    { id: 'cat', label: 'Categoría' },
    { id: 'pres', label: 'Presentación' },
    { id: 'time', label: 'Fecha' },
    { id: 'value', label: 'Valor' },
    { id: 'qty', label: 'Cantidad' }
  ];

  const titles = {
    inicio: 'Inicio',
    venta: 'Registrar venta',
    inventario: 'Inventario',
    catalogo: 'Catálogo',
    reportes: 'Reportes del día'
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function showToast(message, type) {
    UI.showToast($('#toast'), message, type || 'info');
  }

  function notifySuccess(message) {
    showToast(message, 'success');
    UI.actionPulse('success');
  }

  function notifyError(message) {
    showToast(message, 'error');
    UI.actionPulse('danger');
  }

  function emptyState(text, iconName) {
    const icon = iconName && Icons[iconName] ? Icons[iconName]() : Icons.inbox();
    return '<div class="empty-state">' + icon + '<p>' + escapeHtml(text) + '</p></div>';
  }

  function delBtn(attrs, label) {
    return '<button type="button" class="btn btn-danger btn-sm btn-icon-only" ' + attrs + ' aria-label="' + escapeHtml(label) + '">' + Icons.trash() + '</button>';
  }

  function editBtn(attrs, label) {
    return '<button type="button" class="btn btn-secondary btn-sm btn-icon-only" ' + attrs + ' aria-label="' + escapeHtml(label) + '">' + Icons.pencil() + '</button>';
  }

  let modalOnSave = null;
  let modalOnConfirm = null;
  let bulkSummaryUpdater = null;

  function closeModal() {
    UI.closeModal($('#modal'));
    $('#modal').querySelector('.modal-panel').classList.remove('modal-panel--tall');
    $('#modal-form').classList.remove('hidden');
    $('#modal-message').classList.add('hidden');
    $('#modal-confirm-actions').classList.add('hidden');
    $('#modal-fields').innerHTML = '';
    $('#modal-submit').disabled = false;
    modalOnSave = null;
    modalOnConfirm = null;
    bulkSummaryUpdater = null;
  }

  function openEditModal({ title, fields, submitLabel, onSave }) {
    $('#modal').querySelector('.modal-panel').classList.remove('modal-panel--tall');
    $('#modal-submit').disabled = false;
    $('#modal-message').classList.add('hidden');
    $('#modal-confirm-actions').classList.add('hidden');
    $('#modal-form').classList.remove('hidden');
    $('#modal-title').textContent = title;
    $('#modal-submit').textContent = submitLabel || 'Guardar';
    $('#modal-fields').innerHTML = fields.map((field) => {
      if (field.type === 'checkbox') {
        const checked = field.checked ? ' checked' : '';
        const disabled = field.disabled ? ' disabled' : '';
        return '<div class="form-group">' +
          '<label class="check-item modal-check">' +
          '<input type="checkbox" id="modal-field-' + field.key + '" data-field="' + field.key + '"' + checked + disabled + '>' +
          '<span>' + escapeHtml(field.label) + '</span>' +
          '</label>' +
          (field.hint ? '<p class="field-hint">' + escapeHtml(field.hint) + '</p>' : '') +
          '</div>';
      }

      const attrs = [
        'type="' + (field.type || 'text') + '"',
        'id="modal-field-' + field.key + '"',
        'data-field="' + field.key + '"',
        'value="' + escapeHtml(String(field.value ?? '')) + '"'
      ];
      if (field.required !== false) attrs.push('required');
      if (field.step) attrs.push('step="' + field.step + '"');
      if (field.min !== undefined) attrs.push('min="' + field.min + '"');
      if (field.inputmode) attrs.push('inputmode="' + field.inputmode + '"');
      if (field.placeholder) attrs.push('placeholder="' + escapeHtml(field.placeholder) + '"');

      return '<div class="form-group">' +
        '<label for="modal-field-' + field.key + '">' + escapeHtml(field.label) + '</label>' +
        '<input ' + attrs.join(' ') + '>' +
        '</div>';
    }).join('');

    modalOnSave = onSave;
    UI.openModal($('#modal'));
    const firstInput = $('#modal-fields input');
    if (firstInput) {
      firstInput.focus();
      firstInput.select();
    }
  }

  function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
    $('#modal-title').textContent = title;
    $('#modal-fields').innerHTML = '';
    $('#modal-form').classList.add('hidden');
    $('#modal-message').textContent = message;
    $('#modal-message').classList.remove('hidden');
    $('#modal-confirm-actions').classList.remove('hidden');
    $('#modal-confirm-ok').textContent = confirmLabel || 'Eliminar';
    modalOnConfirm = onConfirm;
    UI.openModal($('#modal'));
  }

  function setupModal() {
    const modal = $('#modal');

    $('#modal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!modalOnSave) return;

      const values = {};
      $('#modal-fields').querySelectorAll('[data-field]').forEach((input) => {
        if (input.type === 'checkbox') {
          values[input.dataset.field] = input.checked;
        } else {
          values[input.dataset.field] = input.value;
        }
      });

      Promise.resolve(modalOnSave(values))
        .then(() => closeModal())
        .catch((err) => {
          if (err && err.message) notifyError(err.message);
        });
    });

    modal.querySelectorAll('[data-modal-close], #modal-cancel').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    $('#modal-confirm-ok').addEventListener('click', () => {
      if (!modalOnConfirm) return;
      Promise.resolve(modalOnConfirm())
        .then(() => closeModal())
        .catch((err) => {
          if (err && err.message) notifyError(err.message);
        });
    });

    $('#modal-fields').addEventListener('change', (e) => {
      if (bulkSummaryUpdater && e.target.matches('input[type="checkbox"]')) {
        bulkSummaryUpdater();
      }
    });

    $('#modal-fields').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bulk-toggle]');
      if (!btn) return;
      const group = btn.dataset.bulkToggle;
      const checkboxes = $('#modal-fields').querySelectorAll('input[name="' + group + '"]');
      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
      checkboxes.forEach((cb) => { cb.checked = !allChecked; });
      btn.textContent = allChecked ? 'Todas' : 'Ninguna';
      if (bulkSummaryUpdater) bulkSummaryUpdater();
    });
  }

  function getBulkChecked(name) {
    return Array.from($('#modal-fields').querySelectorAll('input[name="' + name + '"]:checked'))
      .map((cb) => cb.value);
  }

  function openBulkProductModal(categories, presentations, products) {
    const existing = new Set(products.map((p) => p.categoryId + '|' + p.presentationId));

    function updateSummary() {
      const catIds = getBulkChecked('bulk-cat');
      const presIds = getBulkChecked('bulk-pres');
      let newCount = 0;
      catIds.forEach((cid) => {
        presIds.forEach((pid) => {
          if (!existing.has(cid + '|' + pid)) newCount++;
        });
      });
      const el = $('#bulk-summary');
      if (el) {
        el.textContent = newCount
          ? 'Se agregarán ' + newCount + ' producto(s) nuevo(s)'
          : 'No hay combinaciones nuevas por agregar';
      }
      $('#modal-submit').disabled = newCount === 0;
    }

    $('#modal-message').classList.add('hidden');
    $('#modal-confirm-actions').classList.add('hidden');
    $('#modal-form').classList.remove('hidden');
    $('#modal').querySelector('.modal-panel').classList.add('modal-panel--tall');
    $('#modal-title').textContent = 'Agregar productos en lote';
    $('#modal-submit').textContent = 'Agregar seleccionados';
    $('#modal-submit').disabled = false;

    const catChecks = categories.map((c) =>
      '<label class="check-item"><input type="checkbox" name="bulk-cat" value="' + c.id + '" checked>' +
      escapeHtml(c.name) + '</label>'
    ).join('');

    const presChecks = presentations.map((p) =>
      '<label class="check-item"><input type="checkbox" name="bulk-pres" value="' + p.id + '" checked>' +
      escapeHtml(p.name) + ' <span style="color:var(--text-muted)">(V: ' + DB.formatMoney(p.defaultPrice || 0) +
      ' · C: ' + DB.formatMoney(p.defaultPurchasePrice || 0) + ')</span></label>'
    ).join('');

    $('#modal-fields').innerHTML =
      '<div class="bulk-section">' +
        '<div class="bulk-header"><span class="bulk-label">Categorías</span>' +
        '<button type="button" class="btn-link" data-bulk-toggle="bulk-cat">Ninguna</button></div>' +
        '<div class="check-list">' + catChecks + '</div>' +
      '</div>' +
      '<div class="bulk-section">' +
        '<div class="bulk-header"><span class="bulk-label">Presentaciones</span>' +
        '<button type="button" class="btn-link" data-bulk-toggle="bulk-pres">Ninguna</button></div>' +
        '<div class="check-list">' + presChecks + '</div>' +
      '</div>' +
      '<p id="bulk-summary" class="bulk-summary"></p>';

    bulkSummaryUpdater = updateSummary;
    updateSummary();

    modalOnSave = () => {
      const catIds = getBulkChecked('bulk-cat');
      const presIds = getBulkChecked('bulk-pres');
      if (!catIds.length || !presIds.length) {
        throw new Error('Selecciona al menos una categoría y una presentación');
      }
      return DB.addProductsBulk(catIds, presIds).then((result) => {
        let msg = result.added + ' producto(s) agregado(s)';
        if (result.skipped) msg += ', ' + result.skipped + ' ya existían';
        if (!result.added) msg = 'Todos los productos seleccionados ya existen';
        showToast(msg);
        return refreshAllSummaries().then(() => renderPersist());
      });
    };

    $('#modal').classList.remove('hidden');
  }

  function setView(view) {
    currentView = view;
    $('#page-title').textContent = titles[view] || view;
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    render();
  }

  function updateHeaderDate() {
    $('#page-date').textContent = DB.formatDate(Date.now());
  }

  function compareEs(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'es');
  }

  function formatActivityTime(ts) {
    if (!ts) return 'Sin movimientos';
    if (DB.isSameDay(ts, new Date())) return DB.formatTime(ts);
    return DB.formatDate(ts) + ' · ' + DB.formatTime(ts);
  }

  function formatGroupDate(ts) {
    if (!ts) return 'Sin movimientos';
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return day + '/' + m + '/' + d.getFullYear();
  }

  function parseGroupDate(str) {
    if (str === 'Sin movimientos') return 0;
    const parts = str.split('/');
    if (parts.length !== 3) return 0;
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
  }

  function defaultDirForGroupMode(groupBy) {
    if (groupBy === 'time' || groupBy === 'value' || groupBy === 'qty') return 'desc';
    return 'asc';
  }

  function getSortStateRef(context) {
    if (context === 'stock') return stockSortState;
    if (context === 'report-sales') return reportSalesSortState;
    if (context === 'report-entries') return reportEntriesSortState;
    if (context === 'report-exits') return reportExitsSortState;
    return null;
  }

  function renderGroupToolbar(state, contextKey) {
    const modes = GROUP_MODES.map((mode) =>
      '<button type="button" class="group-mode-btn' + (state.groupBy === mode.id ? ' active' : '') +
      '" data-group-mode="' + mode.id + '">' + escapeHtml(mode.label) + '</button>'
    ).join('');
    const dirLabel = state.dir === 'asc' ? 'Orden ascendente' : 'Orden descendente';
    const dirIcon = state.dir === 'asc' ? Icons.arrowUp() : Icons.arrowDown();
    return (
      '<div class="group-toolbar" data-group-context="' + contextKey + '">' +
        '<div class="group-toolbar-modes">' + modes + '</div>' +
        '<button type="button" class="group-dir-btn" data-group-dir aria-label="' + dirLabel + '" title="Invertir orden">' +
          dirIcon +
        '</button>' +
      '</div>'
    );
  }

  function buildItemGroups(items, state, type, productMap, isStock) {
    const { groupBy, dir } = state;
    const mult = dir === 'asc' ? 1 : -1;

    function getMeta(item) {
      if (isStock) {
        return {
          cat: item.categoryName || '',
          pres: item.presentationName || '',
          qty: item.stock,
          value: item.stock * item.standardPrice,
          time: item.lastActivityAt || 0
        };
      }
      return getReportItemMeta(item, productMap, type);
    }

    function getKey(item) {
      const meta = getMeta(item);
      if (groupBy === 'cat') return meta.cat || 'Sin categoría';
      if (groupBy === 'pres') return meta.pres || 'Sin presentación';
      if (groupBy === 'time') return formatGroupDate(meta.time);
      return '';
    }

    if (groupBy === 'value' || groupBy === 'qty') {
      const sorted = [...items].sort((a, b) => {
        const ma = getMeta(a);
        const mb = getMeta(b);
        const va = groupBy === 'value' ? ma.value : ma.qty;
        const vb = groupBy === 'value' ? mb.value : mb.qty;
        return mult * (va - vb);
      });
      return [{ key: '', items: sorted, flat: true }];
    }

    const groups = new Map();
    items.forEach((item) => {
      const key = getKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    function withinSort(a, b) {
      const ma = getMeta(a);
      const mb = getMeta(b);
      if (groupBy === 'cat') return mult * compareEs(ma.pres, mb.pres);
      if (groupBy === 'pres') return mult * compareEs(ma.cat, mb.cat);
      if (groupBy === 'time') return mult * (ma.time - mb.time);
      return 0;
    }

    groups.forEach((groupItems) => groupItems.sort(withinSort));

    let keys = [...groups.keys()];
    if (groupBy === 'time') {
      keys.sort((a, b) => mult * (parseGroupDate(a) - parseGroupDate(b)));
    } else {
      keys.sort((a, b) => mult * compareEs(a, b));
    }

    return keys.map((key) => ({ key, items: groups.get(key) }));
  }

  function renderGroupCards(groups, renderItem) {
    if (!groups.length) return '';
    const hasItems = groups.some((g) => g.items.length);
    if (!hasItems) return '';

    return groups.map((group) => {
      if (group.flat) {
        return '<div class="group-card group-card--flat"><div class="group-card-body">' +
          group.items.map(renderItem).join('') + '</div></div>';
      }
      return (
        '<div class="group-card">' +
          '<div class="group-card-title">' + escapeHtml(group.key) + '</div>' +
          '<div class="group-card-body">' + group.items.map(renderItem).join('') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderStockListItem(item, groupBy) {
    const cls = item.stock <= 0 ? 'stock-low' : 'stock-ok';
    const totalValue = item.stock * item.standardPrice;
    const subParts = [];
    if (groupBy !== 'cat') subParts.push(escapeHtml(item.categoryName));
    if (groupBy !== 'pres') subParts.push(escapeHtml(item.presentationName));
    subParts.push('Venta ' + DB.formatMoney(item.standardPrice));
    subParts.push('Compra ' + DB.formatMoney(item.purchasePrice || 0));
    subParts.push('Valor ' + DB.formatMoney(totalValue));
    if (groupBy !== 'time') subParts.push('Últ. act. ' + formatActivityTime(item.lastActivityAt));

    let title = item.presentationName;
    if (groupBy === 'pres') title = item.categoryName;
    else if (groupBy === 'time') title = item.presentationName + ' · ' + item.categoryName;

    return (
      '<div class="list-item list-item--record">' +
        '<div class="list-item-main">' +
          '<div class="list-item-title">' + escapeHtml(title) + '</div>' +
          '<div class="list-item-sub">' + subParts.join(' · ') + '</div>' +
        '</div>' +
        '<div class="list-item-meta">' +
          '<div class="list-item-value ' + cls + '">' + item.stock + ' uds</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderStockList(items, sortState) {
    if (!items.length) return emptyState('Sin existencias registradas');
    const groups = buildItemGroups(items, sortState, null, null, true);
    return renderGroupCards(groups, (item) => renderStockListItem(item, sortState.groupBy));
  }

  function getReportItemMeta(item, productMap, type) {
    const prod = productMap[item.productId] || {};
    const qty = item.quantity;
    let value = 0;
    if (type === 'sale') value = qty * item.unitPrice;
    else if (type === 'in') value = qty * (item.purchasePrice || 0);
    else value = qty * (prod.standardPrice || 0);
    return {
      cat: prod.categoryName || '',
      pres: prod.presentationName || '',
      qty,
      value,
      time: item.timestamp || 0
    };
  }

  function renderReportListItem(item, productMap, type, editable, showMargin, groupBy) {
    const prod = productMap[item.productId];
    const presName = prod ? prod.presentationName : 'Desconocido';
    const cat = prod ? prod.categoryName : '';
    const meta = getReportItemMeta(item, productMap, type);
    let title = presName;
    let sub = '';

    if (groupBy === 'cat') {
      title = presName;
      sub = DB.formatTime(item.timestamp);
    } else if (groupBy === 'pres') {
      title = cat;
      sub = presName + ' · ' + DB.formatTime(item.timestamp);
    } else if (groupBy === 'time') {
      title = presName;
      sub = cat + ' · ' + DB.formatTime(item.timestamp);
    } else {
      title = presName;
      sub = cat + ' · ' + DB.formatTime(item.timestamp);
    }

    let valueHtml = '';
    if (type === 'sale') {
      const margin = showMargin && prod
        ? (item.unitPrice - (prod.purchasePrice || 0)) * item.quantity
        : null;
      valueHtml = '<div class="list-item-qty">' + item.quantity + ' × ' + DB.formatMoney(item.unitPrice) + '</div>';
      valueHtml += '<div class="list-item-total">Total ' + DB.formatMoney(meta.value) + '</div>';
      if (margin !== null) {
        valueHtml += '<div class="list-item-extra margin-inline">Util. ' + DB.formatMoney(margin) + '</div>';
      }
    } else if (type === 'in') {
      valueHtml = '<div class="list-item-qty">' + item.quantity + ' uds';
      if (item.purchasePrice) valueHtml += ' · ' + DB.formatMoney(item.purchasePrice) + '/ud';
      valueHtml += '</div>';
      valueHtml += '<div class="list-item-total">Total ' + DB.formatMoney(meta.value) + '</div>';
    } else {
      valueHtml = '<div class="list-item-qty">' + item.quantity + ' uds</div>';
      valueHtml += '<div class="list-item-total">Valor ' + DB.formatMoney(meta.value) + '</div>';
    }

    let html = '<div class="list-item list-item--record">';
    html += '<div class="list-item-main">';
    html += '<div class="list-item-title">' + escapeHtml(title) + '</div>';
    if (sub) html += '<div class="list-item-sub">' + escapeHtml(sub) + '</div>';
    html += '</div>';
    html += '<div class="list-item-meta">';
    html += '<div class="list-item-value">' + valueHtml + '</div>';
    if (editable) {
      html += '<div class="inline-actions">';
      if (type === 'sale') {
        html += editBtn('data-edit-sale="' + item.id + '"', 'Editar venta');
        html += delBtn('data-del-sale="' + item.id + '"', 'Eliminar venta');
      } else {
        html += editBtn('data-edit-mov="' + item.id + '"', 'Editar movimiento');
        html += delBtn('data-del-mov="' + item.id + '"', 'Eliminar movimiento');
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderRecentList(items, productMap, type, limit, editable, showMargin, sortState) {
    if (!items.length) {
      return emptyState('Sin registros');
    }

    const state = sortState || { groupBy: 'time', dir: 'desc' };
    const groups = buildItemGroups(items, state, type, productMap, false);
    let flatItems = groups.flatMap((g) => g.items);
    if (limit) flatItems = flatItems.slice(0, limit);

    if (limit) {
      return flatItems.map((item) =>
        renderReportListItem(item, productMap, type, editable, showMargin, 'time')
      ).join('');
    }

    const limitedGroups = groups.map((g) => ({
      ...g,
      items: g.items
    }));

    return renderGroupCards(limitedGroups, (item) =>
      renderReportListItem(item, productMap, type, editable, showMargin, state.groupBy)
    );
  }

  function renderGroupedList(grouped, showMoney) {
    if (!grouped || Object.keys(grouped).length === 0) {
      return emptyState('Sin registros');
    }

    let html = '';
    Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'es')).forEach((cat) => {
      html += '<div class="group-header">' + escapeHtml(cat) + '</div>';
      const presentations = grouped[cat];
      Object.keys(presentations).sort((a, b) => a.localeCompare(b, 'es')).forEach((presName) => {
        const data = presentations[presName];
        html += '<div class="list-item">';
        html += '<div class="list-item-main"><div class="list-item-title">' + escapeHtml(presName) + '</div>';
        html += '<div class="list-item-sub">' + data.units + ' uds</div></div>';
        if (showMoney) {
          html += '<div class="list-item-value">' + DB.formatMoney(data.value) + '</div>';
        }
        html += '</div>';
      });
    });
    return html;
  }

  function renderGroupedMarginList(grouped) {
    if (!grouped || Object.keys(grouped).length === 0) {
      return emptyState('Sin ventas para calcular utilidad');
    }

    let html = '';
    Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'es')).forEach((cat) => {
      html += '<div class="group-header">' + escapeHtml(cat) + '</div>';
      const presentations = grouped[cat];
      Object.keys(presentations).sort((a, b) => a.localeCompare(b, 'es')).forEach((presName) => {
        const data = presentations[presName];
        html += '<div class="list-item">';
        html += '<div class="list-item-main">';
        html += '<div class="list-item-title">' + escapeHtml(presName) + '</div>';
        html += '<div class="list-item-sub">' + data.units + ' uds · Venta ' + DB.formatMoney(data.revenue) +
          ' · Costo ' + DB.formatMoney(data.cost) + '</div>';
        html += '</div>';
        html += '<div class="list-item-value margin-value">' + DB.formatMoney(data.margin) + '</div>';
        html += '</div>';
      });
    });
    return html;
  }

  function toDateInputValue(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function fromDateInputValue(str) {
    const parts = str.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isReportToday() {
    return DB.isSameDay(Date.now(), reportDate);
  }

  function formatReportDateLabel(date) {
    if (DB.isSameDay(Date.now(), date)) return 'Hoy';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (DB.isSameDay(yesterday, date)) return 'Ayer';
    return DB.formatDate(date);
  }

  function renderReportDateBar() {
    const todayCls = isReportToday() ? ' disabled' : '';
    return (
      '<div class="card report-date-bar">' +
        '<button type="button" class="btn btn-secondary btn-sm report-date-nav" id="report-prev-day" aria-label="Día anterior">‹</button>' +
        '<input type="date" id="report-date-input" class="report-date-input" value="' + toDateInputValue(reportDate) + '" aria-label="Fecha del reporte">' +
        '<button type="button" class="btn btn-secondary btn-sm report-date-nav" id="report-next-day" aria-label="Día siguiente"' +
          (isReportToday() ? ' disabled' : '') + '>›</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="report-today"' + todayCls + '>Hoy</button>' +
        '<span class="report-date-label">' + escapeHtml(formatReportDateLabel(reportDate)) + '</span>' +
      '</div>'
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCatalogAccordion(catalog) {
    if (!catalog.length) {
      return emptyState('Sin productos en el catálogo', 'catalog');
    }

    const grouped = {};
    catalog.forEach((item) => {
      if (!grouped[item.categoryId]) {
        grouped[item.categoryId] = { name: item.categoryName, items: [] };
      }
      grouped[item.categoryId].items.push(item);
    });

    const categoryIds = Object.keys(grouped).sort((a, b) =>
      grouped[a].name.localeCompare(grouped[b].name, 'es')
    );

    if (!openCatalogAccordions.size && categoryIds.length) {
      openCatalogAccordions.add(categoryIds[0]);
    }

    return categoryIds.map((catId) => {
      const group = grouped[catId];
      const isOpen = openCatalogAccordions.has(catId);

      const itemsHtml = group.items.map((item) => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${escapeHtml(item.presentationName)}</div>
            <div class="list-item-sub">Venta: ${DB.formatMoney(item.standardPrice)} · Compra: ${DB.formatMoney(item.purchasePrice || 0)}</div>
          </div>
          <div class="inline-actions">
            ${editBtn('data-edit-prod="' + item.id + '"', 'Editar producto')}
            <button type="button" class="btn btn-danger btn-sm" data-del-prod="${item.id}">Eliminar</button>
          </div>
        </div>
      `).join('');

      return `
        <div class="accordion">
          <button type="button" class="accordion-header ${isOpen ? 'open' : ''}" data-accordion-toggle="${catId}" aria-expanded="${isOpen}">
            <span class="accordion-title">${escapeHtml(group.name)}</span>
            <span class="accordion-meta">${group.items.length} prod.</span>
            <span class="accordion-chevron">${Icons.chevron(isOpen)}</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-body-inner">
            ${itemsHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ventas-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0e14' : '#e8f4f2');
    const btn = $('#theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? Icons.sun() : Icons.moon();
      btn.setAttribute('aria-label', theme === 'dark' ? 'Modo claro' : 'Modo oscuro');
    }
  }

  function setupTheme() {
    const saved = localStorage.getItem('ventas-theme') || 'light';
    applyTheme(saved);
    $('#theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // --- Views ---

  function renderInicio() {
    if (!dailySummary) {
      return emptyState('Cargando...');
    }

    const s = dailySummary;
    return `
      <div class="stat-grid">
        <div class="stat-box success">
          <div class="value">${DB.formatMoney(s.sales.totalMoney)}</div>
          <div class="label">Ventas hoy</div>
        </div>
        <div class="stat-box">
          <div class="value">${s.sales.totalUnits}</div>
          <div class="label">Unidades vendidas</div>
        </div>
        <div class="stat-box warning">
          <div class="value">${s.entries.totalUnits}</div>
          <div class="label">Entradas hoy</div>
        </div>
        <div class="stat-box danger">
          <div class="value">${s.exits.totalUnits}</div>
          <div class="label">Salidas hoy</div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-title">Ventas por categoría</div>
        ${renderGroupedList(s.sales.grouped, true)}
        <div class="total-row">
          <span>Total</span>
          <span>${DB.formatMoney(s.sales.totalMoney)}</span>
        </div>
        <div class="total-row margin-row">
          <span>Utilidad estimada</span>
          <span>${DB.formatMoney(s.margin?.total || 0)}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Últimas ventas</div>
        ${renderRecentList(s.sales.items, s.productMap, 'sale', 8)}
      </div>
    `;
  }

  function buildSaleCatalogHelpers(categories, presentations, products) {
    const catalog = DB.getCatalogProducts(categories, presentations, products);
    const productLookup = {};
    catalog.forEach((p) => {
      productLookup[p.categoryId + '|' + p.presentationId] = p;
    });

    const categoryIds = new Set(catalog.map((p) => p.categoryId));
    const categoriesInCatalog = categories.filter((c) => categoryIds.has(c.id));

    return { catalog, productLookup, categoriesInCatalog, presentations };
  }

  function getProductForSelection(lookup, categoryId, presentationId) {
    if (!categoryId || !presentationId) return null;
    return lookup[categoryId + '|' + presentationId] || null;
  }

  function getPresentationsForCategory(catalog, categoryId) {
    const presIds = new Set();
    catalog.forEach((p) => {
      if (p.categoryId === categoryId) presIds.add(p.presentationId);
    });
    return presIds;
  }

  function ensureSingleSaleSelection(data) {
    const { catalog, productLookup, categoriesInCatalog } = data;
    const catValid = categoriesInCatalog.some((c) => c.id === singleSaleSelection.categoryId);
    if (!catValid) {
      singleSaleSelection.categoryId = categoriesInCatalog[0]?.id || null;
    }
    const validPres = getPresentationsForCategory(catalog, singleSaleSelection.categoryId);
    const presValid = validPres.has(singleSaleSelection.presentationId);
    if (!presValid) {
      singleSaleSelection.presentationId = validPres.size ? [...validPres][0] : null;
    }
    return getProductForSelection(productLookup, singleSaleSelection.categoryId, singleSaleSelection.presentationId);
  }

  function renderChipGroup(name, items, selectedId, enabledFn, dataAttr, groupId) {
    return '<div class="chip-group"' + (groupId ? ' id="' + groupId + '"' : '') + ' role="group" aria-label="' + escapeHtml(name) + '">' +
      items.map((item) => {
        const enabled = enabledFn ? enabledFn(item) : true;
        const active = item.id === selectedId;
        return '<button type="button" class="chip' + (active ? ' active' : '') + (!enabled ? ' disabled' : '') + '"' +
          ' data-' + dataAttr + '="' + item.id + '"' + (!enabled ? ' disabled' : '') + '>' +
          escapeHtml(item.name) + '</button>';
      }).join('') +
      '</div>';
  }

  function renderVenta() {
    return Promise.all([
      DB.getCategories(),
      DB.getPresentations(),
      DB.getProducts(),
      DB.getStockMap()
    ]).then(([categories, presentations, products, stockMap]) => {
        if (!products.length) {
          return `
            <div class="empty-state">
              ${Icons.catalog()}
              <p>Primero crea productos en el catálogo</p>
            </div>
          `;
        }

        const data = buildSaleCatalogHelpers(categories, presentations, products);
        saleCatalogData = data;
        saleStockMap = stockMap;
        const selectedProduct = ensureSingleSaleSelection(data);
        if (!selectedProduct) {
          singleSaleDraft.price = null;
          singleSaleProductId = null;
        } else if (selectedProduct.id !== singleSaleProductId) {
          singleSaleDraft.price = String(selectedProduct.standardPrice);
          singleSaleProductId = selectedProduct.id;
        } else if (singleSaleDraft.price === null) {
          singleSaleDraft.price = String(selectedProduct.standardPrice);
        }
        const priceValue = singleSaleDraft.price !== null
          ? singleSaleDraft.price
          : (selectedProduct?.standardPrice || 0);
        const qtyValue = singleSaleDraft.qty;
        const totalValue = DB.formatMoney((parseFloat(qtyValue) || 0) * (parseFloat(priceValue) || 0));

        if (!multiSaleRows.length) {
          const firstCat = data.categoriesInCatalog[0];
          const firstPres = firstCat
            ? [...getPresentationsForCategory(data.catalog, firstCat.id)][0]
            : null;
          const prod = getProductForSelection(data.productLookup, firstCat?.id, firstPres);
          multiSaleRows = [{
            categoryId: firstCat?.id || '',
            presentationId: firstPres || '',
            quantity: 1,
            price: prod?.standardPrice || 0
          }];
        }

        const singlePresEnabled = (p) =>
          singleSaleSelection.categoryId &&
          getPresentationsForCategory(data.catalog, singleSaleSelection.categoryId).has(p.id);

        const currentStock = selectedProduct ? (stockMap[selectedProduct.id] ?? 0) : null;
        const stockHint = selectedProduct
          ? '<p class="sale-stock-hint ' + (currentStock <= 0 ? 'stock-low' : 'stock-ok') +
            '">Disponible: ' + currentStock + ' uds</p>'
          : '';

        const singleHtml = `
          <div id="sale-single-panel" class="${saleMode === 'unica' ? '' : 'hidden'}">
            <form id="sale-single-form">
              <div class="form-group">
                <label>Categoría</label>
                ${renderChipGroup('Categoría', data.categoriesInCatalog, singleSaleSelection.categoryId, null, 'sale-cat', 'sale-cat-chips')}
              </div>
              <div class="form-group">
                <label>Presentación</label>
                ${renderChipGroup('Presentación', data.presentations, singleSaleSelection.presentationId, singlePresEnabled, 'sale-pres', 'sale-pres-chips')}
              </div>
              ${stockHint}
              <div class="sale-amount-row">
                <div class="form-group">
                  <label for="sale-qty">Cant.</label>
                  <input type="number" id="sale-qty" min="0.01" step="any" value="${qtyValue}" required inputmode="decimal">
                </div>
                <div class="form-group">
                  <label for="sale-price">Precio</label>
                  <input type="number" id="sale-price" min="0" step="1" value="${priceValue}" required inputmode="numeric">
                </div>
                <div class="form-group">
                  <label>Total</label>
                  <input type="text" id="sale-total" readonly value="${totalValue}">
                </div>
              </div>
              <p class="sale-time">Hora: ${DB.formatTime(Date.now())}</p>
              <button type="submit" class="btn btn-primary" ${selectedProduct ? '' : 'disabled'}>Registrar venta</button>
            </form>
          </div>
        `;

        const multiRowsHtml = multiSaleRows.map((row, index) => buildMultiSaleRowHtml(row, index, data)).join('');

        const multiHtml = `
            <div id="sale-multi-panel" class="${saleMode === 'varias' ? '' : 'hidden'}">
            <div id="sale-multi-rows">${multiRowsHtml}</div>
            <div class="btn-group sale-multi-actions">
              <button type="button" class="btn btn-secondary" id="sale-add-row">Agregar fila</button>
              <button type="button" class="btn btn-primary" id="sale-review-btn">Revisar</button>
            </div>
            <div id="sale-review" class="sale-review ${multiSaleReviewOpen ? '' : 'hidden'}"></div>
          </div>
        `;

        return `
          <div class="tabs">
            <button type="button" class="tab ${saleMode === 'unica' ? 'active' : ''}" data-sale-mode="unica">Única</button>
            <button type="button" class="tab ${saleMode === 'varias' ? 'active' : ''}" data-sale-mode="varias">Varias</button>
          </div>
          <div class="card">
            ${singleHtml}
            ${multiHtml}
          </div>
        `;
      });
  }

  function formatStockIssues(issues) {
    return issues.map((i) =>
      i.name + ': hay ' + i.stock + ' uds, intentas vender ' + i.requested
    ).join('\n');
  }

  function registerSales(lines) {
    return Promise.all(lines.map((l) => DB.addSale(l.productId, l.quantity, l.unitPrice)));
  }

  function submitSalesWithStockCheck(saleLines, onSuccess) {
    const checkItems = saleLines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      name: l.presentationName
        ? l.categoryName + ' — ' + l.presentationName
        : (l.name || 'Producto')
    }));

    return DB.checkSalesStock(checkItems).then((result) => {
      if (!result.ok) {
        throw new Error(formatStockIssues(result.issues));
      }
      return registerSales(saleLines)
        .then(() => refreshAllSummaries())
        .then(onSuccess);
    });
  }

  function getCategoriesForPresentation(catalog, presentationId) {
    const catIds = new Set();
    catalog.forEach((p) => {
      if (p.presentationId === presentationId) catIds.add(p.categoryId);
    });
    return catIds;
  }

  function getPresentationsInCatalog(data) {
    const presIds = new Set(data.catalog.map((p) => p.presentationId));
    return data.presentations
      .filter((p) => presIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function getMovementUnitPrice(prod, type) {
    if (!prod) return 0;
    return type === 'in' ? (prod.purchasePrice || 0) : (prod.standardPrice || 0);
  }

  function applyBulkMovementPricesForPres(presId, type) {
    const state = bulkMovementPresState[presId];
    if (!state?.allCategories || !inventoryCatalogData) return;

    const data = inventoryCatalogData;
    state.rows = state.rows.map((row) => {
      const prod = getProductForSelection(data.productLookup, row.categoryId, presId);
      return {
        ...row,
        purchasePrice: getMovementUnitPrice(prod, type)
      };
    });
  }

  function applyBulkMovementPrices(type) {
    Object.keys(bulkMovementPresState).forEach((presId) => {
      applyBulkMovementPricesForPres(presId, type);
    });
  }

  function prepareBulkMovementStateForPres(presId, data) {
    if (!bulkMovementPresState[presId]) {
      bulkMovementPresState[presId] = { allCategories: false, rows: [] };
    }

    const state = bulkMovementPresState[presId];
    if (!state.allCategories) {
      state.rows = [];
      return;
    }

    const prevQty = {};
    const prevBuy = {};
    state.rows.forEach((row) => {
      prevQty[row.categoryId] = row.quantity;
      prevBuy[row.categoryId] = row.purchasePrice;
    });

    const catIds = getCategoriesForPresentation(data.catalog, presId);
    const cats = data.categoriesInCatalog
      .filter((c) => catIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    state.rows = cats.map((cat) => {
      const prod = getProductForSelection(data.productLookup, cat.id, presId);
      return {
        categoryId: cat.id,
        quantity: prevQty[cat.id] ?? '',
        purchasePrice: prevBuy[cat.id] ?? getMovementUnitPrice(prod, movementEntryType)
      };
    });
  }

  function prepareBulkMovementState(data) {
    getPresentationsInCatalog(data).forEach((pres) => {
      prepareBulkMovementStateForPres(pres.id, data);
    });
  }

  function renderInvPresBulkRow(row, rowIndex, presId, data, stockMap, categoriesById, priceLabel) {
    const prod = getProductForSelection(data.productLookup, row.categoryId, presId);
    const priceVal = row.purchasePrice !== '' && row.purchasePrice !== undefined
      ? row.purchasePrice
      : getMovementUnitPrice(prod, movementEntryType);
    const currentStock = prod ? (stockMap[prod.id] ?? 0) : null;
    const stockCls = currentStock !== null && currentStock <= 0 ? 'stock-low' : 'stock-ok';
    const cat = categoriesById[row.categoryId];
    const catName = cat ? cat.name : '—';

    return `
      <div class="inv-bulk-row" data-row-index="${rowIndex}" data-category-id="${row.categoryId}">
        <span class="inv-cat-label" title="${escapeHtml(catName)}">${escapeHtml(catName)}</span>
        <input class="inv-qty" type="number" min="0" step="any" value="${row.quantity}" placeholder="0" inputmode="decimal" aria-label="Cantidad">
        <input class="inv-buy" type="number" min="0" step="1" value="${priceVal}" inputmode="numeric" aria-label="${escapeHtml(priceLabel)}">
        ${currentStock !== null ? '<span class="inv-stock ' + stockCls + '" title="Stock actual">' + currentStock + '</span>' : '<span class="inv-stock">—</span>'}
        <span class="btn-icon-spacer"></span>
      </div>
    `;
  }

  function buildInvPresGridHtml(presId, state, data, stockMap, categories) {
    const pres = data.presentations.find((p) => p.id === presId);
    if (!pres) return '';
    const categoriesById = {};
    categories.forEach((c) => { categoriesById[c.id] = c; });
    const allCategories = !!state.allCategories;
    const rows = allCategories ? (state.rows || []) : [];
    const priceColLabel = movementEntryType === 'in' ? 'P. compra' : 'P. venta';

    if (!allCategories) {
      return '<div class="inv-pres-empty">Marca «Todas las categorías» para cargar las filas.</div>';
    }
    if (!rows.length) {
      return '<div class="inv-pres-empty">Sin categorías en el catálogo para esta presentación.</div>';
    }
    return (
      '<div class="inv-bulk-labels inv-bulk-labels--pres" aria-hidden="true">' +
        '<span>Cat.</span><span>Cant.</span><span class="inv-price-col-label">' + priceColLabel + '</span><span>Stk</span><span></span>' +
      '</div>' +
      '<div class="inv-pres-rows">' +
        rows.map((row, index) =>
          renderInvPresBulkRow(row, index, presId, data, stockMap, categoriesById, priceColLabel)
        ).join('') +
      '</div>'
    );
  }

  function patchInvPresGrid(presId) {
    const card = document.querySelector('.inv-pres-accordion[data-pres-id="' + presId + '"]');
    if (!card || !inventoryCatalogData || !inventoryStockMap) return;
    const grid = card.querySelector('.inv-pres-grid');
    if (!grid) return;
    const state = bulkMovementPresState[presId] || { allCategories: false, rows: [] };
    grid.innerHTML = buildInvPresGridHtml(
      presId,
      state,
      inventoryCatalogData,
      inventoryStockMap,
      inventoryCategories || []
    );
  }

  function patchMovementTypeUI() {
    const priceColLabel = movementEntryType === 'in' ? 'P. compra' : 'P. venta';
    const hint = movementEntryType === 'in'
      ? 'Se aplicará el precio de compra del catálogo en cada fila.'
      : 'Se aplicará el precio de venta del catálogo en cada fila.';

    document.querySelectorAll('.inv-price-col-label').forEach((el) => {
      el.textContent = priceColLabel;
    });
    document.querySelectorAll('.inv-bulk-type-hint').forEach((el) => {
      el.textContent = hint;
    });

    document.querySelectorAll('[data-inv-bulk-mov-type]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.invBulkMovType === movementEntryType);
    });
    document.querySelectorAll('[data-mov-entry-type]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.movEntryType === movementEntryType);
    });

    const priceLabel = $('#mov-price-label');
    if (priceLabel) {
      priceLabel.textContent = movementEntryType === 'in'
        ? 'Precio de compra (por unidad)'
        : 'Precio de venta (por unidad)';
    }

    if (inventoryCatalogData && inventoryStockMap) {
      applyBulkMovementPrices(movementEntryType);
      Object.keys(bulkMovementPresState).forEach((presId) => {
        if (bulkMovementPresState[presId].allCategories) patchInvPresGrid(presId);
      });
    }

    const movProduct = $('#mov-product');
    const movUnitPrice = $('#mov-unit-price');
    if (movProduct && movUnitPrice && inventoryCatalogData) {
      const prod = inventoryCatalogData.catalog.find((p) => p.id === movProduct.value);
      movUnitPrice.value = getMovementUnitPrice(prod, movementEntryType);
    }
  }

  function renderInvPresBulkCard(pres, state, data, stockMap, categories) {
    const isOpen = openInvPresAccordions.has(pres.id);
    const catCount = getCategoriesForPresentation(data.catalog, pres.id).size;
    const defaultBuy = pres.defaultPurchasePrice ?? 0;
    const gridHtml = buildInvPresGridHtml(pres.id, state, data, stockMap, categories);

    return `
      <div class="accordion inv-pres-accordion" data-pres-id="${pres.id}">
        <button type="button" class="accordion-header ${isOpen ? 'open' : ''}" data-inv-accordion-toggle="${pres.id}" aria-expanded="${isOpen}">
          <span class="accordion-title">${escapeHtml(pres.name)}</span>
          <span class="accordion-meta">Compra ${DB.formatMoney(defaultBuy)} · ${catCount} cat.</span>
          <span class="accordion-chevron">${Icons.chevron(isOpen)}</span>
        </button>
        <div class="accordion-body">
          <div class="accordion-body-inner">
          <label class="inv-toggle inv-toggle--body">
            <input type="checkbox" data-inv-all-cats="${pres.id}"${state.allCategories ? ' checked' : ''}>
            <span>Todas las categorías</span>
          </label>
          <div class="inv-pres-grid">${gridHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderInventario() {
    return Promise.all([
      DB.getAllStock(),
      DB.getCategories(),
      DB.getPresentations(),
      DB.getProducts(),
      DB.getStockMap()
    ]).then(([stock, categories, presentations, products, stockMap]) => {
        const tabs = `
          <div class="tabs">
            <button type="button" class="tab ${inventoryTab === 'movimiento' ? 'active' : ''}" data-inv-tab="movimiento">Movimiento</button>
            <button type="button" class="tab ${inventoryTab === 'existencias' ? 'active' : ''}" data-inv-tab="existencias">Existencias</button>
          </div>
        `;

        if (!products.length) {
          return tabs + `
            <div class="card">
              <div class="empty-state">
                <p>Agrega productos en el catálogo primero</p>
              </div>
            </div>
          `;
        }

        const catalog = DB.getCatalogProducts(categories, presentations, products);
        const data = buildSaleCatalogHelpers(categories, presentations, products);
        inventoryCatalogData = data;
        inventoryStockMap = stockMap;
        inventoryCategories = categories;
        prepareBulkMovementState(data);

        const presList = getPresentationsInCatalog(data);
        if (!openInvPresAccordions.size && presList.length) {
          openInvPresAccordions.add(presList[0].id);
        }

        const options = catalog
          .map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`)
          .join('');

        const presCardsHtml = presList
          .map((pres) => renderInvPresBulkCard(
            pres,
            bulkMovementPresState[pres.id] || { allCategories: false, rows: [] },
            data,
            stockMap,
            categories
          ))
          .join('');

        if (inventoryTab === 'movimiento') {
          return tabs + `
            <div class="tabs inv-mode-tabs">
              <button type="button" class="tab ${inventoryMode === 'masa' ? 'active' : ''}" data-inv-mode="masa">En masa</button>
              <button type="button" class="tab ${inventoryMode === 'uno' ? 'active' : ''}" data-inv-mode="uno">Uno</button>
            </div>

            <div id="inv-bulk-panel" class="${inventoryMode === 'masa' ? '' : 'hidden'}">
              <p class="inv-bulk-hint">Abre una presentación, marca «Todas las categorías» y completa solo las cantidades.</p>
              <div id="inv-pres-cards">${presCardsHtml}</div>
              <div class="card inv-bulk-footer">
                <div class="form-group">
                  <label for="inv-bulk-note">Nota (opcional, aplica a todas las líneas)</label>
                  <input type="text" id="inv-bulk-note" placeholder="Ej: llegó del proveedor">
                </div>
                <div class="tabs inv-bulk-type-tabs">
                  <button type="button" class="tab ${movementEntryType === 'in' ? 'active' : ''}" data-inv-bulk-mov-type="in">Entrada</button>
                  <button type="button" class="tab ${movementEntryType === 'out' ? 'active' : ''}" data-inv-bulk-mov-type="out">Salida</button>
                </div>
                <p class="inv-bulk-type-hint">${movementEntryType === 'in'
                  ? 'Se aplicará el precio de compra del catálogo en cada fila.'
                  : 'Se aplicará el precio de venta del catálogo en cada fila.'}</p>
                <button type="button" class="btn btn-primary inv-bulk-register" id="inv-bulk-register">Registrar</button>
              </div>
            </div>

            <div class="card ${inventoryMode === 'uno' ? '' : 'hidden'}">
              <form id="movement-form">
                <div class="form-group">
                  <label for="mov-product">Producto</label>
                  <select id="mov-product" required>${options}</select>
                </div>
                <div class="form-group">
                  <label for="mov-quantity">Cantidad</label>
                  <input type="number" id="mov-quantity" min="0.01" step="any" value="1" required inputmode="decimal">
                </div>
                <div class="form-group" id="mov-price-group">
                  <label for="mov-unit-price" id="mov-price-label">${movementEntryType === 'in' ? 'Precio de compra (por unidad)' : 'Precio de venta (por unidad)'}</label>
                  <input type="number" id="mov-unit-price" min="0" step="1" value="0" inputmode="numeric">
                </div>
                <div class="form-group">
                  <label for="mov-note">Nota (opcional)</label>
                  <input type="text" id="mov-note" placeholder="Ej: llegó del proveedor">
                </div>
                <div class="tabs inv-bulk-type-tabs">
                  <button type="button" class="tab ${movementEntryType === 'in' ? 'active' : ''}" data-mov-entry-type="in">Entrada</button>
                  <button type="button" class="tab ${movementEntryType === 'out' ? 'active' : ''}" data-mov-entry-type="out">Salida</button>
                </div>
                <button type="button" class="btn btn-primary inv-bulk-register" id="mov-register">Registrar</button>
              </form>
            </div>
          `;
        }

        let stockList = renderStockList(stock, stockSortState);

        return tabs + `
          <div class="card">
            <div class="card-title">Existencias actuales</div>
            ${renderGroupToolbar(stockSortState, 'stock')}
            ${stockList}
          </div>
        `;
      }
    );
  }

  function renderCatalogo() {
    return Promise.all([
      DB.getCategories(),
      DB.getPresentations(),
      DB.getProducts()
    ]).then(([categories, presentations, products]) => {
      const tabs = `
        <div class="tabs">
          <button type="button" class="tab ${catalogTab === 'productos' ? 'active' : ''}" data-cat-tab="productos">Productos</button>
          <button type="button" class="tab ${catalogTab === 'presentaciones' ? 'active' : ''}" data-cat-tab="presentaciones">Presentaciones</button>
          <button type="button" class="tab ${catalogTab === 'categorias' ? 'active' : ''}" data-cat-tab="categorias">Categorías</button>
        </div>
      `;

      if (catalogTab === 'categorias') {
        let list = '';
        if (!categories.length) {
          list = emptyState('Sin categorías');
        } else {
          categories.forEach((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            list += `
              <div class="list-item" data-cat-id="${cat.id}">
                <div class="list-item-main">
                  <div class="list-item-title">${escapeHtml(cat.name)}</div>
                  <div class="list-item-sub">${count} producto(s) en catálogo</div>
                </div>
                <div class="inline-actions">
                  ${editBtn('data-edit-cat="' + cat.id + '"', 'Editar categoría')}
                  <button type="button" class="btn btn-danger btn-sm" data-del-cat="${cat.id}">Eliminar</button>
                </div>
              </div>
            `;
          });
        }

        return tabs + `
          <div class="card">
            <div class="card-title">Nueva categoría</div>
            <form id="category-form">
              <div class="form-group">
                <input type="text" id="cat-name" placeholder="Ej: Bebidas, Snacks..." required>
              </div>
              <button type="submit" class="btn btn-primary">Agregar categoría</button>
            </form>
          </div>
          <div class="card">
            <div class="card-title">Categorías</div>
            ${list}
          </div>
        `;
      }

      if (catalogTab === 'presentaciones') {
        let list = '';
        if (!presentations.length) {
          list = emptyState('Sin presentaciones');
        } else {
          presentations.forEach((p) => {
            const count = products.filter((prod) => prod.presentationId === p.id).length;
            list += `
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">${escapeHtml(p.name)}</div>
                  <div class="list-item-sub">Venta: ${DB.formatMoney(p.defaultPrice || 0)} · Compra: ${DB.formatMoney(p.defaultPurchasePrice || 0)} · ${count} producto(s)</div>
                </div>
                <div class="inline-actions">
                  ${editBtn('data-edit-pres="' + p.id + '"', 'Editar presentación')}
                  <button type="button" class="btn btn-danger btn-sm" data-del-pres="${p.id}">Eliminar</button>
                </div>
              </div>
            `;
          });
        }

        return tabs + `
          <div class="card">
            <div class="card-title">Nueva presentación</div>
            <form id="presentation-form">
              <div class="form-group">
                <label for="pres-name">Nombre</label>
                <input type="text" id="pres-name" placeholder="Ej: Botella 500ml, Lata 355ml..." required>
              </div>
              <div class="form-group">
                <label for="pres-default-price">Precio venta por defecto</label>
                <input type="number" id="pres-default-price" min="0" step="0.01" value="0" required inputmode="decimal">
              </div>
              <div class="form-group">
                <label for="pres-default-purchase-price">Precio compra por defecto</label>
                <input type="number" id="pres-default-purchase-price" min="0" step="0.01" value="0" required inputmode="decimal">
              </div>
              <button type="submit" class="btn btn-primary">Agregar presentación</button>
            </form>
          </div>
          <div class="card">
            <div class="card-title">Presentaciones</div>
            <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">
              Los precios por defecto (venta y compra) se heredan al crear productos en el catálogo.
            </p>
            ${list}
          </div>
        `;
      }

      // Tab productos (catálogo)
      const catOptions = categories.length
        ? categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
        : '';
      const presOptions = presentations.length
        ? presentations.map((p) =>
            `<option value="${p.id}" data-default-price="${p.defaultPrice || 0}" data-default-purchase-price="${p.defaultPurchasePrice || 0}">${escapeHtml(p.name)} (V: ${DB.formatMoney(p.defaultPrice || 0)})</option>`
          ).join('')
        : '';

      const firstPresPrice = presentations.length ? (presentations[0].defaultPrice || 0) : 0;
      const firstPresPurchasePrice = presentations.length ? (presentations[0].defaultPurchasePrice || 0) : 0;

      const catalog = DB.getCatalogProducts(categories, presentations, products);
      const list = renderCatalogAccordion(catalog);

      const canAddProduct = categories.length && presentations.length;
      const addForm = canAddProduct ? `
        <div class="card">
          <div class="card-title">Nuevo producto</div>
          <form id="product-form">
            <div class="form-group">
              <label for="prod-category">Categoría</label>
              <select id="prod-category" required>${catOptions}</select>
            </div>
            <div class="form-group">
              <label for="prod-presentation">Presentación</label>
              <select id="prod-presentation" required>${presOptions}</select>
            </div>
            <div class="form-group">
              <label for="prod-price">Precio venta</label>
              <input type="number" id="prod-price" min="0" step="0.01" value="${firstPresPrice}" required inputmode="decimal">
            </div>
            <div class="form-group">
              <label for="prod-purchase-price">Precio compra</label>
              <input type="number" id="prod-purchase-price" min="0" step="0.01" value="${firstPresPurchasePrice}" required inputmode="decimal">
              <p style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">Heredados de la presentación; puedes cambiarlos.</p>
            </div>
            <button type="submit" class="btn btn-primary">Agregar al catálogo</button>
          </form>
          <button type="button" class="btn btn-secondary" id="btn-bulk-products" style="margin-top:10px">
            Agregar varios (categorías × presentaciones)
          </button>
        </div>
      ` : `
        <div class="card">
          <div class="empty-state">
            <p>Crea al menos una categoría y una presentación</p>
            <div class="btn-group" style="margin-top:12px">
              ${!categories.length ? '<button type="button" class="btn btn-secondary" data-cat-tab="categorias">Categorías</button>' : ''}
              ${!presentations.length ? '<button type="button" class="btn btn-secondary" data-cat-tab="presentaciones">Presentaciones</button>' : ''}
            </div>
          </div>
        </div>
      `;

      return tabs + addForm + `
        <div class="card">
          <div class="card-title">Catálogo de productos</div>
          <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">
            Un producto = categoría + presentación + precios de venta y compra
          </p>
          ${list}
        </div>
      `;
    });
  }

  function renderReportes() {
    if (!reportSummary) {
      return emptyState('Cargando...');
    }

    const s = reportSummary;
    const margin = s.margin || { total: 0, totalCost: 0, percent: 0, grouped: {} };
    const dateLabel = formatReportDateLabel(reportDate);
    const emptyDay = 'Sin registros para ' + (isReportToday() ? 'hoy' : dateLabel.toLowerCase());

    const resumen = `
      <div class="stat-grid stat-grid--report">
        <div class="stat-box success">
          <div class="value">${DB.formatMoney(s.sales.totalMoney)}</div>
          <div class="label">Total ventas</div>
        </div>
        <div class="stat-box accent">
          <div class="value">${DB.formatMoney(margin.total)}</div>
          <div class="label">Utilidad</div>
        </div>
        <div class="stat-box">
          <div class="value">${margin.percent}%</div>
          <div class="label">Margen</div>
        </div>
        <div class="stat-box">
          <div class="value">${s.sales.totalUnits}</div>
          <div class="label">Uds vendidas</div>
        </div>
        <div class="stat-box warning">
          <div class="value">${s.entries.totalUnits}</div>
          <div class="label">Entradas</div>
        </div>
        <div class="stat-box danger">
          <div class="value">${s.exits.totalUnits}</div>
          <div class="label">Salidas</div>
        </div>
      </div>
    `;

    const tabs = `
      <div class="tabs tabs--scroll">
        <button type="button" class="tab ${reportTab === 'resumen' ? 'active' : ''}" data-rep-tab="resumen">Resumen</button>
        <button type="button" class="tab ${reportTab === 'utilidad' ? 'active' : ''}" data-rep-tab="utilidad">Utilidad</button>
        <button type="button" class="tab ${reportTab === 'ventas' ? 'active' : ''}" data-rep-tab="ventas">Ventas</button>
        <button type="button" class="tab ${reportTab === 'entradas' ? 'active' : ''}" data-rep-tab="entradas">Entradas</button>
        <button type="button" class="tab ${reportTab === 'salidas' ? 'active' : ''}" data-rep-tab="salidas">Salidas</button>
      </div>
    `;

    let content = '';

    if (reportTab === 'resumen') {
      content = resumen + `
        <div class="card">
          <div class="card-title">Ventas agrupadas</div>
          ${renderGroupedList(s.sales.grouped, true)}
        </div>
        <div class="card">
          <div class="card-title">Entradas agrupadas</div>
          ${renderGroupedList(s.entries.grouped, true)}
        </div>
        <div class="card">
          <div class="card-title">Salidas agrupadas</div>
          ${renderGroupedList(s.exits.grouped, false)}
        </div>
      `;
    } else if (reportTab === 'utilidad') {
      content = `
        <div class="card">
          <div class="card-title">Utilidad por producto</div>
          <p class="field-hint">Costo según precio de compra actual del catálogo.</p>
          ${renderGroupedMarginList(margin.grouped)}
          <div class="total-row"><span>Costo total vendido</span><span>${DB.formatMoney(margin.totalCost)}</span></div>
          <div class="total-row"><span>Ingresos por ventas</span><span>${DB.formatMoney(s.sales.totalMoney)}</span></div>
          <div class="total-row margin-row"><span>Utilidad total</span><span>${DB.formatMoney(margin.total)}</span></div>
          <div class="total-row"><span>Margen</span><span>${margin.percent}%</span></div>
        </div>
      `;
    } else if (reportTab === 'ventas') {
      content = `
        <div class="card">
          <div class="card-title">Detalle de ventas</div>
          ${renderGroupToolbar(reportSalesSortState, 'report-sales')}
          ${s.sales.items.length ? renderRecentList(s.sales.items, s.productMap, 'sale', null, true, true, reportSalesSortState) : emptyState(emptyDay)}
          <div class="total-row"><span>Total ventas</span><span>${DB.formatMoney(s.sales.totalMoney)}</span></div>
          <div class="total-row margin-row"><span>Utilidad</span><span>${DB.formatMoney(margin.total)}</span></div>
          ${s.sales.items.length ? `
          <button type="button" class="btn btn-danger" id="btn-delete-day-sales" style="margin-top:12px">
            Borrar ventas del día
          </button>
          <p style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">
            Elimina solo las ventas de ${escapeHtml(dateLabel.toLowerCase())}. El catálogo y movimientos no se borran.
          </p>` : ''}
        </div>
      `;
    } else if (reportTab === 'entradas') {
      content = `
        <div class="card">
          <div class="card-title">Detalle de entradas</div>
          ${renderGroupToolbar(reportEntriesSortState, 'report-entries')}
          ${s.entries.items.length ? renderRecentList(s.entries.items, s.productMap, 'in', null, true, false, reportEntriesSortState) : emptyState(emptyDay)}
          <div class="total-row"><span>Total unidades</span><span>${s.entries.totalUnits}</span></div>
          <div class="total-row"><span>Total compra</span><span>${DB.formatMoney(s.entries.totalMoney || 0)}</span></div>
        </div>
      `;
    } else if (reportTab === 'salidas') {
      content = `
        <div class="card">
          <div class="card-title">Detalle de salidas</div>
          ${renderGroupToolbar(reportExitsSortState, 'report-exits')}
          ${s.exits.items.length ? renderRecentList(s.exits.items, s.productMap, 'out', null, true, false, reportExitsSortState) : emptyState(emptyDay)}
          <div class="total-row"><span>Total unidades</span><span>${s.exits.totalUnits}</span></div>
        </div>
      `;
    }

    return renderReportDateBar() + tabs + content + `
      <div class="card">
        <div class="card-title">Exportar reporte${isReportToday() ? ' del día' : ''}</div>
        <div class="export-buttons">
          <button type="button" class="btn btn-secondary" data-export="csv">CSV</button>
          <button type="button" class="btn btn-secondary" data-export="excel">Excel</button>
          <button type="button" class="btn btn-secondary" data-export="json">JSON</button>
        </div>
        <button type="button" class="btn btn-secondary" data-export="backup" style="margin-top:10px">
          Descargar respaldo completo (JSON)
        </button>
      </div>
    `;
  }

  // --- Render orchestration ---

  function render(opts) {
    const animate = opts && opts.animate === true;
    updateHeaderDate();
    const main = $('#main-content');

    const renderers = {
      inicio: () => Promise.resolve(renderInicio()),
      venta: renderVenta,
      inventario: renderInventario,
      catalogo: renderCatalogo,
      reportes: () => Promise.resolve(renderReportes())
    };

    const renderer = renderers[currentView];
    if (!renderer) return Promise.resolve();

    const apply = animate ? UI.transitionView.bind(UI) : UI.updateView.bind(UI);
    return apply(main, () => Promise.resolve(renderer())).then(() => {
      bindEvents();
    });
  }

  function renderPersist() {
    return render({ animate: true });
  }

  function refreshSummary() {
    return DB.getDailySummary(new Date()).then((summary) => {
      dailySummary = summary;
    });
  }

  function refreshReportSummary() {
    return DB.getDailySummary(reportDate).then((summary) => {
      reportSummary = summary;
    });
  }

  function refreshAllSummaries() {
    return Promise.all([refreshSummary(), refreshReportSummary()]);
  }

  function setReportDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    reportDate = d;
    return refreshReportSummary();
  }

  function bindReportDateUI() {
    $('#report-prev-day')?.addEventListener('click', () => {
      const d = new Date(reportDate);
      d.setDate(d.getDate() - 1);
      setReportDate(d).then(() => render());
    });

    $('#report-next-day')?.addEventListener('click', () => {
      if (isReportToday()) return;
      const d = new Date(reportDate);
      d.setDate(d.getDate() + 1);
      if (d > new Date()) return;
      setReportDate(d).then(() => render());
    });

    $('#report-today')?.addEventListener('click', () => {
      if (isReportToday()) return;
      setReportDate(new Date()).then(() => render());
    });

    $('#report-date-input')?.addEventListener('change', (e) => {
      const picked = fromDateInputValue(e.target.value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (picked > today) {
        e.target.value = toDateInputValue(reportDate);
        showToast('No puedes elegir una fecha futura');
        return;
      }
      setReportDate(picked).then(() => render());
    });
  }

  function bindGroupSortUI() {
    document.querySelectorAll('[data-group-context]').forEach((toolbar) => {
      const ctx = toolbar.dataset.groupContext;
      const state = getSortStateRef(ctx);
      if (!state) return;

      toolbar.querySelectorAll('[data-group-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.groupMode;
          if (state.groupBy !== mode) {
            state.groupBy = mode;
            state.dir = defaultDirForGroupMode(mode);
          }
          render();
        });
      });

      toolbar.querySelector('[data-group-dir]')?.addEventListener('click', () => {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
        render();
      });
    });
  }

  function openEditSaleModal(saleId) {
    const s = reportSummary;
    if (!s) return;
    const sale = s.sales.items.find((item) => item.id === saleId);
    if (!sale) return;
    const prod = s.productMap[sale.productId];
    const label = prod ? prod.label : 'Producto';

    openEditModal({
      title: 'Editar venta — ' + label,
      fields: [
        { key: 'quantity', label: 'Cantidad', type: 'number', value: sale.quantity, min: 0.01, step: 'any', inputmode: 'decimal' },
        { key: 'unitPrice', label: 'Precio unitario', type: 'number', value: sale.unitPrice, min: 0, step: '1', inputmode: 'numeric' }
      ],
      onSave: (vals) => DB.updateSale(saleId, vals.quantity, vals.unitPrice)
        .then(() => refreshAllSummaries())
        .then(() => { showToast('Venta actualizada'); renderPersist(); })
    });
  }

  function openEditMovementModal(movId) {
    const s = reportSummary;
    if (!s) return;
    const mov = [...s.entries.items, ...s.exits.items].find((item) => item.id === movId);
    if (!mov) return;
    const prod = s.productMap[mov.productId];
    const label = prod ? prod.label : 'Producto';
    const typeLabel = mov.type === 'in' ? 'entrada' : 'salida';

    const fields = [
      { key: 'quantity', label: 'Cantidad', type: 'number', value: mov.quantity, min: 0.01, step: 'any', inputmode: 'decimal' },
      { key: 'note', label: 'Nota', type: 'text', value: mov.note || '', required: false, placeholder: 'Opcional' }
    ];

    if (mov.type === 'in') {
      fields.splice(1, 0, {
        key: 'purchasePrice',
        label: 'Precio de compra (por unidad)',
        type: 'number',
        value: mov.purchasePrice || 0,
        min: 0,
        step: '1',
        inputmode: 'numeric'
      });
    }

    openEditModal({
      title: 'Editar ' + typeLabel + ' — ' + label,
      fields,
      onSave: (vals) => DB.updateMovement(movId, vals.quantity, vals.note, vals.purchasePrice)
        .then(() => refreshAllSummaries())
        .then(() => { showToast('Movimiento actualizado'); renderPersist(); })
    });
  }

  function syncSingleFromDOM() {
    if ($('#sale-qty')) singleSaleDraft.qty = $('#sale-qty').value;
    if ($('#sale-price')) singleSaleDraft.price = $('#sale-price').value;
  }

  function syncMultiRowsFromDOM() {
    const rows = [];
    document.querySelectorAll('.sale-multi-row').forEach((el) => {
      rows.push({
        categoryId: el.querySelector('.multi-cat').value,
        presentationId: el.querySelector('.multi-pres').value,
        quantity: parseFloat(el.querySelector('.multi-qty').value) || 0,
        price: parseFloat(el.querySelector('.multi-price').value) || 0
      });
    });
    multiSaleRows = rows.length ? rows : multiSaleRows;
  }

  function updateSingleSaleTotal() {
    const qty = parseFloat($('#sale-qty')?.value) || 0;
    const price = parseFloat($('#sale-price')?.value) || 0;
    const total = $('#sale-total');
    if (total) total.value = DB.formatMoney(qty * price);
  }

  function buildMultiSaleLines() {
    if (!saleCatalogData) return [];
    syncMultiRowsFromDOM();
    const lines = [];
    multiSaleRows.forEach((row) => {
      const prod = getProductForSelection(saleCatalogData.productLookup, row.categoryId, row.presentationId);
      if (!prod || row.quantity <= 0) return;
      const unitPrice = parseFloat(row.price) || 0;
      lines.push({
        productId: prod.id,
        categoryName: prod.categoryName,
        presentationName: prod.presentationName,
        quantity: row.quantity,
        unitPrice,
        subtotal: row.quantity * unitPrice
      });
    });
    return lines;
  }

  function renderMultiReview() {
    const review = $('#sale-review');
    if (!review) return;

    const lines = buildMultiSaleLines();
    if (!lines.length) {
      review.innerHTML = emptyState('Agrega al menos una línea válida');
      review.classList.remove('hidden');
      multiSaleReviewOpen = true;
      return;
    }

    const total = lines.reduce((s, l) => s + l.subtotal, 0);
    let html = '<div class="card-title" style="margin-top:14px">Revisión</div>';

    DB.getStockMap().then((stockMap) => {
      lines.forEach((line) => {
        const stock = stockMap[line.productId] ?? 0;
        const warn = line.quantity > stock
          ? '<div class="sale-stock-warn">Stock insuficiente: hay ' + stock + ' uds</div>'
          : '<div class="list-item-sub">Stock disponible: ' + stock + ' uds</div>';

        html += '<div class="list-item">';
        html += '<div class="list-item-main">';
        html += '<div class="list-item-title">' + escapeHtml(line.presentationName) + '</div>';
        html += '<div class="list-item-sub">' + escapeHtml(line.categoryName) + ' · ' + line.quantity + ' × ' + DB.formatMoney(line.unitPrice) + '</div>';
        html += warn;
        html += '</div>';
        html += '<div class="list-item-value">' + DB.formatMoney(line.subtotal) + '</div>';
        html += '</div>';
      });
      html += '<div class="total-row"><span>Total venta</span><span>' + DB.formatMoney(total) + '</span></div>';
      html += '<button type="button" class="btn btn-primary" id="sale-confirm-multi" style="margin-top:12px">Confirmar venta</button>';
      review.innerHTML = html;
      review.classList.remove('hidden');
      multiSaleReviewOpen = true;

      $('#sale-confirm-multi').addEventListener('click', () => {
        submitSalesWithStockCheck(lines, () => {
          notifySuccess(lines.length + ' venta(s) registrada(s)');
          multiSaleRows = [];
          multiSaleReviewOpen = false;
          singleSaleDraft = { qty: '1', price: null };
          singleSaleProductId = null;
          renderPersist();
        }).catch((err) => notifyError(err.message || 'Error al registrar'));
      });
    });
  }

  function buildMultiSaleRowHtml(row, index, data) {
    const catOptions = data.categoriesInCatalog.map((c) =>
      '<option value="' + c.id + '"' + (row.categoryId === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>'
    ).join('');
    const validPres = row.categoryId
      ? [...getPresentationsForCategory(data.catalog, row.categoryId)]
      : [];
    const presOptions = data.presentations
      .filter((p) => validPres.includes(p.id))
      .map((p) =>
        '<option value="' + p.id + '"' + (row.presentationId === p.id ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>'
      ).join('');
    const prod = getProductForSelection(data.productLookup, row.categoryId, row.presentationId);
    const rowKey = row.categoryId + '|' + row.presentationId;
    if (row._key !== rowKey) {
      row.price = prod?.standardPrice || 0;
      row._key = rowKey;
    }
    const priceVal = row.price !== '' && row.price !== undefined ? row.price : (prod?.standardPrice || 0);

    return (
      '<div class="sale-multi-row" data-row-index="' + index + '">' +
        '<select class="multi-cat" aria-label="Categoría">' + catOptions + '</select>' +
        '<select class="multi-pres" aria-label="Presentación">' + (presOptions || '<option value="">—</option>') + '</select>' +
        '<input class="multi-qty" type="number" min="0.01" step="any" value="' + row.quantity + '" inputmode="decimal" aria-label="Cantidad">' +
        '<input class="multi-price" type="number" min="0" step="1" value="' + priceVal + '" inputmode="numeric" aria-label="Precio">' +
        (index > 0
          ? '<button type="button" class="btn-icon btn-remove-row" aria-label="Quitar fila">' + Icons.close() + '</button>'
          : '<span class="btn-icon-spacer"></span>') +
      '</div>'
    );
  }

  function patchSaleModeUI() {
    document.querySelectorAll('[data-sale-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.saleMode === saleMode);
    });
    $('#sale-single-panel')?.classList.toggle('hidden', saleMode !== 'unica');
    $('#sale-multi-panel')?.classList.toggle('hidden', saleMode !== 'varias');
    if (!multiSaleReviewOpen) $('#sale-review')?.classList.add('hidden');
    if (multiSaleReviewOpen && saleMode === 'varias') renderMultiReview();
  }

  function patchSingleSaleUI() {
    const data = saleCatalogData;
    if (!data) return;

    syncSingleFromDOM();
    const singlePresEnabled = (p) =>
      singleSaleSelection.categoryId &&
      getPresentationsForCategory(data.catalog, singleSaleSelection.categoryId).has(p.id);

    const selectedProduct = ensureSingleSaleSelection(data);
    if (selectedProduct && selectedProduct.id !== singleSaleProductId) {
      singleSaleDraft.price = String(selectedProduct.standardPrice);
      singleSaleProductId = selectedProduct.id;
    }

    const catEl = $('#sale-cat-chips');
    if (catEl) {
      catEl.outerHTML = renderChipGroup(
        'Categoría', data.categoriesInCatalog, singleSaleSelection.categoryId, null, 'sale-cat', 'sale-cat-chips'
      );
    }
    const presEl = $('#sale-pres-chips');
    if (presEl) {
      presEl.outerHTML = renderChipGroup(
        'Presentación', data.presentations, singleSaleSelection.presentationId, singlePresEnabled, 'sale-pres', 'sale-pres-chips'
      );
    }

    const currentStock = selectedProduct && saleStockMap ? (saleStockMap[selectedProduct.id] ?? 0) : null;
    const hintEl = $('#sale-single-panel .sale-stock-hint');
    if (selectedProduct) {
      const hintHtml =
        '<p class="sale-stock-hint ' + (currentStock <= 0 ? 'stock-low' : 'stock-ok') +
        '">Disponible: ' + currentStock + ' uds</p>';
      if (hintEl) hintEl.outerHTML = hintHtml;
      else $('#sale-pres-chips')?.closest('.form-group')?.insertAdjacentHTML('afterend', hintHtml);
    } else if (hintEl) {
      hintEl.remove();
    }

    const priceValue = singleSaleDraft.price !== null
      ? singleSaleDraft.price
      : (selectedProduct?.standardPrice || 0);
    const qtyInput = $('#sale-qty');
    const priceInput = $('#sale-price');
    if (priceInput && document.activeElement !== priceInput) {
      priceInput.value = priceValue;
    }
    updateSingleSaleTotal();

    const submitBtn = $('#sale-single-form button[type="submit"]');
    if (submitBtn) submitBtn.disabled = !selectedProduct;

    bindSingleSaleChips();
  }

  function patchMultiSaleRows() {
    const container = $('#sale-multi-rows');
    if (!container || !saleCatalogData) return;
    container.innerHTML = multiSaleRows
      .map((row, index) => buildMultiSaleRowHtml(row, index, saleCatalogData))
      .join('');
    bindMultiRowEvents();
  }

  function patchInvModeUI() {
    document.querySelectorAll('[data-inv-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.invMode === inventoryMode);
    });
    $('#inv-bulk-panel')?.classList.toggle('hidden', inventoryMode !== 'masa');
    const unoCard = $('#movement-form')?.closest('.card');
    if (unoCard) unoCard.classList.toggle('hidden', inventoryMode !== 'uno');
  }

  function bindSingleSaleChips() {
    document.querySelectorAll('[data-sale-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        syncSingleFromDOM();
        singleSaleSelection.categoryId = btn.dataset.saleCat;
        const validPres = getPresentationsForCategory(saleCatalogData.catalog, singleSaleSelection.categoryId);
        if (!validPres.has(singleSaleSelection.presentationId)) {
          singleSaleSelection.presentationId = validPres.size ? [...validPres][0] : null;
        }
        const prod = getProductForSelection(
          saleCatalogData.productLookup,
          singleSaleSelection.categoryId,
          singleSaleSelection.presentationId
        );
        singleSaleProductId = prod?.id || null;
        singleSaleDraft.price = prod ? String(prod.standardPrice) : null;
        patchSingleSaleUI();
      });
    });

    document.querySelectorAll('[data-sale-pres]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        syncSingleFromDOM();
        singleSaleSelection.presentationId = btn.dataset.salePres;
        const prod = getProductForSelection(
          saleCatalogData.productLookup,
          singleSaleSelection.categoryId,
          singleSaleSelection.presentationId
        );
        singleSaleProductId = prod?.id || null;
        singleSaleDraft.price = prod ? String(prod.standardPrice) : null;
        patchSingleSaleUI();
      });
    });
  }

  function bindMultiRowEvents() {
    document.querySelectorAll('.sale-multi-row').forEach((rowEl) => {
      const catSelect = rowEl.querySelector('.multi-cat');
      const presSelect = rowEl.querySelector('.multi-pres');

      catSelect.addEventListener('change', () => {
        syncMultiRowsFromDOM();
        const idx = parseInt(rowEl.dataset.rowIndex, 10);
        const validPres = [...getPresentationsForCategory(saleCatalogData.catalog, catSelect.value)];
        multiSaleRows[idx].categoryId = catSelect.value;
        multiSaleRows[idx].presentationId = validPres[0] || '';
        multiSaleRows[idx]._key = null;
        const prod = getProductForSelection(saleCatalogData.productLookup, catSelect.value, validPres[0]);
        multiSaleRows[idx].price = prod?.standardPrice || 0;
        patchMultiSaleRows();
      });

      presSelect.addEventListener('change', () => {
        syncMultiRowsFromDOM();
        const idx = parseInt(rowEl.dataset.rowIndex, 10);
        multiSaleRows[idx].presentationId = presSelect.value;
        multiSaleRows[idx]._key = null;
        const prod = getProductForSelection(saleCatalogData.productLookup, catSelect.value, presSelect.value);
        multiSaleRows[idx].price = prod?.standardPrice || 0;
        patchMultiSaleRows();
      });
    });

    document.querySelectorAll('.btn-remove-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncMultiRowsFromDOM();
        const rowEl = btn.closest('.sale-multi-row');
        const idx = parseInt(rowEl.dataset.rowIndex, 10);
        multiSaleRows.splice(idx, 1);
        multiSaleReviewOpen = false;
        $('#sale-review')?.classList.add('hidden');
        patchMultiSaleRows();
      });
    });
  }

  function bindSaleUI() {
    document.querySelectorAll('[data-sale-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (saleMode === 'unica') syncSingleFromDOM();
        if (saleMode === 'varias') syncMultiRowsFromDOM();
        saleMode = btn.dataset.saleMode;
        multiSaleReviewOpen = false;
        patchSaleModeUI();
      });
    });

    bindSingleSaleChips();

    const singleForm = $('#sale-single-form');
    if (singleForm) {
      const qtyInput = $('#sale-qty');
      const priceInput = $('#sale-price');
      qtyInput?.addEventListener('input', updateSingleSaleTotal);
      priceInput?.addEventListener('input', updateSingleSaleTotal);

      singleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const prod = getProductForSelection(
          saleCatalogData.productLookup,
          singleSaleSelection.categoryId,
          singleSaleSelection.presentationId
        );
        if (!prod) {
          showToast('Selecciona categoría y presentación válidas');
          return;
        }
        const quantity = parseFloat(qtyInput.value);
        const unitPrice = parseFloat(priceInput.value);
        if (quantity <= 0) {
          showToast('Cantidad debe ser mayor a 0');
          return;
        }
        submitSalesWithStockCheck([{
          productId: prod.id,
          quantity,
          unitPrice,
          categoryName: prod.categoryName,
          presentationName: prod.presentationName
        }], () => {
          notifySuccess('Venta registrada');
          singleSaleDraft = { qty: '1', price: null };
          singleSaleProductId = null;
          renderPersist();
        }).catch((err) => notifyError(err.message || 'Error al registrar venta'));
      });
    }

    bindMultiRowEvents();

    $('#sale-add-row')?.addEventListener('click', () => {
      syncMultiRowsFromDOM();
      const firstCat = saleCatalogData.categoriesInCatalog[0];
      const firstPres = firstCat
        ? [...getPresentationsForCategory(saleCatalogData.catalog, firstCat.id)][0]
        : '';
      const prod = getProductForSelection(saleCatalogData.productLookup, firstCat?.id, firstPres);
      multiSaleRows.push({
        categoryId: firstCat?.id || '',
        presentationId: firstPres || '',
        quantity: 1,
        price: prod?.standardPrice || 0
      });
      multiSaleReviewOpen = false;
      $('#sale-review')?.classList.add('hidden');
      patchMultiSaleRows();
    });

    $('#sale-review-btn')?.addEventListener('click', () => {
      renderMultiReview();
    });

    if (multiSaleReviewOpen && saleMode === 'varias') {
      renderMultiReview();
    }
  }

  function syncBulkMovementFromDOM() {
    document.querySelectorAll('.inv-pres-accordion').forEach((card) => {
      const presId = card.dataset.presId;
      const toggle = card.querySelector('[data-inv-all-cats]');
      const allCategories = toggle ? toggle.checked : false;
      const rows = [];

      if (allCategories) {
        card.querySelectorAll('.inv-bulk-row').forEach((el) => {
          const categoryId = el.dataset.categoryId;
          if (!categoryId) return;
          rows.push({
            categoryId,
            quantity: el.querySelector('.inv-qty').value,
            purchasePrice: parseFloat(el.querySelector('.inv-buy').value) || 0
          });
        });
      }

      bulkMovementPresState[presId] = { allCategories, rows };
    });
  }

  function buildBulkMovementLines(type) {
    syncBulkMovementFromDOM();
    const note = $('#inv-bulk-note')?.value || '';
    const data = inventoryCatalogData;
    if (!data) return [];

    const lines = [];
    Object.keys(bulkMovementPresState).forEach((presId) => {
      const { rows } = bulkMovementPresState[presId];
      rows.forEach((row) => {
        const qty = parseFloat(row.quantity) || 0;
        if (qty <= 0) return;
        const prod = getProductForSelection(data.productLookup, row.categoryId, presId);
        if (!prod) return;
        lines.push({
          productId: prod.id,
          type,
          quantity: qty,
          note,
          purchasePrice: row.purchasePrice
        });
      });
    });
    return lines;
  }

  function clearBulkMovementQuantities() {
    Object.keys(bulkMovementPresState).forEach((presId) => {
      if (!bulkMovementPresState[presId].allCategories) return;
      bulkMovementPresState[presId].rows = bulkMovementPresState[presId].rows.map((row) => ({
        ...row,
        quantity: ''
      }));
    });
  }

  function bindInventoryUI() {
    document.querySelectorAll('[data-inv-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inventoryMode = btn.dataset.invMode;
        patchInvModeUI();
      });
    });

    document.querySelectorAll('[data-inv-accordion-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presId = btn.dataset.invAccordionToggle;
        const body = btn.nextElementSibling;
        const isOpen = btn.classList.contains('open');

        if (isOpen) {
          openInvPresAccordions.delete(presId);
        } else {
          openInvPresAccordions.add(presId);
        }
        UI.setAccordion(btn, body, !isOpen, true);
      });
    });

    document.querySelectorAll('[data-inv-all-cats]').forEach((toggle) => {
      toggle.addEventListener('change', () => {
        syncBulkMovementFromDOM();
        const presId = toggle.dataset.invAllCats;
        if (!bulkMovementPresState[presId]) {
          bulkMovementPresState[presId] = { allCategories: false, rows: [] };
        }
        bulkMovementPresState[presId].allCategories = toggle.checked;
        if (toggle.checked && inventoryCatalogData) {
          prepareBulkMovementStateForPres(presId, inventoryCatalogData);
          applyBulkMovementPricesForPres(presId, movementEntryType);
        } else {
          bulkMovementPresState[presId].rows = [];
        }
        if (!openInvPresAccordions.has(presId)) {
          openInvPresAccordions.add(presId);
          const card = toggle.closest('.inv-pres-accordion');
          const header = card?.querySelector('[data-inv-accordion-toggle]');
          const body = header?.nextElementSibling;
          if (header && body) UI.setAccordion(header, body, true, true);
        }
        patchInvPresGrid(presId);
      });
    });

    document.querySelectorAll('[data-inv-bulk-mov-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncBulkMovementFromDOM();
        movementEntryType = btn.dataset.invBulkMovType;
        patchMovementTypeUI();
      });
    });

    $('#inv-bulk-register')?.addEventListener('click', () => {
      const lines = buildBulkMovementLines(movementEntryType);
      if (!lines.length) {
        showToast('Ingresa cantidad en al menos una fila');
        return;
      }

      DB.addMovementsBulk(lines)
        .then(() => refreshAllSummaries())
        .then(() => {
            notifySuccess(
              movementEntryType === 'in'
                ? lines.length + ' entrada(s) registrada(s)'
                : lines.length + ' salida(s) registrada(s)'
            );
          clearBulkMovementQuantities();
          if ($('#inv-bulk-note')) $('#inv-bulk-note').value = '';
          renderPersist();
        })
        .catch((err) => notifyError(err.message || 'Error al registrar movimientos'));
    });

    const movProduct = $('#mov-product');
    const movUnitPrice = $('#mov-unit-price');

    function updateSingleMovUnitPrice() {
      if (!movProduct || !movUnitPrice || !inventoryCatalogData) return;
      const prod = inventoryCatalogData.catalog.find((p) => p.id === movProduct.value);
      movUnitPrice.value = getMovementUnitPrice(prod, movementEntryType);
    }

    if (movProduct) {
      updateSingleMovUnitPrice();
      movProduct.addEventListener('change', updateSingleMovUnitPrice);
    }

    document.querySelectorAll('[data-mov-entry-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        movementEntryType = btn.dataset.movEntryType;
        patchMovementTypeUI();
      });
    });

    $('#mov-register')?.addEventListener('click', () => {
      const productId = $('#mov-product')?.value;
      const quantity = parseFloat($('#mov-quantity')?.value);
      const note = $('#mov-note')?.value || '';
      const purchasePrice = movementEntryType === 'in' ? $('#mov-unit-price')?.value : undefined;

      if (!productId) {
        showToast('Selecciona un producto');
        return;
      }
      if (quantity <= 0) {
        showToast('Cantidad debe ser mayor a 0');
        return;
      }

      DB.addMovement(productId, movementEntryType, quantity, note, purchasePrice)
        .then(() => refreshAllSummaries())
        .then(() => {
          notifySuccess(movementEntryType === 'in' ? 'Entrada registrada' : 'Salida registrada');
          $('#mov-quantity').value = '1';
          $('#mov-note').value = '';
          if (currentView === 'inicio' || currentView === 'reportes' || currentView === 'inventario') {
            renderPersist();
          }
        })
        .catch((err) => notifyError(err.message || 'Error al registrar movimiento'));
    });
  }

  // --- Event binding ---

  function bindEvents() {
    bindSaleUI();
    bindInventoryUI();

    // Category form
    const categoryForm = $('#category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#cat-name').value;
        DB.addCategory(name)
          .then(() => {
            showToast('Categoría agregada');
            renderPersist();
          })
          .catch((err) => showToast(err.message));
      });
    }

    document.querySelectorAll('[data-edit-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editCat;
        DB.getCategories().then((cats) => {
          const cat = cats.find((c) => c.id === id);
          if (!cat) return;
          openEditModal({
            title: 'Editar categoría',
            fields: [{ key: 'name', label: 'Nombre', type: 'text', value: cat.name }],
            onSave: (vals) => {
              if (!vals.name.trim()) throw new Error('Nombre requerido');
              return DB.updateCategory(id, vals.name.trim())
                .then(() => { showToast('Categoría actualizada'); return refreshAllSummaries(); })
                .then(() => renderPersist());
            }
          });
        });
      });
    });

    document.querySelectorAll('[data-del-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: 'Eliminar categoría',
          message: '¿Seguro que quieres eliminar esta categoría?',
          onConfirm: () => DB.deleteCategory(btn.dataset.delCat)
            .then(() => { showToast('Categoría eliminada'); renderPersist(); })
        });
      });
    });

    // Presentation form
    const presentationForm = $('#presentation-form');
    if (presentationForm) {
      presentationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        DB.addPresentation(
          $('#pres-name').value,
          $('#pres-default-price').value,
          $('#pres-default-purchase-price').value
        )
          .then(() => {
            showToast('Presentación agregada');
            renderPersist();
          })
          .catch((err) => showToast(err.message));
      });
    }

    document.querySelectorAll('[data-edit-pres]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editPres;
        Promise.all([DB.getPresentations(), DB.getProducts()]).then(([pres, products]) => {
          const p = pres.find((x) => x.id === id);
          if (!p) return;
          const catalogCount = products.filter((prod) => prod.presentationId === id).length;

          openEditModal({
            title: 'Editar presentación',
            fields: [
              { key: 'name', label: 'Nombre', type: 'text', value: p.name },
              { key: 'defaultPrice', label: 'Precio venta por defecto', type: 'number', value: p.defaultPrice || 0, min: 0, step: '0.01', inputmode: 'decimal' },
              { key: 'defaultPurchasePrice', label: 'Precio compra por defecto', type: 'number', value: p.defaultPurchasePrice || 0, min: 0, step: '0.01', inputmode: 'decimal' },
              {
                key: 'syncCatalog',
                type: 'checkbox',
                label: 'Aplicar precios al catálogo',
                hint: catalogCount
                  ? 'Actualiza los ' + catalogCount + ' producto(s) que usan esta presentación (incluye precios personalizados).'
                  : 'No hay productos en el catálogo con esta presentación.',
                checked: false,
                disabled: catalogCount === 0
              }
            ],
            onSave: (vals) => {
              if (!vals.name.trim()) throw new Error('Nombre requerido');
              return DB.updatePresentation(id, {
                name: vals.name.trim(),
                defaultPrice: vals.defaultPrice,
                defaultPurchasePrice: vals.defaultPurchasePrice,
                syncCatalog: !!vals.syncCatalog
              })
                .then((result) => {
                  let msg = 'Presentación actualizada';
                  if (result.catalogUpdated) {
                    msg += '. ' + result.catalogUpdated + ' producto(s) del catálogo actualizado(s)';
                  }
                  showToast(msg);
                  return refreshAllSummaries();
                })
                .then(() => renderPersist());
            }
          });
        });
      });
    });

    document.querySelectorAll('[data-del-pres]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: 'Eliminar presentación',
          message: '¿Seguro que quieres eliminar esta presentación?',
          onConfirm: () => DB.deletePresentation(btn.dataset.delPres)
            .then(() => { showToast('Presentación eliminada'); return refreshAllSummaries(); })
            .then(() => renderPersist())
        });
      });
    });

    const productForm = $('#product-form');
    if (productForm) {
      const presSelect = $('#prod-presentation');
      const priceInput = $('#prod-price');
      const purchaseInput = $('#prod-purchase-price');

      if (presSelect && priceInput) {
        presSelect.addEventListener('change', () => {
          const opt = presSelect.selectedOptions[0];
          priceInput.value = opt.dataset.defaultPrice || 0;
          if (purchaseInput) purchaseInput.value = opt.dataset.defaultPurchasePrice || 0;
        });
      }

      productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        DB.addProduct(
          $('#prod-category').value,
          $('#prod-presentation').value,
          $('#prod-price').value,
          $('#prod-purchase-price').value
        )
          .then(() => {
            showToast('Producto agregado al catálogo');
            renderPersist();
          })
          .catch((err) => showToast(err.message));
      });
    }

    const bulkBtn = $('#btn-bulk-products');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', () => {
        Promise.all([DB.getCategories(), DB.getPresentations(), DB.getProducts()]).then(
          ([categories, presentations, products]) => {
            if (!categories.length || !presentations.length) {
              showToast('Crea categorías y presentaciones primero');
              return;
            }
            openBulkProductModal(categories, presentations, products);
          }
        );
      });
    }

    document.querySelectorAll('[data-edit-prod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editProd;
        Promise.all([DB.getProducts(), DB.getPresentations()]).then(([products, presentations]) => {
          const prod = products.find((x) => x.id === id);
          if (!prod) return;
          const pres = presentations.find((p) => p.id === prod.presentationId);
          const prices = DB.resolveProductPrices(prod, pres);

          openEditModal({
            title: 'Editar producto',
            fields: [
              { key: 'standardPrice', label: 'Precio venta', type: 'number', value: prices.standardPrice, min: 0, step: '0.01', inputmode: 'decimal' },
              { key: 'purchasePrice', label: 'Precio compra', type: 'number', value: prices.purchasePrice, min: 0, step: '0.01', inputmode: 'decimal' }
            ],
            onSave: (vals) => DB.updateProduct(id, {
              standardPrice: vals.standardPrice,
              purchasePrice: vals.purchasePrice
            })
              .then(() => { showToast('Producto actualizado'); return refreshAllSummaries(); })
              .then(() => renderPersist())
          });
        });
      });
    });

    document.querySelectorAll('[data-del-prod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: 'Eliminar producto',
          message: '¿Seguro que quieres eliminar este producto del catálogo?',
          onConfirm: () => DB.deleteProduct(btn.dataset.delProd)
            .then(() => { showToast('Producto eliminado'); return refreshAllSummaries(); })
            .then(() => renderPersist())
        });
      });
    });

    UI.bindAccordions('[data-accordion-toggle]', 'accordionToggle', openCatalogAccordions);

    // Tabs
    document.querySelectorAll('[data-cat-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        catalogTab = btn.dataset.catTab;
        render();
      });
    });

    document.querySelectorAll('[data-inv-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inventoryTab = btn.dataset.invTab;
        render();
      });
    });

    document.querySelectorAll('[data-rep-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        reportTab = btn.dataset.repTab;
        render();
      });
    });

    bindReportDateUI();
    bindGroupSortUI();

    document.querySelectorAll('[data-edit-sale]').forEach((btn) => {
      btn.addEventListener('click', () => openEditSaleModal(btn.dataset.editSale));
    });

    document.querySelectorAll('[data-edit-mov]').forEach((btn) => {
      btn.addEventListener('click', () => openEditMovementModal(btn.dataset.editMov));
    });

    document.querySelectorAll('[data-del-sale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: 'Eliminar venta',
          message: '¿Eliminar esta venta?\n\nEl inventario se restaurará.',
          confirmLabel: 'Eliminar',
          onConfirm: () => DB.deleteSale(btn.dataset.delSale)
            .then(() => refreshAllSummaries())
            .then(() => {
              showToast('Venta eliminada');
              renderPersist();
            })
        });
      });
    });

    document.querySelectorAll('[data-del-mov]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: 'Eliminar movimiento',
          message: '¿Eliminar este movimiento?\n\nEl inventario se ajustará.',
          confirmLabel: 'Eliminar',
          onConfirm: () => DB.deleteMovement(btn.dataset.delMov)
            .then(() => refreshAllSummaries())
            .then(() => {
              showToast('Movimiento eliminado');
              renderPersist();
            })
        });
      });
    });

    const deleteDaySalesBtn = $('#btn-delete-day-sales');
    if (deleteDaySalesBtn) {
      deleteDaySalesBtn.addEventListener('click', () => {
        const dateLabel = formatReportDateLabel(reportDate).toLowerCase();
        openConfirmModal({
          title: 'Borrar ventas del día',
          message: 'Se eliminarán las ventas de ' + dateLabel + '.\n\nEl catálogo y los movimientos de inventario se conservan.\n\n¿Continuar?',
          confirmLabel: 'Borrar ventas',
          onConfirm: () => DB.deleteSalesForDay(reportDate)
            .then((result) => refreshAllSummaries().then(() => result))
            .then((result) => {
              showToast(result.deleted + ' venta(s) eliminada(s)');
              renderPersist();
            })
        });
      });
    }

    // Export
    document.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.export;
        if (type === 'backup') {
          DB.exportAllData().then((data) => {
            Export.exportFullBackup(data);
            showToast('Respaldo descargado');
          });
          return;
        }

        if (!dailySummary) return;

        if (!reportSummary) {
          showToast('Cargando reporte...');
          return;
        }
        if (type === 'csv') Export.exportDailyCsv(reportSummary);
        else if (type === 'excel') Export.exportDailyExcel(reportSummary);
        else if (type === 'json') Export.exportDailyJson(reportSummary);

        showToast('Reporte exportado');
      });
    });
  }

  function init() {
    Icons.mount();
    setupModal();
    setupTheme();

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    setView('inicio');

    DB.open()
      .then(() => refreshAllSummaries())
      .then(() => render())
      .catch((err) => {
        showToast('Error de base de datos: ' + (err.message || 'desconocido'));
        $('#main-content').innerHTML =
          '<div class="empty-state"><p>Error al iniciar la base de datos.</p>' +
          '<p style="margin-top:8px;font-size:0.85rem">' + escapeHtml(err.message || String(err)) + '</p>' +
          '<p style="margin-top:12px;font-size:0.8rem">Si persiste, borra los datos del sitio en el navegador.</p></div>';
      });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
