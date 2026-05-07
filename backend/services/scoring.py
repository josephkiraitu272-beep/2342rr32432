"""
Market Scoring Engine (Task 2) — deterministic, explainable.

Four scores per product, each on 0..100 + level (HIGH/MED/LOW) + reasons[]:
  • demand_score        — does the market want this?
  • competition_score   — how crowded is this market?
  • risk_score          — how dangerous to enter/hold?
  • opportunity_score   — composition of the above + bonuses.

Scoring is computed on demand from:
  • latest product doc        (badges, rating, reviews_count, price, availability)
  • full price history        (snapshot count, std/avg, drops/rises)
  • lifecycle status          (new/growing/declining/removed/out_of_stock)
  • recent signals (≤7 days)  (price_drop x N, promo x N, etc.)
  • market context            (sellers carrying same product / category)

NO AI. Pure rules. Every point added has a reason recorded.
"""
from __future__ import annotations

import math
import statistics
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from config import rules as R


def _clip(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _add(reasons: List[Dict[str, Any]], code: str, label: str, weight: float) -> None:
    reasons.append({"code": code, "label": label, "weight": round(weight, 1)})


# ---------- Aggregate market context ----------

def market_context_for(latest: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute volatility / std / sellers count from snapshot history."""
    prices = [h["price"] for h in history if h.get("price") is not None]
    sellers = {h.get("seller") for h in history if h.get("seller")}
    avg = statistics.fmean(prices) if prices else None
    std = statistics.pstdev(prices) if len(prices) >= 2 else 0.0
    volatility_pct = (std / avg * 100.0) if (avg and avg > 0) else 0.0
    return {
        "snapshots": len(history),
        "sellers_count": len(sellers),
        "avg_price": avg,
        "std_price": std,
        "volatility_pct": round(volatility_pct, 2),
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
    }


def _signals_window(signals: List[Dict[str, Any]], days: int = 7) -> List[Dict[str, Any]]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    return [s for s in signals if (s.get("captured_at") or "") >= cutoff]


# ---------- DEMAND ----------

def compute_demand(
    latest: Dict[str, Any],
    history: List[Dict[str, Any]],
    lifecycle_status: str,
    signals: List[Dict[str, Any]],
) -> Dict[str, Any]:
    score = 0.0
    reasons: List[Dict[str, Any]] = []
    badges = latest.get("badges") or []
    reviews = latest.get("reviews_count") or 0
    rating = latest.get("rating") or 0
    snaps = len(history)

    if any(b in R.TOP_SALES_BADGE_KEYS for b in badges):
        score += R.DEMAND_W_TOP_SALES_BADGE
        _add(reasons, "top_sales_badge", "Бадж «топ продажів»", R.DEMAND_W_TOP_SALES_BADGE)
    if any(b in R.PROMO_BADGE_KEYS for b in badges):
        score += R.DEMAND_W_PROMO_BADGE
        _add(reasons, "promo_badge", "Бадж «реклама / акція»", R.DEMAND_W_PROMO_BADGE)
    if reviews >= 100:
        score += R.DEMAND_W_REVIEWS_HIGH
        _add(reasons, "reviews_high", f"Багато відгуків ({reviews})", R.DEMAND_W_REVIEWS_HIGH)
    elif reviews >= 30:
        score += R.DEMAND_W_REVIEWS_MID
        _add(reasons, "reviews_mid", f"Відгуки ({reviews})", R.DEMAND_W_REVIEWS_MID)
    if rating and rating >= 4.5:
        score += R.DEMAND_W_RATING_HIGH
        _add(reasons, "rating_high", f"Рейтинг {rating}", R.DEMAND_W_RATING_HIGH)
    elif rating and rating >= 4.0:
        score += R.DEMAND_W_RATING_MID
        _add(reasons, "rating_mid", f"Рейтинг {rating}", R.DEMAND_W_RATING_MID)
    if latest.get("availability") is True:
        score += R.DEMAND_W_AVAILABILITY
        _add(reasons, "in_stock", "Товар в наявності", R.DEMAND_W_AVAILABILITY)
    if lifecycle_status == R.LIFECYCLE_GROWING:
        score += R.DEMAND_W_GROWING_LIFECYCLE
        _add(reasons, "growing", "Lifecycle: зростає", R.DEMAND_W_GROWING_LIFECYCLE)
    if snaps >= 10:
        score += R.DEMAND_W_LONG_TRACKED
        _add(reasons, "long_tracked", f"Активно відстежується ({snaps} знімків)", R.DEMAND_W_LONG_TRACKED)

    sigs7 = _signals_window(signals)
    if any(s["kind"] == R.SIGNAL_PRICE_DROP for s in sigs7):
        score += R.DEMAND_W_RECENT_PRICE_DROP
        _add(reasons, "price_drop_recent", "Недавнє падіння ціни", R.DEMAND_W_RECENT_PRICE_DROP)

    # Penalties
    if lifecycle_status == R.LIFECYCLE_OUT_OF_STOCK:
        score -= R.DEMAND_P_OUT_OF_STOCK
        _add(reasons, "oos_penalty", "Немає в наявності", -R.DEMAND_P_OUT_OF_STOCK)
    if lifecycle_status == R.LIFECYCLE_DECLINING:
        score -= R.DEMAND_P_DECLINING_LIFECYCLE
        _add(reasons, "declining", "Lifecycle: згасає", -R.DEMAND_P_DECLINING_LIFECYCLE)
    if lifecycle_status == R.LIFECYCLE_REMOVED:
        score -= R.DEMAND_P_REMOVED
        _add(reasons, "removed", "Знятий з продажу", -R.DEMAND_P_REMOVED)

    final = _clip(score)
    return {"score": round(final, 1), "level": R.score_level(final), "reasons": reasons}


# ---------- COMPETITION ----------

def compute_competition(
    latest: Dict[str, Any],
    history: List[Dict[str, Any]],
    market_ctx: Dict[str, Any],
    signals: List[Dict[str, Any]],
    same_category_sellers: int = 0,
) -> Dict[str, Any]:
    score = 0.0
    reasons: List[Dict[str, Any]] = []
    sellers = max(market_ctx.get("sellers_count", 0), same_category_sellers)
    discount = latest.get("discount_percent") or 0
    vol = market_ctx.get("volatility_pct") or 0

    if sellers >= 8:
        score += R.COMPETITION_W_MANY_SELLERS_VHIGH
        _add(reasons, "sellers_vhigh", f"Дуже багато продавців ({sellers})", R.COMPETITION_W_MANY_SELLERS_VHIGH)
    elif sellers >= 5:
        score += R.COMPETITION_W_MANY_SELLERS_HIGH
        _add(reasons, "sellers_high", f"Багато продавців ({sellers})", R.COMPETITION_W_MANY_SELLERS_HIGH)
    elif sellers >= 3:
        score += R.COMPETITION_W_MANY_SELLERS_MED
        _add(reasons, "sellers_med", f"{sellers} продавців", R.COMPETITION_W_MANY_SELLERS_MED)

    if discount >= 15:
        score += R.COMPETITION_W_HIGH_DISCOUNT
        _add(reasons, "discount_high", f"Висока знижка −{round(discount)}%", R.COMPETITION_W_HIGH_DISCOUNT)
    elif discount >= 5:
        score += R.COMPETITION_W_MID_DISCOUNT
        _add(reasons, "discount_mid", f"Знижка −{round(discount)}%", R.COMPETITION_W_MID_DISCOUNT)

    sigs7 = _signals_window(signals)
    promo_count = sum(1 for s in sigs7 if s["kind"] == R.SIGNAL_PROMO_DETECTED)
    drop_count = sum(1 for s in sigs7 if s["kind"] == R.SIGNAL_PRICE_DROP)
    if promo_count >= 2:
        score += R.COMPETITION_W_PROMO_PRESSURE
        _add(reasons, "promo_pressure", f"{promo_count} промо за 7 днів", R.COMPETITION_W_PROMO_PRESSURE)
    if drop_count >= 2:
        score += R.COMPETITION_W_FREQUENT_DROPS
        _add(reasons, "frequent_drops", f"{drop_count} падінь ціни", R.COMPETITION_W_FREQUENT_DROPS)

    if vol >= 10:
        score += R.COMPETITION_W_PRICE_VOLATILITY_HIGH
        _add(reasons, "volatility_high", f"Висока волатильність ціни ({vol}%)", R.COMPETITION_W_PRICE_VOLATILITY_HIGH)
    elif vol >= 5:
        score += R.COMPETITION_W_PRICE_VOLATILITY_MED
        _add(reasons, "volatility_med", f"Волатильність ціни ({vol}%)", R.COMPETITION_W_PRICE_VOLATILITY_MED)

    final = _clip(score)
    return {"score": round(final, 1), "level": R.score_level(final), "reasons": reasons}


# ---------- RISK ----------

def compute_risk(
    latest: Dict[str, Any],
    market_ctx: Dict[str, Any],
    lifecycle_status: str,
    signals: List[Dict[str, Any]],
    competition_score: float,
) -> Dict[str, Any]:
    score = 0.0
    reasons: List[Dict[str, Any]] = []
    sellers = market_ctx.get("sellers_count", 0)
    vol = market_ctx.get("volatility_pct") or 0
    discount = latest.get("discount_percent") or 0

    if lifecycle_status == R.LIFECYCLE_REMOVED:
        score += R.RISK_W_REMOVED
        _add(reasons, "lifecycle_removed", "Lifecycle: знятий", R.RISK_W_REMOVED)
    if lifecycle_status == R.LIFECYCLE_DECLINING:
        score += R.RISK_W_DECLINING
        _add(reasons, "lifecycle_declining", "Lifecycle: згасає", R.RISK_W_DECLINING)
    if lifecycle_status == R.LIFECYCLE_OUT_OF_STOCK:
        score += R.RISK_W_OUT_OF_STOCK
        _add(reasons, "lifecycle_oos", "Lifecycle: немає в наявності", R.RISK_W_OUT_OF_STOCK)
    if vol >= 10 and sellers >= 5:
        score += R.RISK_W_PRICE_WAR
        _add(reasons, "price_war", f"Цінова війна ({sellers} продавців, vol {vol}%)", R.RISK_W_PRICE_WAR)
    if discount >= 25:
        score += R.RISK_W_AGGRESSIVE_DISCOUNTS
        _add(reasons, "aggressive_discount", f"Агресивна знижка −{round(discount)}%", R.RISK_W_AGGRESSIVE_DISCOUNTS)

    sigs7 = _signals_window(signals)
    rises = sum(1 for s in sigs7 if s["kind"] == R.SIGNAL_PRICE_RISE)
    if rises >= 2:
        score += R.RISK_W_FREQUENT_RISES
        _add(reasons, "frequent_rises", f"{rises} росту ціни", R.RISK_W_FREQUENT_RISES)

    rating = latest.get("rating") or 0
    reviews = latest.get("reviews_count") or 0
    if rating and rating < 4.0 and reviews >= 20:
        score += R.RISK_W_LOW_RATING
        _add(reasons, "low_rating", f"Низький рейтинг {rating}", R.RISK_W_LOW_RATING)
    if lifecycle_status == R.LIFECYCLE_NEW and reviews < 5:
        score += R.RISK_W_FEW_REVIEWS_NEW
        _add(reasons, "few_reviews_new", "Новинка без відгуків — невизначеність", R.RISK_W_FEW_REVIEWS_NEW)

    # Slight pull from competition (heavy competition raises risk)
    score += competition_score * 0.10
    if competition_score >= R.SCORE_LEVEL_HIGH:
        _add(reasons, "high_competition", "Високий рівень конкуренції", competition_score * 0.10)

    final = _clip(score)
    return {"score": round(final, 1), "level": R.score_level(final), "reasons": reasons}


# ---------- OPPORTUNITY ----------

def compute_opportunity(
    demand_score: float,
    competition_score: float,
    risk_score: float,
    latest: Dict[str, Any],
    market_ctx: Dict[str, Any],
    lifecycle_status: str,
) -> Dict[str, Any]:
    """Combination, not sum.

    Base = demand - 0.6*competition - 0.7*risk.
    Then apply situational bonuses (few sellers / new product / stable price).
    Floor checks ensure we never declare HIGH for a hopeless product.
    """
    reasons: List[Dict[str, Any]] = []
    base = demand_score - 0.6 * competition_score - 0.7 * risk_score
    _add(reasons, "base_combination",
         f"Demand {round(demand_score)} − 0.6·Competition {round(competition_score)} − 0.7·Risk {round(risk_score)}",
         round(base, 1))

    # Bonuses
    sellers = market_ctx.get("sellers_count", 0)
    if 0 < sellers <= 2:
        base += R.OPPORTUNITY_W_FEW_SELLERS
        _add(reasons, "few_sellers", f"Мало продавців ({sellers})", R.OPPORTUNITY_W_FEW_SELLERS)
    if lifecycle_status == R.LIFECYCLE_GROWING:
        base += R.OPPORTUNITY_W_GROWING
        _add(reasons, "growing", "Попит зростає", R.OPPORTUNITY_W_GROWING)
    if lifecycle_status == R.LIFECYCLE_NEW:
        base += R.OPPORTUNITY_W_NEW_PRODUCT
        _add(reasons, "new_product", "Новинка на ринку", R.OPPORTUNITY_W_NEW_PRODUCT)
    vol = market_ctx.get("volatility_pct") or 0
    if vol < 2:
        base += R.OPPORTUNITY_W_STABLE_PRICE
        _add(reasons, "stable_price", "Стабільна ціна", R.OPPORTUNITY_W_STABLE_PRICE)

    # Floor: cannot be HIGH if demand insufficient, risk too high, or competition saturated.
    final = _clip(base)
    level = R.score_level(final)
    if level == "high" and (
        demand_score < R.OPPORTUNITY_MIN_DEMAND_FOR_HIGH
        or risk_score > R.OPPORTUNITY_MAX_RISK_FOR_HIGH
        or competition_score > R.OPPORTUNITY_MAX_COMPETITION_FOR_HIGH
    ):
        level = "med"
        _add(reasons, "high_floor_blocked",
             "Заблоковано floor-перевіркою (demand/risk/competition не пройшли)",
             0)

    return {"score": round(final, 1), "level": level, "reasons": reasons}


# ---------- PUBLIC API ----------

def compute_product_scores(
    latest: Dict[str, Any],
    history: List[Dict[str, Any]],
    lifecycle_status: str,
    signals: Optional[List[Dict[str, Any]]] = None,
    same_category_sellers: int = 0,
) -> Dict[str, Any]:
    signals = signals or []
    market_ctx = market_context_for(latest, history)
    demand = compute_demand(latest, history, lifecycle_status, signals)
    competition = compute_competition(latest, history, market_ctx, signals, same_category_sellers)
    risk = compute_risk(latest, market_ctx, lifecycle_status, signals, competition["score"])
    opportunity = compute_opportunity(
        demand["score"], competition["score"], risk["score"],
        latest, market_ctx, lifecycle_status,
    )
    return {
        "product_key": latest.get("product_key"),
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "lifecycle_status": lifecycle_status,
        "market_context": market_ctx,
        "demand": demand,
        "competition": competition,
        "risk": risk,
        "opportunity": opportunity,
    }


# ---------- CATEGORY-LEVEL ----------

def compute_category_scores(
    category_name: str,
    products_in_category: List[Dict[str, Any]],
    new_products_in_window: int = 0,
    removed_products_in_window: int = 0,
) -> Dict[str, Any]:
    """Aggregate score over a category — each `products_in_category` item is the result
    of `compute_product_scores` for products inside that category.
    """
    if len(products_in_category) < R.CATEGORY_DEMAND_MIN_PRODUCTS:
        return {
            "category": category_name,
            "products": len(products_in_category),
            "demand": {"score": None, "level": "unknown", "reasons": [{"code": "too_small",
                "label": f"Замало товарів ({len(products_in_category)} < {R.CATEGORY_DEMAND_MIN_PRODUCTS})", "weight": 0}]},
            "competition": {"score": None, "level": "unknown", "reasons": []},
            "risk": {"score": None, "level": "unknown", "reasons": []},
            "opportunity": {"score": None, "level": "unknown", "reasons": []},
            "new_products": new_products_in_window,
            "removed_products": removed_products_in_window,
        }

    demand_avg = statistics.fmean([p["demand"]["score"] for p in products_in_category])
    competition_avg = statistics.fmean([p["competition"]["score"] for p in products_in_category])
    risk_avg = statistics.fmean([p["risk"]["score"] for p in products_in_category])
    opportunity_avg = statistics.fmean([p["opportunity"]["score"] for p in products_in_category])

    # Hot bonus: many new products → demand bump
    reasons_d: List[Dict[str, Any]] = [{"code": "avg",
        "label": f"Середнє по {len(products_in_category)} товарам", "weight": round(demand_avg, 1)}]
    if new_products_in_window >= R.CATEGORY_HOT_NEW_PRODUCTS:
        demand_avg = _clip(demand_avg + 8)
        reasons_d.append({"code": "hot_category",
            "label": f"+{new_products_in_window} нових товарів за 7 днів — категорія розігрівається",
            "weight": 8})

    return {
        "category": category_name,
        "products": len(products_in_category),
        "new_products": new_products_in_window,
        "removed_products": removed_products_in_window,
        "demand": {"score": round(demand_avg, 1), "level": R.score_level(demand_avg), "reasons": reasons_d},
        "competition": {"score": round(competition_avg, 1), "level": R.score_level(competition_avg),
            "reasons": [{"code": "avg", "label": "Середнє по товарам", "weight": round(competition_avg, 1)}]},
        "risk": {"score": round(risk_avg, 1), "level": R.score_level(risk_avg),
            "reasons": [{"code": "avg", "label": "Середнє по товарам", "weight": round(risk_avg, 1)}]},
        "opportunity": {"score": round(opportunity_avg, 1), "level": R.score_level(opportunity_avg),
            "reasons": [{"code": "avg", "label": "Середнє по товарам", "weight": round(opportunity_avg, 1)}]},
    }
