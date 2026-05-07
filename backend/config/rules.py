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


# ---------- Task 2 — Market Scoring Engine ----------
#
# Four scores, all on a 0..100 scale, all explainable (reasons[]).
# Levels: HIGH (>=66), MED (33..66), LOW (<33). Strict thresholds in SCORE_LEVEL_*.
#
# Each weight tells "how many points a single piece of evidence contributes".
# Total per score is clipped at 100. Sum of weights does NOT need to equal 100 —
# we cap on output, so missing evidence reduces score, abundant evidence does not
# inflate beyond ceiling.

SCORE_LEVEL_HIGH: Final[float] = 66.0
SCORE_LEVEL_MED: Final[float] = 33.0


def score_level(value: float) -> str:
    """Map numeric score to HIGH/MED/LOW."""
    if value is None:
        return "unknown"
    if value >= SCORE_LEVEL_HIGH:
        return "high"
    if value >= SCORE_LEVEL_MED:
        return "med"
    return "low"


# --- Demand evidence weights ---
# "Does the market want this product?"
DEMAND_W_TOP_SALES_BADGE: Final[float] = 25.0
DEMAND_W_PROMO_BADGE: Final[float] = 8.0          # promo presence is weak demand signal
DEMAND_W_REVIEWS_HIGH: Final[float] = 18.0         # >= 100 reviews
DEMAND_W_REVIEWS_MID: Final[float] = 10.0          # 30..99 reviews
DEMAND_W_RATING_HIGH: Final[float] = 12.0          # >= 4.5
DEMAND_W_RATING_MID: Final[float] = 6.0            # 4.0..4.5
DEMAND_W_AVAILABILITY: Final[float] = 8.0          # in stock latched
DEMAND_W_GROWING_LIFECYCLE: Final[float] = 20.0    # lifecycle == growing
DEMAND_W_RECENT_PRICE_DROP: Final[float] = 5.0     # price drop in last window (signal of demand reaction)
DEMAND_W_LONG_TRACKED: Final[float] = 8.0          # >= 10 snapshots — popular enough to keep collecting

# Penalties on demand
DEMAND_P_OUT_OF_STOCK: Final[float] = 25.0
DEMAND_P_DECLINING_LIFECYCLE: Final[float] = 20.0
DEMAND_P_REMOVED: Final[float] = 60.0


# --- Competition evidence weights ---
# "How crowded is this market?"
COMPETITION_W_MANY_SELLERS_VHIGH: Final[float] = 30.0   # >= 8 sellers seen carrying product/category
COMPETITION_W_MANY_SELLERS_HIGH: Final[float] = 22.0    # 5..7
COMPETITION_W_MANY_SELLERS_MED: Final[float] = 10.0     # 3..4
COMPETITION_W_HIGH_DISCOUNT: Final[float] = 18.0        # discount_percent >= 15%
COMPETITION_W_MID_DISCOUNT: Final[float] = 8.0          # 5..15%
COMPETITION_W_PROMO_PRESSURE: Final[float] = 12.0       # >=2 promo signals in window for THIS product/category
COMPETITION_W_PRICE_VOLATILITY_HIGH: Final[float] = 15.0  # |price std/avg| > 10%
COMPETITION_W_PRICE_VOLATILITY_MED: Final[float] = 6.0    # 5..10%
COMPETITION_W_FREQUENT_DROPS: Final[float] = 10.0       # >=2 price_drop signals in window


# --- Risk evidence weights ---
# "How dangerous is it to enter / hold this product?"
RISK_W_DECLINING: Final[float] = 30.0
RISK_W_REMOVED: Final[float] = 60.0
RISK_W_OUT_OF_STOCK: Final[float] = 18.0
RISK_W_PRICE_WAR: Final[float] = 25.0                # price-volatility HIGH AND many sellers
RISK_W_AGGRESSIVE_DISCOUNTS: Final[float] = 20.0     # discount_percent >= 25%
RISK_W_FREQUENT_RISES: Final[float] = 8.0            # >=2 price_rise signals (could be inflation, supply issues)
RISK_W_LOW_RATING: Final[float] = 15.0               # rating < 4.0 with reviews >= 20
RISK_W_FEW_REVIEWS_NEW: Final[float] = 6.0           # new product, no reviews yet — uncertainty


# --- Opportunity composition ---
# Opportunity is a *combination*, not a sum. We compute it from the other three:
#   opportunity = clip(demand - competition*0.6 - risk*0.7, 0..100)
# But we ALSO require at least these floors to qualify as HIGH:
OPPORTUNITY_MIN_DEMAND_FOR_HIGH: Final[float] = 50.0
OPPORTUNITY_MAX_RISK_FOR_HIGH: Final[float] = 35.0
OPPORTUNITY_MAX_COMPETITION_FOR_HIGH: Final[float] = 55.0

# Bonus tags (additive, capped via clip)
OPPORTUNITY_W_FEW_SELLERS: Final[float] = 15.0       # <= 2 sellers in category
OPPORTUNITY_W_GROWING: Final[float] = 12.0
OPPORTUNITY_W_NEW_PRODUCT: Final[float] = 10.0
OPPORTUNITY_W_STABLE_PRICE: Final[float] = 6.0       # price std/avg < 2%


# --- Category-level scoring thresholds ---
CATEGORY_DEMAND_MIN_PRODUCTS: Final[int] = 3         # smaller categories cannot score reliably
CATEGORY_VOLATILITY_HIGH_PCT: Final[float] = 8.0     # std/avg of prices, %
CATEGORY_VOLATILITY_MED_PCT: Final[float] = 4.0
CATEGORY_HOT_NEW_PRODUCTS: Final[int] = 3            # >= N new products in 7d → "hot"


# --- Score snapshot dedup ---
SCORE_SNAPSHOT_DEDUP_HOURS: Final[int] = 6           # one snapshot per product per 6h window


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
