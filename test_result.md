#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Marketplace Intelligence CRM (Guru / Призма). Task 2 — Market Scoring Engine.
  Four explainable scores per product (0..100 + level HIGH/MED/LOW + reasons[]):
    • Demand — does the market want this?
    • Competition — how crowded?
    • Risk — how dangerous?
    • Opportunity — combination + situational bonuses.
  Score history via score_snapshots (6h-bucket dedup). Category-level scoring.
  Opportunities feed with 4 sections: trending, emerging, stable winners, high risk.

backend:
  - task: "scoring rules + service"
    implemented: true
    working: true
    file: "/app/backend/services/scoring.py"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "compute_product_scores returns demand/competition/risk/opportunity each {score,level,reasons[]}; opportunity uses combination formula + floor checks; compute_category_scores aggregates per category with hot-bonus."
  - task: "scoring API endpoints"
    implemented: true
    working: true
    file: "/app/backend/services/scoring_api.py"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "GET /api/scoring/products/{key}, /scoring/products/{key}/history, /scoring/categories, /opportunities/{trending,risk,stable,emerging}. Watchlist/source filters."
  - task: "score_snapshots persistence on ingest"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "_record_score_snapshots called after _emit_market_signals. Idempotent per (product_key, 6h-bucket)."
  - task: "feed/products extended with scores"
    implemented: true
    working: true
    file: "/app/backend/services/intelligence_api.py"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Each item now carries demand/competition/risk/opportunity blocks + market_context."

frontend:
  - task: "ScoreChip / ScoreBlock / ScoreReasonsPopover"
    implemented: true
    working: true
    file: "/app/frontend/src/components/ScoreChip.jsx"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "data-testid=score-chip-{kind}-{level} on each chip. Reasons popover lists weighted contributions."
  - task: "/opportunities page (4 tabs + categories table)"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Opportunities.jsx"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tabs: Трендові, Нові та зростаючі, Стабільні лідери, Високий ризик. Categories table with 4 score badges per row. Source + watchlist toggles."
  - task: "Lifecycle table — Scores column + Why popover"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Lifecycle.jsx"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "New 'Scores' column with ScoreBlock + score-why button (data-testid=score-why-{key})."
  - task: "Dashboard — Top opportunities teaser"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/Dashboard.jsx"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "data-testid=top-opportunities-card with up to 5 items. Reflows on watchlist toggle."
  - task: "Layout nav — Можливості entry"
    implemented: true
    working: true
    file: "/app/frontend/src/components/Layout.jsx"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Sparkles icon, /opportunities route registered in App.js."

metadata:
  created_by: "main_agent"
  version: "0.6.0"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "GET /api/scoring/products/{key} returns demand+competition+risk+opportunity blocks with reasons[]"
    - "Opportunities endpoints return correctly filtered lists (trending/emerging/stable/risk)"
    - "Category scoring: categories with <3 products return level=unknown; categories with ≥3 products produce real scores"
    - "score_snapshots collection populates after each ingest, with proper dedup (6h bucket)"
    - "Watchlist toggle on /opportunities and /lifecycle and Dashboard reflows"
    - "Frontend: ScoreBlock chips render in Opportunities, Lifecycle, and Dashboard teaser"
    - "Frontend: 'чому?' popover on Opportunities + ? button on Lifecycle Scores cell shows reasons[]"
    - "Regression: /api/feed/products items now contain scores; /api/lifecycle/* still works; existing /api/analytics/* unchanged"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Task 2 done. Deterministic 4-score model wired in:
      Backend: 4 new endpoint groups (scoring/products, scoring/categories, opportunities/{trending,risk,stable,emerging}). score_snapshots collection + indexes added. Ingest path recomputes scores and stores 6h-bucket dedup'd snapshots.
      Frontend: /opportunities page with 4 tabs + categories scoring table. ScoreChip(s) added to /lifecycle, Dashboard, and Opportunities.
      Smoke test (curl) confirmed: iPhone score = demand 68 HIGH, competition 34 MED, risk 3 LOW, opportunity 70.2 HIGH. Categories returned Смартфони 74.1 HIGH; Ноутбуки = unknown (only 2 products → below CATEGORY_DEMAND_MIN_PRODUCTS=3).

      User stories to validate:
        US-A: Cat manager opens /opportunities → sees Trending tab default → 4 score chips per item, "чому?" expands reasons.
        US-B: Switches to Емерджентні tab → only new+growing products with demand≥med.
        US-C: Switches to Ризик → only items with risk≥med, sorted DESC by risk.
        US-D: Categories table sorts by opportunity DESC; categories <3 products show "—".
        US-E: Dashboard "Топ можливості" teaser shows up to 5 items with score chips.
        US-F: Lifecycle table now has Scores column with chips + ? popover.

      Auth: ingest endpoints still require X-Extension-Api-Key. Read endpoints open.
      Mocked APIs: NONE.
