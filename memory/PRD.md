# Призма (Prizma) — PRD

## Original problem statement
Build a single MVP that audits and parses Rozetka.com.ua and Epicentrk.ua product cards. Architecture: **Chrome Extension MV3 + Backend ingest API + Dashboard / Landing UI**. Extension works on both marketplaces (DOM parsing, XHR/fetch interception, page overlay). Backend stores normalized data. Dashboard shows: Можливості, Зведення по сторінці, Лідери продажів, Продавці/конкуренти, Ціни, Історія збору. No login (MVP). LLM not connected. Brand: Призма. UI in Ukrainian.

## Audit findings (delivered before build)
- **Rozetka**: full Cloudflare Managed Challenge on every endpoint (sitemap, RSS, xl-catalog-api, common-api). Only browser-based extraction works → Chrome Extension is the right strategy.
- **Epicentr**: only Cloudflare CDN (no challenge). Direct GET returns 200. Carries `dataLayer.push({pageType: ProductPage, productId, productName, productPrice, vendorId, vendorName, categoryId, categoryName, productAvailable})` and full `window.__NUXT__` SSR state. Public sitemap with ~600K product URLs. Server-side scraping fully feasible (deferred from MVP).

## Architecture
```
[Chrome Extension MV3]                 [Backend FastAPI + MongoDB]                 [React Dashboard]
  - popup.html/js/css                    POST /api/ingest/product                    /            Landing
  - background.js (SW)                   POST /api/ingest/products                   /dashboard   Огляд
  - content/common.js                    POST /api/ingest/page                       /products    Каталог
  - content/overlay.js + .css            POST /api/ingest/cf-session                 /sellers     Продавці
  - content/rozetka.js                   GET  /api/products                          /history     Історія
  - content/epicentr.js                  GET  /api/analytics/summary                 /install     Розширення
  - manifest.json (host perms for both)  GET  /api/analytics/top-sellers
  - icons/                               GET  /api/analytics/source-distribution
                                         GET  /api/pages
                                         GET  /api/extension/health
```
Auth: `X-Extension-Api-Key` header (env `EXTENSION_API_KEY=prizma_dev_key_2026`).

## What's implemented (2026-05-07)
- ✅ Backend FastAPI with all 11 endpoints, auth dependency, Pydantic models, MongoDB serialization
- ✅ Backend env: `EXTENSION_API_KEY` added
- ✅ React Landing page with hero, 6-card "Можливості" grid, 3-step "Як це працює", footer CTA
- ✅ React Dashboard with metrics, donut chart (Recharts), top-sellers list, recent pages
- ✅ React Products page with source filter (Rozetka/Epicentr) + search + table
- ✅ React Sellers page (ranked colored list)
- ✅ React History page (timeline)
- ✅ React Install page (3-step guide + Backend URL/API key card + .zip download link)
- ✅ Layout with sticky header + nav (Огляд / Товари / Продавці / Історія / Розширення)
- ✅ Plus Jakarta Sans + JetBrains Mono fonts
- ✅ Chrome Extension MV3:
   - manifest.json with both rozetka.com.ua + epicentrk.ua host permissions
   - background.js service worker with chrome.storage.local config + ingest forwarding + cf cookie reader
   - popup.html/js/css (320×500): connection status, current page detection, "Зібрати дані" CTA, daily/total counters, settings (backend URL + API key), dashboard link
   - content/common.js helpers (price parsing, stats, ingest senders)
   - content/overlay.js + overlay.css: floating panel with brand, distribution bar+legend, capture button
   - content/rozetka.js: catalog tile parser, product page parser, badge detection (top_sales/ad/promo/rozetka_choice), inline #N badges
   - content/epicentr.js: dataLayer extraction, OG meta, breadcrumb path, tile parser
   - icons (16/48/128 PNG)
- ✅ Build script generated `prizma-extension.zip` and placed at `/app/frontend/public/prizma-extension.zip` (downloadable from Install page)
- ✅ Backend tests: 27/27 passed (auth, ingest, analytics, CORS, MongoDB serialization, discount calc)

## User personas
- **PM/Аналітик** интернет-магазина — следит за ассортиментом конкурентов на Rozetka/Epicentr, хочет видеть тренды по нишам без ручного «листания».
- **Маркетолог** — анализирует, кто из продавцов агрессивнее всех в рекламе и на каких позициях, чтобы корректировать собственный ассортимент и цены.
- **Категорийник** — сравнивает цены и наличие в категории на двух маркетплейсах.

## Backlog (P0 → P2)
**P0 (next)**
- Server-side Epicentr crawler (sitemap → products) воркер. Поскольку Epicentr без CF, можем получить десятки тысяч карточек без браузера.
- Rozetka «реплеер»: использует cf_clearance из расширения и `curl_cffi`-импersonation, чтобы массово ходить в xl-catalog-api в JSON.
- Экспорт в CSV/XLSX из дашборда.

**P1**
- LLM-нормализация/категоризация (Claude Sonnet 4.5 / GPT-5.2) — мэтчинг категорий Rozetka↔Epicentr, авто-теги.
- История цен на товар (price-tracking timeline) с алертами (цена упала/вернулась).
- Авторизация (Emergent Google Auth) + многопользовательский режим (несколько workspace).
- Цветовые маркеры продавцов (UI-настройка), как на скриншоте «Продавці під вашим кольором».

**P2**
- Алерты в Telegram/Slack на изменение топа продаж в категории.
- Биллинг (Stripe), тарифы Free/Pro/Team.
- Автозапуск collection: фоновый planner ходит по сохранённым категориям пользователя.
- Сравнение позиций своего товара с топом конкурентов.

## Known limitations (MVP)
- Rozetka работает только пока пользователь активно открывает её в Chrome с расширением (по дизайну).
- Расширение собирает только то, что отрендерилось на странице; пагинация требует ручного листания.
- Нет авторизации — данные общие для всех клиентов с правильным API key.
- Backend `EXTENSION_API_KEY` имеет дефолтное значение (для dev). В проде нужно убрать fallback.

## Tech debt (from test report)
- Pydantic `ProductOut.captured_at: datetime` vs persisted ISO string — добавить нормализацию при чтении.
- Добавить MongoDB indexes (`source`, `captured_at`, `seller`, text-index по `title`) перед масштабированием.
- `insert_many(ordered=False)` для устойчивости батчей.
- Более точный буккет «Rozetka власні» (флаг marketplace вместо seller-эвристики).
