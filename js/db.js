const DB = (function () {
  const DB_NAME = 'VentasApp';
  const DB_VERSION = 7;
  let db = null;

  function open() {
    if (db) return Promise.resolve(db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const transaction = event.target.transaction;
        const oldVersion = event.oldVersion;

        if (!database.objectStoreNames.contains('categories')) {
          database.createObjectStore('categories', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('presentations')) {
          database.createObjectStore('presentations', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('products')) {
          const store = database.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('presentationId', 'presentationId', { unique: false });
        }

        if (!database.objectStoreNames.contains('sales')) {
          const store = database.createObjectStore('sales', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('productId', 'productId', { unique: false });
        }

        if (!database.objectStoreNames.contains('movements')) {
          const store = database.createObjectStore('movements', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('productId', 'productId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }

        if (oldVersion > 0 && oldVersion < 3) {
          const presStore = transaction.objectStore('presentations');
          const productStore = transaction.objectStore('products');
          const salesStore = transaction.objectStore('sales');
          const movStore = transaction.objectStore('movements');

          presStore.getAll().onsuccess = (e) => {
            e.target.result.forEach((pres) => {
              if (pres.categoryId !== undefined) {
                productStore.put({
                  id: pres.id,
                  categoryId: pres.categoryId,
                  presentationId: pres.id,
                  standardPrice: pres.standardPrice || 0,
                  createdAt: pres.createdAt || Date.now()
                });
                presStore.put({
                  id: pres.id,
                  name: pres.name,
                  defaultPrice: pres.standardPrice || 0,
                  createdAt: pres.createdAt || Date.now()
                });
              }
            });
          };

          salesStore.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            const sale = cursor.value;
            if (sale.presentationId && !sale.productId) {
              sale.productId = sale.presentationId;
              delete sale.presentationId;
              cursor.update(sale);
            }
            cursor.continue();
          };

          movStore.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            const mov = cursor.value;
            if (mov.presentationId && !mov.productId) {
              mov.productId = mov.presentationId;
              delete mov.presentationId;
              cursor.update(mov);
            }
            cursor.continue();
          };
        }

        if (oldVersion > 0 && oldVersion < 4) {
          const presStore = transaction.objectStore('presentations');
          const productStore = transaction.objectStore('products');

          productStore.getAll().onsuccess = (e) => {
            const products = e.target.result;
            presStore.getAll().onsuccess = (e2) => {
              e2.target.result.forEach((pres) => {
                if (pres.defaultPrice === undefined) {
                  const linked = products.find((prod) => prod.presentationId === pres.id);
                  pres.defaultPrice = pres.standardPrice ?? linked?.standardPrice ?? 0;
                  if (pres.standardPrice !== undefined) delete pres.standardPrice;
                  presStore.put(pres);
                }
              });
            };
          };
        }

        if (oldVersion > 0 && oldVersion < 5) {
          const presStore = transaction.objectStore('presentations');
          const productStore = transaction.objectStore('products');

          presStore.getAll().onsuccess = (e) => {
            const presentations = e.target.result;
            presentations.forEach((pres) => {
              if (pres.defaultPurchasePrice === undefined) {
                pres.defaultPurchasePrice = 0;
                presStore.put(pres);
              }
            });

            productStore.getAll().onsuccess = (e2) => {
              const presMap = {};
              presentations.forEach((pres) => { presMap[pres.id] = pres; });

              e2.target.result.forEach((prod) => {
                if (prod.purchasePrice === undefined) {
                  const pres = presMap[prod.presentationId];
                  prod.purchasePrice = pres?.defaultPurchasePrice ?? 0;
                  productStore.put(prod);
                }
              });
            };
          };
        }

        if (oldVersion > 0 && oldVersion < 6) {
          const presStore = transaction.objectStore('presentations');
          const productStore = transaction.objectStore('products');

          presStore.getAll().onsuccess = (e) => {
            const presentations = e.target.result;
            const presMap = {};
            presentations.forEach((pres) => { presMap[pres.id] = pres; });

            productStore.getAll().onsuccess = (e2) => {
              e2.target.result.forEach((prod) => {
                const pres = presMap[prod.presentationId];
                if (!pres) return;

                let changed = false;
                const presSale = pres.defaultPrice ?? 0;
                const presBuy = pres.defaultPurchasePrice ?? 0;

                if (prod.standardPrice !== undefined && prod.standardPrice === presSale) {
                  delete prod.standardPrice;
                  changed = true;
                }
                if (prod.purchasePrice !== undefined && prod.purchasePrice === presBuy) {
                  delete prod.purchasePrice;
                  changed = true;
                }
                if (prod.purchasePrice === 0 && presBuy > 0) {
                  delete prod.purchasePrice;
                  changed = true;
                }

                if (changed) productStore.put(prod);
              });
            };
          };
        }

        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  function tx(storeNames, mode) {
    return open().then((database) => {
      const transaction = database.transaction(storeNames, mode);
      return {
        transaction,
        stores: storeNames.reduce((acc, name) => {
          acc[name] = transaction.objectStore(name);
          return acc;
        }, {})
      };
    });
  }

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getAll(storeName) {
    return tx([storeName], 'readonly').then(({ stores }) =>
      promisifyRequest(stores[storeName].getAll())
    );
  }

  function put(storeName, item) {
    return tx([storeName], 'readwrite').then(({ stores }) =>
      promisifyRequest(stores[storeName].put(item))
    );
  }

  function remove(storeName, id) {
    return tx([storeName], 'readwrite').then(({ stores }) =>
      promisifyRequest(stores[storeName].delete(id))
    );
  }

  // --- Categories ---

  function getCategories() {
    return getAll('categories').then((items) =>
      items.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );
  }

  function addCategory(name) {
    const item = { id: generateId(), name: name.trim(), createdAt: Date.now() };
    return put('categories', item).then(() => item);
  }

  function updateCategory(id, name) {
    return getCategories().then((items) => {
      const existing = items.find((c) => c.id === id);
      if (!existing) throw new Error('Categoría no encontrada');
      existing.name = name.trim();
      return put('categories', existing).then(() => existing);
    });
  }

  function deleteCategory(id) {
    return getProducts().then((products) => {
      if (products.some((p) => p.categoryId === id)) {
        throw new Error('No se puede eliminar: tiene productos en el catálogo');
      }
      return remove('categories', id);
    });
  }

  // --- Presentations (independientes) ---

  function getPresentations() {
    return getAll('presentations').then((items) =>
      items.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );
  }

  function addPresentation(name, defaultPrice, defaultPurchasePrice) {
    const item = {
      id: generateId(),
      name: name.trim(),
      defaultPrice: parseFloat(defaultPrice) || 0,
      defaultPurchasePrice: parseFloat(defaultPurchasePrice) || 0,
      createdAt: Date.now()
    };
    return put('presentations', item).then(() => item);
  }

  function syncCatalogFromPresentation(presentationId) {
    return getProducts().then((products) => {
      const linked = products.filter((p) => p.presentationId === presentationId);
      if (!linked.length) return { updated: 0 };

      return tx(['products'], 'readwrite').then(({ stores }) => {
        const store = stores.products;
        return Promise.all(linked.map((prod) => {
          delete prod.standardPrice;
          delete prod.purchasePrice;
          return promisifyRequest(store.put(prod));
        })).then(() => ({ updated: linked.length }));
      });
    });
  }

  function updatePresentation(id, data) {
    return getPresentations().then((items) => {
      const existing = items.find((p) => p.id === id);
      if (!existing) throw new Error('Presentación no encontrada');
      if (data.name !== undefined) existing.name = data.name.trim();
      if (data.defaultPrice !== undefined) existing.defaultPrice = parseFloat(data.defaultPrice) || 0;
      if (data.defaultPurchasePrice !== undefined) {
        existing.defaultPurchasePrice = parseFloat(data.defaultPurchasePrice) || 0;
      }
      return put('presentations', existing).then(() => {
        if (!data.syncCatalog) return { presentation: existing, catalogUpdated: 0 };
        return syncCatalogFromPresentation(id).then((result) => ({
          presentation: existing,
          catalogUpdated: result.updated
        }));
      });
    });
  }

  function deletePresentation(id) {
    return getProducts().then((products) => {
      if (products.some((p) => p.presentationId === id)) {
        throw new Error('No se puede eliminar: está usada en el catálogo');
      }
      return remove('presentations', id);
    });
  }

  // --- Products (catálogo = categoría + presentación + precio) ---

  function resolveProductPrices(prod, pres) {
    const presSale = pres?.defaultPrice ?? 0;
    const presBuy = pres?.defaultPurchasePrice ?? 0;
    return {
      standardPrice: prod.standardPrice != null ? Number(prod.standardPrice) : presSale,
      purchasePrice: prod.purchasePrice != null ? Number(prod.purchasePrice) : presBuy
    };
  }

  function applyProductPriceOverrides(item, pres, standardPrice, purchasePrice) {
    const inheritedSalePrice = pres ? (pres.defaultPrice ?? 0) : 0;
    const inheritedPurchasePrice = pres ? (pres.defaultPurchasePrice ?? 0) : 0;
    const sale = standardPrice !== undefined && standardPrice !== ''
      ? parseFloat(standardPrice) || 0
      : inheritedSalePrice;
    const buy = purchasePrice !== undefined && purchasePrice !== ''
      ? parseFloat(purchasePrice) || 0
      : inheritedPurchasePrice;

    if (sale !== inheritedSalePrice) item.standardPrice = sale;
    else delete item.standardPrice;

    if (buy !== inheritedPurchasePrice) item.purchasePrice = buy;
    else delete item.purchasePrice;

    return item;
  }

  function getProducts() {
    return getAll('products');
  }

  function normalizeProductRefs(categoryId, presentationId) {
    return {
      categoryId: categoryId && String(categoryId).trim() ? categoryId : null,
      presentationId: presentationId && String(presentationId).trim() ? presentationId : null
    };
  }

  function isDuplicateProduct(products, candidate, excludeId) {
    const categoryId = candidate.categoryId || null;
    const presentationId = candidate.presentationId || null;
    const nameKey = String(candidate.name || '').trim().toLowerCase();
    return products.some((p) => {
      if (excludeId && p.id === excludeId) return false;
      const pc = p.categoryId || null;
      const pp = p.presentationId || null;
      if (categoryId && presentationId) {
        return pc === categoryId && pp === presentationId;
      }
      const pn = String(p.name || '').trim().toLowerCase();
      return pc === categoryId && pp === presentationId && pn === nameKey;
    });
  }

  function buildProductLabel(prod, catName, presName) {
    const customName = String(prod.name || '').trim();
    const parts = [];
    if (customName) parts.push(customName);
    if (prod.categoryId && catName && catName !== 'Sin categoría') parts.push(catName);
    if (prod.presentationId && presName && presName !== 'Sin presentación') parts.push(presName);
    if (!parts.length) {
      if (!prod.categoryId && !prod.presentationId) return customName || 'Producto';
      return [catName, presName].filter((x) => x && x !== 'Sin categoría' && x !== 'Sin presentación').join(' — ') || 'Producto';
    }
    return parts.join(' — ');
  }

  function addProduct(categoryId, presentationId, standardPrice, purchasePrice, name) {
    const refs = normalizeProductRefs(categoryId, presentationId);
    const productName = String(name || '').trim();
    if (!refs.categoryId && !refs.presentationId && !productName) {
      throw new Error('Indica un nombre si el producto no tiene categoría ni presentación');
    }

    return Promise.all([getProducts(), getPresentations()]).then(([products, presentations]) => {
      const candidate = {
        categoryId: refs.categoryId,
        presentationId: refs.presentationId,
        name: productName || undefined
      };
      if (isDuplicateProduct(products, candidate)) {
        throw new Error('Ya existe ese producto en el catálogo');
      }

      const pres = refs.presentationId
        ? presentations.find((p) => p.id === refs.presentationId)
        : null;
      const item = {
        id: generateId(),
        categoryId: refs.categoryId,
        presentationId: refs.presentationId,
        createdAt: Date.now()
      };
      if (productName) item.name = productName;
      return put('products', applyProductPriceOverrides(item, pres, standardPrice, purchasePrice)).then(() => item);
    });
  }

  function addProductsBulk(categoryIds, presentationIds) {
    return Promise.all([getProducts(), getPresentations()]).then(([products, presentations]) => {
      const existing = new Set(products.map((p) => p.categoryId + '|' + p.presentationId));
      const presMap = {};
      presentations.forEach((p) => { presMap[p.id] = p; });

      const toAdd = [];
      let skipped = 0;

      categoryIds.forEach((categoryId) => {
        presentationIds.forEach((presentationId) => {
          const key = categoryId + '|' + presentationId;
          if (existing.has(key)) {
            skipped++;
            return;
          }
          const pres = presMap[presentationId];
          const item = {
            id: generateId(),
            categoryId,
            presentationId,
            createdAt: Date.now()
          };
          toAdd.push(applyProductPriceOverrides(item, pres));
          existing.add(key);
        });
      });

      if (!toAdd.length) {
        return { added: 0, skipped };
      }

      return tx(['products'], 'readwrite').then(({ stores }) => {
        const store = stores.products;
        return Promise.all(toAdd.map((item) => promisifyRequest(store.put(item)))).then(() => ({
          added: toAdd.length,
          skipped
        }));
      });
    });
  }

  function updateProduct(id, data) {
    return Promise.all([getProducts(), getPresentations()]).then(([items, presentations]) => {
      const existing = items.find((p) => p.id === id);
      if (!existing) throw new Error('Producto no encontrado');

      const categoryId = data.categoryId !== undefined
        ? normalizeProductRefs(data.categoryId, null).categoryId
        : (existing.categoryId || null);
      const presentationId = data.presentationId !== undefined
        ? normalizeProductRefs(null, data.presentationId).presentationId
        : (existing.presentationId || null);

      const candidate = {
        categoryId,
        presentationId,
        name: data.name !== undefined ? String(data.name).trim() : (existing.name || '')
      };
      if (isDuplicateProduct(items, candidate, id)) {
        throw new Error('Ya existe ese producto en el catálogo');
      }

      if (data.categoryId !== undefined) existing.categoryId = categoryId;
      if (data.presentationId !== undefined) existing.presentationId = presentationId;
      if (data.name !== undefined) {
        const trimmed = String(data.name).trim();
        if (trimmed) existing.name = trimmed;
        else delete existing.name;
      }

      const pres = existing.presentationId
        ? presentations.find((p) => p.id === existing.presentationId)
        : null;
      const presSale = pres?.defaultPrice ?? 0;
      const presBuy = pres?.defaultPurchasePrice ?? 0;

      if (data.standardPrice !== undefined) {
        const val = parseFloat(data.standardPrice) || 0;
        if (val === presSale) delete existing.standardPrice;
        else existing.standardPrice = val;
      }
      if (data.purchasePrice !== undefined) {
        const val = parseFloat(data.purchasePrice) || 0;
        if (val === presBuy) delete existing.purchasePrice;
        else existing.purchasePrice = val;
      }

      return put('products', existing).then(() => existing);
    });
  }

  function deleteProduct(id) {
    return Promise.all([getSales(), getMovements()]).then(([sales, movements]) => {
      if (sales.some((s) => s.productId === id) || movements.some((m) => m.productId === id)) {
        throw new Error('No se puede eliminar: tiene ventas o movimientos registrados');
      }
      return remove('products', id);
    });
  }

  // --- Sales ---

  function getSales() {
    return getAll('sales');
  }

  function stockError(productLabel, current, requested) {
    return productLabel + ': hay ' + current + ' unid, no se pueden retirar ' + requested;
  }

  function getProductLabel(productId) {
    return Promise.all([getCategories(), getPresentations(), getProducts()]).then(
      ([categories, presentations, products]) => {
        const { productMap } = getProductMap(categories, presentations, products);
        const prod = productMap[productId];
        return prod ? prod.label : 'Producto';
      }
    );
  }

  function assertCanRemoveStock(productId, quantity) {
    const qty = parseFloat(quantity) || 0;
    return Promise.all([getStockMap(), getProductLabel(productId)]).then(([stockMap, label]) => {
      const current = stockMap[productId] ?? 0;
      if (qty > current) {
        throw new Error(stockError(label, current, qty));
      }
    });
  }

  function addSale(productId, quantity, unitPrice) {
    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) throw new Error('Cantidad debe ser mayor a 0');

    return assertCanRemoveStock(productId, qty).then(() => {
      const item = {
        id: generateId(),
        productId,
        quantity: qty,
        unitPrice: parseFloat(unitPrice) || 0,
        timestamp: Date.now()
      };
      return put('sales', item).then(() => item);
    });
  }

  function deleteSale(id) {
    return getSales().then((sales) => {
      if (!sales.some((s) => s.id === id)) throw new Error('Venta no encontrada');
      return remove('sales', id);
    });
  }

  function updateSale(id, quantity, unitPrice) {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    if (qty <= 0) throw new Error('Cantidad debe ser mayor a 0');

    return getSales().then((sales) => {
      const existing = sales.find((s) => s.id === id);
      if (!existing) throw new Error('Venta no encontrada');

      const applyUpdate = () => put('sales', {
        ...existing,
        quantity: qty,
        unitPrice: price
      });

      const delta = qty - existing.quantity;
      if (delta <= 0) return applyUpdate();

      return getStockMap().then((stockMap) => {
        const available = (stockMap[existing.productId] ?? 0) + existing.quantity;
        if (qty > available) {
          return getProductLabel(existing.productId).then((label) => {
            throw new Error(stockError(label, available, qty));
          });
        }
        return applyUpdate();
      });
    });
  }

  function deleteAllSales() {
    return getSales().then((sales) => {
      if (!sales.length) return { deleted: 0 };
      return tx(['sales'], 'readwrite').then(({ stores }) => {
        const store = stores.sales;
        return Promise.all(sales.map((s) => promisifyRequest(store.delete(s.id)))).then(() => ({
          deleted: sales.length
        }));
      });
    });
  }

  function deleteSalesForDay(date) {
    return getSales().then((sales) => {
      const toDelete = sales.filter((s) => isSameDay(s.timestamp, date));
      if (!toDelete.length) return { deleted: 0 };
      return tx(['sales'], 'readwrite').then(({ stores }) => {
        const store = stores.sales;
        return Promise.all(toDelete.map((s) => promisifyRequest(store.delete(s.id)))).then(() => ({
          deleted: toDelete.length
        }));
      });
    });
  }

  // --- Movements ---

  function getMovements() {
    return getAll('movements');
  }

  function addMovement(productId, type, quantity, note, purchasePrice) {
    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) throw new Error('Cantidad debe ser mayor a 0');

    const save = () => {
      const item = {
        id: generateId(),
        productId,
        type,
        quantity: qty,
        note: (note || '').trim(),
        timestamp: Date.now()
      };
      if (type === 'in') {
        item.purchasePrice = parseFloat(purchasePrice) || 0;
      }
      return put('movements', item).then(() => item);
    };

    if (type === 'out') {
      return assertCanRemoveStock(productId, qty).then(save);
    }
    return save();
  }

  function addMovementsBulk(items) {
    const valid = items.filter((item) => (parseFloat(item.quantity) || 0) > 0);
    if (!valid.length) throw new Error('Agrega al menos una línea con cantidad');

    const exitTotals = {};
    valid.filter((item) => item.type === 'out').forEach((item) => {
      exitTotals[item.productId] = (exitTotals[item.productId] || 0) + (parseFloat(item.quantity) || 0);
    });

    const checks = Object.keys(exitTotals).map((productId) =>
      assertCanRemoveStock(productId, exitTotals[productId])
    );

    return Promise.all(checks).then(() => {
      const toSave = valid.map((item) => {
        const qty = parseFloat(item.quantity) || 0;
        const mov = {
          id: generateId(),
          productId: item.productId,
          type: item.type,
          quantity: qty,
          note: (item.note || '').trim(),
          timestamp: Date.now()
        };
        if (item.type === 'in') {
          mov.purchasePrice = parseFloat(item.purchasePrice) || 0;
        }
        return mov;
      });

      return tx(['movements'], 'readwrite').then(({ stores }) => {
        const store = stores.movements;
        return Promise.all(toSave.map((mov) => promisifyRequest(store.put(mov)))).then(() => ({
          saved: toSave.length
        }));
      });
    });
  }

  function deleteMovement(id) {
    return getMovements().then((movements) => {
      const mov = movements.find((m) => m.id === id);
      if (!mov) throw new Error('Movimiento no encontrado');

      if (mov.type === 'in') {
        return assertCanRemoveStock(mov.productId, mov.quantity).then(() => remove('movements', id));
      }
      return remove('movements', id);
    });
  }

  function updateMovement(id, quantity, note, purchasePrice) {
    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) throw new Error('Cantidad debe ser mayor a 0');

    return getMovements().then((movements) => {
      const existing = movements.find((m) => m.id === id);
      if (!existing) throw new Error('Movimiento no encontrado');

      const applyUpdate = () => {
        const updated = {
          ...existing,
          quantity: qty,
          note: (note || '').trim()
        };
        if (existing.type === 'in') {
          updated.purchasePrice = parseFloat(purchasePrice) || 0;
        }
        return put('movements', updated);
      };

      if (existing.type === 'out') {
        const delta = qty - existing.quantity;
        if (delta <= 0) return applyUpdate();
        return getStockMap().then((stockMap) => {
          const available = (stockMap[existing.productId] ?? 0) + existing.quantity;
          if (qty > available) {
            return getProductLabel(existing.productId).then((label) => {
              throw new Error(stockError(label, available, qty));
            });
          }
          return applyUpdate();
        });
      }

      const reduceBy = existing.quantity - qty;
      if (reduceBy <= 0) return applyUpdate();
      return assertCanRemoveStock(existing.productId, reduceBy).then(applyUpdate);
    });
  }

  // --- Helpers ---

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function isSameDay(ts, date) {
    return ts >= startOfDay(date) && ts <= endOfDay(date);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('es', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatMoney(amount) {
    const num = Math.round(parseFloat(amount) || 0);
    return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function getProductMap(categories, presentations, products) {
    const catMap = {};
    categories.forEach((c) => { catMap[c.id] = c; });

    const presMap = {};
    presentations.forEach((p) => { presMap[p.id] = p; });

    const productMap = {};
    products.forEach((prod) => {
      const pres = prod.presentationId ? presMap[prod.presentationId] : null;
      const catName = prod.categoryId ? (catMap[prod.categoryId]?.name || 'Sin categoría') : 'Sin categoría';
      const presName = prod.presentationId ? (pres?.name || 'Sin presentación') : 'Sin presentación';
      const prices = resolveProductPrices(prod, pres);
      productMap[prod.id] = {
        ...prod,
        ...prices,
        categoryName: catName,
        presentationName: presName,
        label: buildProductLabel(prod, catName, presName)
      };
    });

    return { catMap, presMap, productMap };
  }

  function getCatalogProducts(categories, presentations, products) {
    const { productMap } = getProductMap(categories, presentations, products);
    return products
      .map((p) => productMap[p.id])
      .filter(Boolean)
      .sort((a, b) => {
        const cat = a.categoryName.localeCompare(b.categoryName, 'es');
        return cat !== 0 ? cat : a.presentationName.localeCompare(b.presentationName, 'es');
      });
  }

  function calculateStock(productId, sales, movements) {
    const entries = movements
      .filter((m) => m.productId === productId && m.type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0);

    const exits = movements
      .filter((m) => m.productId === productId && m.type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0);

    const sold = sales
      .filter((s) => s.productId === productId)
      .reduce((sum, s) => sum + s.quantity, 0);

    return entries - exits - sold;
  }

  function getStockMap() {
    return Promise.all([getProducts(), getSales(), getMovements()]).then(
      ([products, sales, movements]) => {
        const map = {};
        products.forEach((p) => {
          map[p.id] = calculateStock(p.id, sales, movements);
        });
        return map;
      }
    );
  }

  function checkSalesStock(items) {
    return getStockMap().then((stockMap) => {
      const totals = {};

      items.forEach((item) => {
        if (!totals[item.productId]) {
          totals[item.productId] = {
            quantity: 0,
            name: item.name || 'Producto'
          };
        }
        totals[item.productId].quantity += item.quantity;
        if (item.name) totals[item.productId].name = item.name;
      });

      const issues = [];
      Object.keys(totals).forEach((productId) => {
        const stock = stockMap[productId] ?? 0;
        const requested = totals[productId].quantity;
        if (requested > stock) {
          issues.push({
            productId,
            name: totals[productId].name,
            stock,
            requested
          });
        }
      });

      return { ok: issues.length === 0, issues, stockMap };
    });
  }

  function groupByCategoryPresentation(items, productMap, valueFn) {
    const groups = {};

    items.forEach((item) => {
      const prod = productMap[item.productId];
      if (!prod) return;

      const catKey = prod.categoryName;
      const presKey = prod.presentationName;
      if (!groups[catKey]) groups[catKey] = {};
      if (!groups[catKey][presKey]) {
        groups[catKey][presKey] = { units: 0, value: 0, productId: prod.id };
      }

      const vals = valueFn(item);
      groups[catKey][presKey].units += vals.units;
      groups[catKey][presKey].value += vals.value;
    });

    return groups;
  }

  function buildSalesMargin(daySales, productMap) {
    const grouped = {};
    let totalMargin = 0;
    let totalCost = 0;

    daySales.forEach((sale) => {
      const prod = productMap[sale.productId];
      if (!prod) return;

      const unitCost = prod.purchasePrice || 0;
      const revenue = sale.quantity * sale.unitPrice;
      const cost = sale.quantity * unitCost;
      const margin = revenue - cost;
      totalMargin += margin;
      totalCost += cost;

      const catKey = prod.categoryName;
      const presKey = prod.presentationName;
      if (!grouped[catKey]) grouped[catKey] = {};
      if (!grouped[catKey][presKey]) {
        grouped[catKey][presKey] = { units: 0, revenue: 0, cost: 0, margin: 0 };
      }
      grouped[catKey][presKey].units += sale.quantity;
      grouped[catKey][presKey].revenue += revenue;
      grouped[catKey][presKey].cost += cost;
      grouped[catKey][presKey].margin += margin;
    });

    return { grouped, totalMargin, totalCost };
  }

  function getReportRangeData(from, to) {
    const fromTs = startOfDay(from);
    const toTs = endOfDay(to);
    return Promise.all([
      getCategories(),
      getPresentations(),
      getProducts(),
      getSales(),
      getMovements()
    ]).then(([categories, presentations, products, sales, movements]) => {
      const { productMap } = getProductMap(categories, presentations, products);
      const inRange = (ts) => ts >= fromTs && ts <= toTs;
      const rangeSales = sales.filter((s) => inRange(s.timestamp));
      const rangeMovements = movements.filter((m) => inRange(m.timestamp));
      return {
        productMap,
        sales: rangeSales,
        entries: rangeMovements.filter((m) => m.type === 'in'),
        exits: rangeMovements.filter((m) => m.type === 'out')
      };
    });
  }

  function getDailySummary(date) {
    return Promise.all([
      getCategories(),
      getPresentations(),
      getProducts(),
      getSales(),
      getMovements()
    ]).then(([categories, presentations, products, sales, movements]) => {
      const { productMap } = getProductMap(categories, presentations, products);

      const daySales = sales.filter((s) => isSameDay(s.timestamp, date));
      const dayMovements = movements.filter((m) => isSameDay(m.timestamp, date));

      const salesGrouped = groupByCategoryPresentation(daySales, productMap, (s) => ({
        units: s.quantity,
        value: s.quantity * s.unitPrice
      }));

      const entriesGrouped = groupByCategoryPresentation(
        dayMovements.filter((m) => m.type === 'in'),
        productMap,
        (m) => ({
          units: m.quantity,
          value: m.quantity * (m.purchasePrice || 0)
        })
      );

      const exitsGrouped = groupByCategoryPresentation(
        dayMovements.filter((m) => m.type === 'out'),
        productMap,
        (m) => ({ units: m.quantity, value: 0 })
      );

      const salesTotalUnits = daySales.reduce((s, i) => s + i.quantity, 0);
      const salesTotalMoney = daySales.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const entriesTotalUnits = dayMovements.filter((m) => m.type === 'in').reduce((s, m) => s + m.quantity, 0);
      const entriesTotalMoney = dayMovements
        .filter((m) => m.type === 'in')
        .reduce((s, m) => s + m.quantity * (m.purchasePrice || 0), 0);
      const exitsTotalUnits = dayMovements.filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0);
      const marginData = buildSalesMargin(daySales, productMap);
      const marginPercent = salesTotalMoney > 0
        ? Math.round((marginData.totalMargin / salesTotalMoney) * 100)
        : 0;

      return {
        date,
        sales: {
          items: daySales,
          grouped: salesGrouped,
          totalUnits: salesTotalUnits,
          totalMoney: salesTotalMoney
        },
        entries: {
          items: dayMovements.filter((m) => m.type === 'in'),
          grouped: entriesGrouped,
          totalUnits: entriesTotalUnits,
          totalMoney: entriesTotalMoney
        },
        exits: {
          items: dayMovements.filter((m) => m.type === 'out'),
          grouped: exitsGrouped,
          totalUnits: exitsTotalUnits
        },
        margin: {
          grouped: marginData.grouped,
          total: marginData.totalMargin,
          totalCost: marginData.totalCost,
          percent: marginPercent
        },
        productMap,
        categories,
        presentations,
        products
      };
    });
  }

  function getAllStock() {
    return Promise.all([
      getCategories(),
      getPresentations(),
      getProducts(),
      getSales(),
      getMovements()
    ]).then(([categories, presentations, products, sales, movements]) => {
      const lastActivity = {};
      sales.forEach((sale) => {
        if (!lastActivity[sale.productId] || sale.timestamp > lastActivity[sale.productId]) {
          lastActivity[sale.productId] = sale.timestamp;
        }
      });
      movements.forEach((mov) => {
        if (!lastActivity[mov.productId] || mov.timestamp > lastActivity[mov.productId]) {
          lastActivity[mov.productId] = mov.timestamp;
        }
      });

      const catalog = getCatalogProducts(categories, presentations, products);
      return catalog.map((item) => ({
        ...item,
        stock: calculateStock(item.id, sales, movements),
        lastActivityAt: lastActivity[item.id] || item.createdAt || 0
      }));
    });
  }

  function exportAllData() {
    return Promise.all([
      getCategories(),
      getPresentations(),
      getProducts(),
      getSales(),
      getMovements(),
      getImportMeta()
    ]).then(([categories, presentations, products, sales, movements, meta]) => ({
      schemaVersion: 1,
      app: 'ventas-app',
      exportedAt: new Date().toISOString(),
      meta: {
        importName: meta.importName,
        importedAt: meta.importedAt,
        setupComplete: meta.setupComplete
      },
      categories,
      presentations,
      products,
      sales,
      movements
    }));
  }

  const BACKUP_STORES = ['categories', 'presentations', 'products', 'sales', 'movements'];
  const IMPORT_META_ID = 'import';

  function defaultImportMetaRecord() {
    return {
      id: IMPORT_META_ID,
      importName: '',
      importedAt: null,
      setupComplete: false,
      updatedAt: Date.now()
    };
  }

  function normalizeImportMeta(record) {
    const importName = String(record?.importName || '').trim();
    const setupComplete = record?.setupComplete === true ||
      (!!importName && record?.setupComplete !== false);
    return {
      importName,
      importedAt: record?.importedAt || null,
      setupComplete
    };
  }

  function getImportMeta() {
    return tx(['meta'], 'readonly').then(({ stores }) =>
      promisifyRequest(stores.meta.get(IMPORT_META_ID))
    ).then((record) => normalizeImportMeta(record || defaultImportMetaRecord()));
  }

  function setImportMeta(partial) {
    return tx(['meta'], 'readwrite').then(({ stores }) =>
      promisifyRequest(stores.meta.get(IMPORT_META_ID))
    ).then((record) => {
      const current = record || defaultImportMetaRecord();
      const next = {
        id: IMPORT_META_ID,
        importName: partial.importName !== undefined
          ? String(partial.importName).trim()
          : String(current.importName || '').trim(),
        importedAt: partial.importedAt !== undefined ? partial.importedAt : current.importedAt,
        setupComplete: partial.setupComplete !== undefined
          ? !!partial.setupComplete
          : !!current.setupComplete,
        updatedAt: Date.now()
      };
      if (partial.importName !== undefined && next.importName) {
        next.setupComplete = true;
      }
      return put('meta', next).then(() => normalizeImportMeta(next));
    });
  }

  function buildImportMetaFromPayload(payload) {
    const meta = payload?.meta;
    return {
      id: IMPORT_META_ID,
      importName: String(meta?.importName || '').trim(),
      importedAt: meta?.importedAt || new Date().toISOString(),
      setupComplete: true,
      updatedAt: Date.now()
    };
  }

  function validateBackupItem(item, label) {
    if (!item || typeof item !== 'object' || !item.id) {
      throw new Error('Registro inválido en ' + label);
    }
  }

  function validateBackupPayload(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Archivo no válido');
    }
    BACKUP_STORES.forEach((key) => {
      if (!Array.isArray(data[key])) {
        throw new Error('Respaldo incompleto: falta «' + key + '»');
      }
      data[key].forEach((item) => validateBackupItem(item, key));
    });
    if (data.schemaVersion != null && data.schemaVersion > 1) {
      throw new Error('Respaldo de una versión más nueva de la app');
    }
    return data;
  }

  function importAllData(data) {
    const payload = validateBackupPayload(data);
    const importMeta = buildImportMetaFromPayload(payload);
    return open().then((database) => new Promise((resolve, reject) => {
      const storeNames = BACKUP_STORES.concat(['meta']);
      const transaction = database.transaction(storeNames, 'readwrite');
      transaction.oncomplete = () => resolve({
        categories: payload.categories.length,
        presentations: payload.presentations.length,
        products: payload.products.length,
        sales: payload.sales.length,
        movements: payload.movements.length,
        importName: importMeta.importName,
        importedAt: importMeta.importedAt
      });
      transaction.onerror = () => reject(transaction.error);

      BACKUP_STORES.forEach((name) => transaction.objectStore(name).clear());
      payload.categories.forEach((item) => transaction.objectStore('categories').put(item));
      payload.presentations.forEach((item) => transaction.objectStore('presentations').put(item));
      payload.products.forEach((item) => transaction.objectStore('products').put(item));
      payload.sales.forEach((item) => transaction.objectStore('sales').put(item));
      payload.movements.forEach((item) => transaction.objectStore('movements').put(item));
      transaction.objectStore('meta').put(importMeta);
    }));
  }

  function resetAllData() {
    return open().then((database) => new Promise((resolve, reject) => {
      const storeNames = BACKUP_STORES.concat(['meta']);
      const transaction = database.transaction(storeNames, 'readwrite');
      transaction.oncomplete = () => resolve({ importName: '', importedAt: null, setupComplete: false });
      transaction.onerror = () => reject(transaction.error);

      BACKUP_STORES.forEach((name) => transaction.objectStore(name).clear());
      transaction.objectStore('meta').put(defaultImportMetaRecord());
    }));
  }

  return {
    open,
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getPresentations,
    addPresentation,
    updatePresentation,
    deletePresentation,
    getProducts,
    addProduct,
    addProductsBulk,
    updateProduct,
    deleteProduct,
    getCatalogProducts,
    getSales,
    addSale,
    updateSale,
    deleteSale,
    deleteAllSales,
    deleteSalesForDay,
    getMovements,
    addMovement,
    addMovementsBulk,
    updateMovement,
    deleteMovement,
    getDailySummary,
    getReportRangeData,
    getAllStock,
    getStockMap,
    checkSalesStock,
    calculateStock,
    exportAllData,
    importAllData,
    resetAllData,
    getImportMeta,
    setImportMeta,
    getProductMap,
    resolveProductPrices,
    formatTime,
    formatDate,
    formatMoney,
    startOfDay,
    endOfDay,
    isSameDay
  };
})();
