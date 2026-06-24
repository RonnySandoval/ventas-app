# Guía PWA — Ventas App

## Resumen del proyecto

| Elemento | Archivo | Rol |
|---|---|---|
| Entrada principal | `index.html` | Shell HTML, carga CSS/JS, registra SW |
| Estilos | `css/app.css` | UI completa |
| Lógica | `js/app.js`, `js/db.js`, `js/ui.js`, `js/export.js`, `js/icons.js` | Negocio + IndexedDB |
| Manifest | `manifest.json` | Metadatos de instalación |
| Service Worker | `service-worker.js` | Caché offline |
| Iconos | `icons/icon.svg`, `icon-192.png`, `icon-512.png` | Instalación y favicon |

**Datos offline:** IndexedDB (`VentasApp`) — no depende de red después de la primera carga.

---

## 1. Probar la PWA localmente (antes de publicar)

### Requisito: servidor HTTP local

El Service Worker **no funciona** con `file://`. Debes servir la carpeta por HTTP.

#### Opción A — Python (recomendada)

```bash
cd ventas-app
python -m http.server 8080
```

Abre: http://localhost:8080

#### Opción B — Node.js

```bash
npx --yes serve ventas-app -p 8080
```

#### Opción C — VS Code / Cursor

Extensión **Live Server** → "Open with Live Server" sobre `index.html`.

### Checklist de prueba offline

1. Abre la app en Chrome (http://localhost:8080).
2. DevTools → **Application** → **Service Workers**: debe aparecer `service-worker.js` activo.
3. DevTools → **Application** → **Manifest**: sin errores; iconos 192 y 512 visibles.
4. DevTools → **Application** → **Cache Storage** → `ventas-app-v26`: deben listarse todos los assets.
5. Navega por **Inicio, Venta, Stock, Catálogo, Reportes** con red activa.
6. DevTools → **Network** → marca **Offline**.
7. Recarga la página (F5): la app debe cargar y funcionar (crear ventas, consultar stock, etc.).
8. Desactiva offline y recarga: sigue funcionando con datos en IndexedDB.

### Probar actualización de caché

1. En `service-worker.js`, incrementa `CACHE_VERSION` (ej. `'27'`).
2. Recarga la app dos veces (o cierra pestaña y abre de nuevo).
3. En Cache Storage debe aparecer la nueva versión y desaparecer la anterior.

### Lighthouse (opcional)

DevTools → **Lighthouse** → categoría **Progressive Web App** → Generate report.  
Objetivo: PWA installable + offline.

---

## 2. Desplegar en GitHub Pages

### Paso 1 — Repositorio

```bash
cd ventas-app
git init
git add .
git commit -m "PWA Ventas App"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### Paso 2 — Activar GitHub Pages

1. GitHub → tu repo → **Settings** → **Pages**.
2. **Source:** Deploy from a branch.
3. **Branch:** `main` → carpeta **`/ (root)`** (si el repo es solo la app).
4. Guardar. La URL será: `https://TU_USUARIO.github.io/TU_REPO/`

### Paso 3 — Verificar rutas

La app usa rutas **relativas** (`./js/...`, `./service-worker.js`). Funciona en subcarpetas de GitHub Pages sin cambios.

El archivo `.nojekyll` evita que Jekyll ignore archivos que empiezan con `_`.

### Paso 4 — Probar en producción

1. Abre la URL de GitHub Pages en el móvil o PC.
2. Repite el checklist offline (con DevTools en desktop o modo avión en móvil).
3. Instala la app (ver sección 3).

### Publicar actualizaciones

1. Sube cambios a `main`.
2. Incrementa `CACHE_VERSION` en `service-worker.js`.
3. Los usuarios recibirán la nueva caché al recargar (puede requerir segunda recarga).

---

## 3. Instalar la aplicación

### Android — Chrome

1. Abre la URL (GitHub Pages o tu servidor) en **Chrome**.
2. Menú **⋮** → **Instalar aplicación** o **Añadir a pantalla de inicio**.
3. También puede aparecer un banner "Instalar app" en la barra inferior.
4. Confirma. El icono queda en el launcher como app independiente.

**Requisitos:** HTTPS (GitHub Pages lo provee), manifest válido, SW registrado, iconos 192+512.

### Windows — Chrome / Edge

1. Abre la URL en **Chrome** o **Edge**.
2. Barra de direcciones → icono **Instalar** (⊕ o monitor con flecha).
3. O menú → **Instalar Ventas…**
4. La app se abre en ventana propia (sin barra del navegador).

### iOS — Safari (limitaciones)

- "Añadir a pantalla de inicio" funciona, pero iOS tiene soporte PWA parcial.
- IndexedDB y offline suelen funcionar; notificaciones push limitadas.
- Usa **Safari** → Compartir → **Añadir a inicio**.

---

## 4. Iconos requeridos

| Archivo | Tamaño | Uso |
|---|---|---|
| `icons/icon-192.png` | 192×192 | Android, favicon, Apple touch |
| `icons/icon-512.png` | 512×512 | Splash, instalación, maskable |
| `icons/icon.svg` | vectorial | Navegadores modernos, favicon SVG |

Para regenerar PNG desde SVG: exporta desde Figma/Inkscape o usa https://realfavicongenerator.net/

---

## 5. Incompatibilidades conocidas y soluciones

| Problema | Solución |
|---|---|
| Abrir `index.html` directo (file://) | Usar servidor local o GitHub Pages |
| SW no se registra | Solo HTTP/HTTPS; revisar consola |
| Datos no sincronizan entre dispositivos | Por diseño: IndexedDB es local; usar export JSON |
| Caché antigua tras deploy | Incrementar `CACHE_VERSION` en `service-worker.js` |
| iOS borra datos si no se usa la app | Comportamiento del sistema; exportar respaldos periódicos |

---

## 6. Mantenimiento del Service Worker

Al modificar **cualquier** asset estático (`*.js`, `*.css`, `index.html`, iconos):

1. Añade el archivo a `PRECACHE_ASSETS` en `service-worker.js` si es nuevo.
2. Incrementa `CACHE_VERSION`.
3. Despliega y prueba offline.

**No modifiques** `CACHE_VERSION` si solo cambias lógica que ya está en archivos precacheados sin bump — los usuarios podrían ver versión antigua hasta bump de versión.
