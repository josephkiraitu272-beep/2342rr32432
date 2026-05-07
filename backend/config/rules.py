"""
Guru Marketplace Intelligence — deterministic analytics rules.

All thresholds and weights live here so the analytics engine remains:
  - explainable (every signal carries a reason)
  - auditable (open the file, see the threshold)
  - opinionated (sane defaults baked in, no UI knobs to misconfigure)
  - cheap to evolve (one place to tune)

Nothing here uses AI / ML. Pure rules over snapshot history.
"""
from typing import Final


# ---------- Lifecycle thresholds ----------

# A product is considered "new" if its first_seen_at is within this window.
NEW_PRODUCT_DAYS: Final[int] = 7

# A product is considered "removed" if it has not been re-captured for this many days.
REMOVED_AFTER_DAYS: Final[int] = 14

# A previously-removed product becomes "returned" if seen again after this gap.
RETURNED_GAP_DAYS: Final[int] = 7

# Out-of-stock latch: latest snapshot has availability=False.
# (No threshold needed — single boolean signal.)

# A product is considered "declining" if the price dropped >= this % within DECLINING_WINDOW_DAYS.
DECLINING_PCT: Final[float] = 8.0
DECLINING_WINDOW_DAYS: Final[int] = 14

# A product is considered "growing" if reviews_count grew by >= this absolute amount
# within GROWING_WINDOW_DAYS, OR the price rose >= GROWING_PRICE_PCT.
GROWING_REVIEWS_DELTA: Final[int] = 10
GROWING_PRICE_PCT: Final[float] = 5.0
GROWING_WINDOW_DAYS: Final[int] = 14


# ---------- Market signal thresholds ----------

# Price-drop signal fires when latest snapshot is >= this % below the earliest in the
# rolling window. Mirrors /api/analytics/price-signals defaults.
PRICE_DROP_PCT: Final[float] = 5.0
PRICE_RISE_PCT: Final[float] = 5.0
PRICE_SIGNAL_WINDOW_HOURS: Final[int] = 24

# Promo / top-sales badge detection — the badge keys emitted by the extension adapters.
PROMO_BADGE_KEYS: Final[tuple[str, ...]] = ("promo", "ad")
TOP_SALES_BADGE_KEYS: Final[tuple[str, ...]] = ("top_sales", "rozetka_choice")

# Seller "price attack" — a seller has the lowest price in a category by at least this %
# vs the median for that category.
SELLER_ATTACK_VS_MEDIAN_PCT: Final[float] = 8.0
# ...and at least this many sellers must be present for the rule to apply.
SELLER_ATTACK_MIN_COMPETITORS: Final[int] = 3


# ---------- Competition / category thresholds ----------

# Number of distinct sellers carrying a product to flag it as "high competition".
HIGH_COMPETITION_SELLERS: Final[int] = 5

# Category is "hot" if relative growth of new products vs prior period exceeds this.
CATEGORY_HEAT_GROWTH_PCT: Final[float] = 20.0
# Minimum category size to be considered (avoid noise on tiny niches).
CATEGORY_MIN_PRODUCTS: Final[int] = 5


# ---------- Demand-score weights (used in Task 2; kept here for cohesion) ----------

DEMAND_REVIEWS_GROWTH_WEIGHT: Final[float] = 20.0
DEMAND_RATING_WEIGHT: Final[float] = 10.0
DEMAND_TOP_BADGE_WEIGHT: Final[float] = 25.0
DEMAND_PROMO_WEIGHT: Final[float] = 15.0
DEMAND_AVAILABILITY_WEIGHT: Final[float] = 10.0
DEMAND_POSITION_WEIGHT: Final[float] = 10.0
DEMAND_SELLER_COMPETITION_WEIGHT: Final[float] = 10.0


# ---------- Signal kinds (canonical) ----------

SIGNAL_NEW_PRODUCT = "new_product"
SIGNAL_REMOVED_PRODUCT = "removed_product"
SIGNAL_RETURNED_PRODUCT = "returned_product"
SIGNAL_PROMO_DETECTED = "promo_detected"
SIGNAL_TOP_SALES_DETECTED = "top_sales_detected"
SIGNAL_PRICE_DROP = "price_drop"
SIGNAL_PRICE_RISE = "price_rise"
SIGNAL_STOCK_OUT = "stock_out"
SIGNAL_BACK_IN_STOCK = "back_in_stock"
SIGNAL_SELLER_ATTACK = "seller_attack"

SIGNAL_LEVELS = {
    SIGNAL_NEW_PRODUCT: "info",
    SIGNAL_REMOVED_PRODUCT: "warn",
    SIGNAL_RETURNED_PRODUCT: "good",
    SIGNAL_PROMO_DETECTED: "info",
    SIGNAL_TOP_SALES_DETECTED: "good",
    SIGNAL_PRICE_DROP: "good",
    SIGNAL_PRICE_RISE: "warn",
    SIGNAL_STOCK_OUT: "warn",
    SIGNAL_BACK_IN_STOCK: "good",
    SIGNAL_SELLER_ATTACK: "warn",
}

SIGNAL_TITLES_UA = {
    SIGNAL_NEW_PRODUCT: "Новинка на ринку",
    SIGNAL_REMOVED_PRODUCT: "Зник з видачі",
    SIGNAL_RETURNED_PRODUCT: "Повернувся у продаж",
    SIGNAL_PROMO_DETECTED: "Реклама / акція",
    SIGNAL_TOP_SALES_DETECTED: "Топ продажів",
    SIGNAL_PRICE_DROP: "Падіння ціни",
    SIGNAL_PRICE_RISE: "Ріст ціни",
    SIGNAL_STOCK_OUT: "Закінчився",
    SIGNAL_BACK_IN_STOCK: "Знову в наявності",
    SIGNAL_SELLER_ATTACK: "Цінова атака",
}

LIFECYCLE_NEW = "new"
LIFECYCLE_ACTIVE = "active"
LIFECYCLE_OUT_OF_STOCK = "out_of_stock"
LIFECYCLE_REMOVED = "removed"
LIFECYCLE_RETURNED = "returned"
LIFECYCLE_DECLINING = "declining"
LIFECYCLE_GROWING = "growing"

LIFECYCLE_LABELS_UA = {
    LIFECYCLE_NEW: "Новинка",
    LIFECYCLE_ACTIVE: "Активний",
    LIFECYCLE_OUT_OF_STOCK: "Немає в наявності",
    LIFECYCLE_REMOVED: "Знятий",
    LIFECYCLE_RETURNED: "Повернувся",
    LIFECYCLE_DECLINING: "Згасає",
    LIFECYCLE_GROWING: "Зростає",
}
