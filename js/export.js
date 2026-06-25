const Export = (function () {
  function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function dateStamp(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function escapeCsv(value) {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function formatMoneyExport(amount) {
    const num = Math.round(parseFloat(amount) || 0);
    return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function buildDailyReportRows(summary) {
    const rows = [];

    rows.push(['REPORTE DEL DÍA', dateStamp(summary.date)]);
    rows.push([]);

    rows.push(['VENTAS']);
    rows.push(['Categoría', 'Presentación', 'Unidades', 'Valor ($)']);
    appendGroupedRows(rows, summary.sales.grouped, true);
    rows.push(['', '', 'Total unidades', summary.sales.totalUnits]);
    rows.push(['', '', 'Total dinero', formatMoneyExport(summary.sales.totalMoney)]);
    if (summary.margin) {
      rows.push(['', '', 'Costo vendido', formatMoneyExport(summary.margin.totalCost)]);
      rows.push(['', '', 'Utilidad', formatMoneyExport(summary.margin.total)]);
      rows.push(['', '', 'Margen %', summary.margin.percent + '%']);
    }
    rows.push([]);

    rows.push(['ENTRADAS']);
    rows.push(['Categoría', 'Presentación', 'Unidades', 'Valor compra ($)']);
    appendGroupedRows(rows, summary.entries.grouped, true);
    rows.push(['', '', 'Total unidades', summary.entries.totalUnits]);
    rows.push(['', '', 'Total compra', formatMoneyExport(summary.entries.totalMoney || 0)]);
    rows.push([]);

    rows.push(['SALIDAS']);
    rows.push(['Categoría', 'Presentación', 'Unidades']);
    appendGroupedRows(rows, summary.exits.grouped, false);
    rows.push(['', '', 'Total unidades', summary.exits.totalUnits]);

    if (summary.margin && Object.keys(summary.margin.grouped).length) {
      rows.push([]);
      rows.push(['UTILIDAD POR PRODUCTO']);
      rows.push(['Categoría', 'Presentación', 'Unidades', 'Ingresos ($)', 'Costo ($)', 'Utilidad ($)']);
      appendMarginGroupedRows(rows, summary.margin.grouped);
      rows.push(['', '', '', '', 'Utilidad total', formatMoneyExport(summary.margin.total)]);
    }

    return rows;
  }

  function appendMarginGroupedRows(rows, grouped) {
    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'es'));
    if (!categories.length) {
      rows.push(['(sin ventas)']);
      return;
    }
    categories.forEach((cat) => {
      const presentations = grouped[cat];
      Object.keys(presentations).sort((a, b) => a.localeCompare(b, 'es')).forEach((presName) => {
        const data = presentations[presName];
        rows.push([
          cat,
          presName,
          data.units,
          formatMoneyExport(data.revenue),
          formatMoneyExport(data.cost),
          formatMoneyExport(data.margin)
        ]);
      });
    });
  }

  function appendGroupedRows(rows, grouped, includeValue) {
    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'es'));

    if (categories.length === 0) {
      rows.push(['(sin registros)']);
      return;
    }

    categories.forEach((cat) => {
      const presentations = grouped[cat];
      Object.keys(presentations).sort((a, b) => a.localeCompare(b, 'es')).forEach((presName) => {
        const data = presentations[presName];
        if (includeValue) {
          rows.push([cat, presName, data.units, formatMoneyExport(data.value)]);
        } else {
          rows.push([cat, presName, data.units]);
        }
      });
    });
  }

  function rowsToCsv(rows) {
    return '\ufeff' + rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  }

  function rowsToExcelHtml(rows, title) {
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">';
    html += '<head><meta charset="UTF-8">';
    html += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>';
    html += '<x:Name>' + title + '</x:Name>';
    html += '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>';
    html += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    html += '</head><body><table border="1">';

    rows.forEach((row) => {
      html += '<tr>';
      row.forEach((cell) => {
        html += '<td>' + String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td>';
      });
      html += '</tr>';
    });

    html += '</table></body></html>';
    return html;
  }

  function buildResumenJsonPayload(summary) {
    return {
      fecha: dateStamp(summary.date),
      pestana: 'Resumen',
      ventas: {
        totalUnidades: summary.sales.totalUnits,
        totalDinero: summary.sales.totalMoney,
        porCategoria: summary.sales.grouped
      },
      utilidad: summary.margin ? {
        total: summary.margin.total,
        costoTotal: summary.margin.totalCost,
        margenPorcentaje: summary.margin.percent,
        porProducto: summary.margin.grouped
      } : null,
      entradas: {
        totalUnidades: summary.entries.totalUnits,
        totalDinero: summary.entries.totalMoney || 0,
        porCategoria: summary.entries.grouped
      },
      salidas: {
        totalUnidades: summary.exits.totalUnits,
        porCategoria: summary.exits.grouped
      }
    };
  }

  function exportReportCsv(bundle) {
    const rows = bundle.resumen ? buildDailyReportRows(bundle.summary) : bundle.rows;
    download(rowsToCsv(rows), bundle.baseName + '.csv', 'text/csv;charset=utf-8');
  }

  function exportReportExcel(bundle) {
    const rows = bundle.resumen ? buildDailyReportRows(bundle.summary) : bundle.rows;
    const html = rowsToExcelHtml(rows, bundle.baseName);
    download('\ufeff' + html, bundle.baseName + '.xls', 'application/vnd.ms-excel;charset=utf-8');
  }

  function exportReportJson(bundle) {
    const payload = bundle.resumen ? buildResumenJsonPayload(bundle.summary) : bundle.json;
    download(JSON.stringify(payload, null, 2), bundle.baseName + '.json', 'application/json;charset=utf-8');
  }

  function exportDailyCsv(summary) {
    const rows = buildDailyReportRows(summary);
    const filename = 'reporte-' + dateStamp(summary.date) + '.csv';
    download(rowsToCsv(rows), filename, 'text/csv;charset=utf-8');
  }

  function exportDailyExcel(summary) {
    const rows = buildDailyReportRows(summary);
    const filename = 'reporte-' + dateStamp(summary.date) + '.xls';
    const html = rowsToExcelHtml(rows, 'Reporte ' + dateStamp(summary.date));
    download('\ufeff' + html, filename, 'application/vnd.ms-excel;charset=utf-8');
  }

  function exportDailyJson(summary) {
    const payload = {
      fecha: dateStamp(summary.date),
      ventas: {
        totalUnidades: summary.sales.totalUnits,
        totalDinero: summary.sales.totalMoney,
        porCategoria: summary.sales.grouped,
        detalle: summary.sales.items.map((s) => {
          const prod = summary.productMap[s.productId];
          const unitCost = prod?.purchasePrice || 0;
          const revenue = s.quantity * s.unitPrice;
          const cost = s.quantity * unitCost;
          return {
            productId: s.productId,
            presentacion: prod?.presentationName,
            categoria: prod?.categoryName,
            cantidad: s.quantity,
            precioUnitario: s.unitPrice,
            costoUnitario: unitCost,
            total: revenue,
            costoTotal: cost,
            utilidad: revenue - cost,
            hora: new Date(s.timestamp).toISOString()
          };
        })
      },
      utilidad: summary.margin ? {
        total: summary.margin.total,
        costoTotal: summary.margin.totalCost,
        margenPorcentaje: summary.margin.percent,
        porProducto: summary.margin.grouped
      } : null,
      entradas: {
        totalUnidades: summary.entries.totalUnits,
        porCategoria: summary.entries.grouped,
        detalle: summary.entries.items.map((m) => ({
          productId: m.productId,
          presentacion: summary.productMap[m.productId]?.presentationName,
          categoria: summary.productMap[m.productId]?.categoryName,
          cantidad: m.quantity,
          hora: new Date(m.timestamp).toISOString(),
          nota: m.note
        }))
      },
      salidas: {
        totalUnidades: summary.exits.totalUnits,
        porCategoria: summary.exits.grouped,
        detalle: summary.exits.items.map((m) => ({
          productId: m.productId,
          presentacion: summary.productMap[m.productId]?.presentationName,
          categoria: summary.productMap[m.productId]?.categoryName,
          cantidad: m.quantity,
          hora: new Date(m.timestamp).toISOString(),
          nota: m.note
        }))
      }
    };

    const filename = 'reporte-' + dateStamp(summary.date) + '.json';
    download(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8');
  }

  function defaultBackupFilename() {
    return 'respaldo-ventas-' + dateStamp(new Date()) + '.json';
  }

  function sanitizeBackupFilename(name, fallback) {
    let base = String(name ?? '').trim();
    if (!base) base = fallback || defaultBackupFilename();
    base = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
    if (!base) base = fallback || defaultBackupFilename();
    if (!/\.json$/i.test(base)) base += '.json';
    return base;
  }

  function exportFullBackup(data, filename) {
    const name = sanitizeBackupFilename(filename, defaultBackupFilename());
    download(JSON.stringify(data, null, 2), name, 'application/json;charset=utf-8');
  }

  async function saveBackupWithPicker(data, suggestedName) {
    if (!window.showSaveFilePicker) return null;
    const suggested = sanitizeBackupFilename(suggestedName, defaultBackupFilename());
    const handle = await window.showSaveFilePicker({
      suggestedName: suggested,
      types: [{
        description: 'JSON',
        accept: { 'application/json': ['.json'] }
      }]
    });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return handle.name || suggested;
  }

  async function shareFullBackup(data, filename) {
    const name = sanitizeBackupFilename(filename, defaultBackupFilename());
    const json = JSON.stringify(data, null, 2);
    const file = new File([json], name, { type: 'application/json' });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        files: [file],
        title: 'Respaldo Ventas App',
        text: 'Respaldo completo de catálogo, ventas e inventario'
      });
      return 'shared';
    }

    download(json, name, 'application/json;charset=utf-8');
    return 'download';
  }

  return {
    exportDailyCsv,
    exportDailyExcel,
    exportDailyJson,
    exportReportCsv,
    exportReportExcel,
    exportReportJson,
    defaultBackupFilename,
    sanitizeBackupFilename,
    saveBackupWithPicker,
    exportFullBackup,
    shareFullBackup
  };
})();
