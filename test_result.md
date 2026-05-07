#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Marketplace Intelligence CRM (Guru / Призма) for Rozetka & Epicentr.
  Task 1 — Foundation Analytics Layer:
   - config/rules.py with documented thresholds
   - Watchlist (Tracked Categories) CRUD + UI
   - Lifecycle Engine (new, active, out_of_stock, removed, returned, declining, growing)
   - Market Signals Engine (price_drop, price_rise, new_product, returned_product,
     stock_out, back_in_stock, promo_detected, top_sales_detected)
   - Market Overview v2 (new vs removed, market heat, seller pressure, promo activity)
   - Product Feed Intelligence (lifecycle + signals + reasons "Why")

backend:
  - task: "config/rules.py — thresholds with docs"
    implemented: true
    working: true
    file: "/app/backend/config/rules.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Sane defaults baked in: NEW_PRODUCT_DAYS=7, REMOVED_AFTER_DAYS=14, PRICE_DROP_PCT=5.0, etc."
  - task: "Watchlist CRUD"
    implemented: true
    working: true
    file: "/app/backend/services/intelligence_api.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "GET/POST/PATCH/DELETE /api/watchlist + GET /api/watchlist/categories (auto-discovery from observed products). Smoke-tested via curl."
  - task: "Lifecycle Engine"
    implemented: true
    working: true
    file: "/app/backend/services/lifecycle.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "compute_lifecycle() — derives status + reasons from snapshot history. /api/lifecycle/summary, /lifecycle/feed, /lifecycle/products/{key}. Smoke test confirms new/out_of_stock buckets."
  - task: "Market Signals Engine"
    implemented: true
    working: true
    file: "/app/backend/services/signals.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "build_signals_for_ingest() emits new_product, returned_product, promo/top_sales, price_drop/rise, stock_out/back_in_stock. Idempotent via dedup_key (kind+pk+day). Persisted on every ingest. /api/signals + /api/signals/summary."
  - task: "Market Overview v2 endpoints"
    implemented: true
    working: true
    file: "/app/backend/services/intelligence_api.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "/api/market/overview, /market/heat, /market/seller-pressure, /market/promo. Honor watchlist_only and source filters. Smoke-tested with seed data → returned correct counts."
  - task: "Product Feed Intelligence (joined)"
    implemented: true
    working: true
    file: "/app/backend/services/intelligence_api.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "/api/feed/products joins lifecycle + last 7 days signals per product. Filterable by lifecycle, signal_kind, watchlist."
  - task: "Backfill /api/admin/backfill"
    implemented: true
    working: true
    file: "/app/backend/services/intelligence_api.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Recomputes first/last_seen on products from price_snapshots; emits NEW_PRODUCT signal for any historical product missing it."
  - task: "Ingest path emits signals + lifecycle dates"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "POST /api/ingest/product and /products now call _stamp_lifecycle_dates and _emit_market_signals after _record_price_snapshots. Existing tests for /summary, /price-changes, /export remain intact."

frontend:
  - task: "/watchlist page"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Watchlist.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Add by name + source filter. Active list with toggle/priority/delete. Discovered categories from observed products. data-testid wired for all interactions."
  - task: "Dashboard v2 — Market Health blocks + watchlist toggle"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Dashboard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Added Market Health 7d KPIs strip (new/returned/removed/stock_outs/promo/drops), Lifecycle distribution card, Market Heat card, Seller Pressure table. dashboard-watchlist-toggle filters all of them. Existing dataloop/distribution/sellers blocks unchanged."
  - task: "/lifecycle page (Product Feed)"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Lifecycle.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Table with Lifecycle chip, Signal chips, Why? popover (reasons + first_seen + snapshots), price delta arrow, source/category, history modal. Filters: lifecycle bucket, source, watchlist toggle, search."
  - task: "/signals page"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Signals.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Summary by kind + filter pills + sinceHours window selector + watchlist toggle. List with image/title/detail/seller/category. Auto-refresh 30s. data-testid wired."
  - task: "Layout nav extended (Watchlist / Lifecycle / Signals)"
    implemented: true
    working: true
    file: "/app/frontend/src/components/Layout.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Removed 'Розширення' from main nav (still in /install via header CTA), added Watchlist / Lifecycle / Сигнали."

metadata:
  created_by: "main_agent"
  version: "0.5.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Watchlist CRUD (POST/PATCH/DELETE/list/categories)"
    - "Ingest emits signals + lifecycle"
    - "Lifecycle summary/feed correctness with watchlist filter"
    - "Signals filter by kind/window/watchlist"
    - "Market Overview v2 + Heat + Pressure aggregations"
    - "Product Feed Intelligence joined response"
    - "Frontend: /watchlist add+toggle+delete, dashboard v2 with watchlist toggle, /lifecycle Why? popover, /signals filters"
    - "Existing endpoints regression: /api/products, /analytics/summary, /export/products.csv"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Task 1 (Foundation Analytics Layer) implemented and smoke-tested via curl + manual screenshots.
      Backend: 12 new endpoints across 3 modules (config/rules.py, services/lifecycle.py, services/signals.py, services/intelligence_api.py).
      Ingest path now stamps first_seen_at/last_seen_at on products and emits market_signals (idempotent via dedup_key).
      Frontend: 3 new pages (Watchlist, Lifecycle, Signals) + Dashboard v2 blocks (Market Health, Lifecycle distribution, Heat, Pressure) + watchlist toggle.

      User stories (from product spec) to validate end-to-end:
        US-1 PM Аналітик: opens Огляд → sees Market Health 7d, Lifecycle distribution, Heat, Pressure → toggles "Watchlist" → numbers reflect only tracked categories.
        US-2 Маркетолог: opens Сигнали → filters by "Реклама" → sees promo signals only; switches window to 7 днів.
        US-3 Категорийник: opens Watchlist → adds "Смартфони" (rozetka) → goes to Lifecycle → toggles "Тільки watchlist" → only smartphone-tracked products in feed.
        US-4 Decision foundation: opens /lifecycle → clicks Why? on a row → sees reasons (e.g., "Вперше зафіксовано 2.1 дн. тому") + first_seen + snapshots.

      Auth: ingest endpoints require X-Extension-Api-Key=prizma_dev_key_2026 (already in /app/backend/.env). Read endpoints are open (MVP design).

      Mocked APIs: NONE.
