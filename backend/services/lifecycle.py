"""
Product Lifecycle Engine — derives a deterministic lifecycle status from snapshot history.

Reads:
  - price_snapshots (time series of price/availability/seller per product_key)
  - products (latest captured snapshot per product_key, has badges/reviews/etc)

Produces (per product_key):
  {
    product_key, source, title, image, url, seller, category_path,
    first_seen_at, last_seen_at,
    lifecycle_status: one of LIFECYCLE_*,
    reasons: [str],   # human-readable evidence list
    snapshots,        # count
    last_price, first_price,
    price_delta_pct,  # over the trend window
    reviews_delta,    # over GROWING_WINDOW_DAYS
    sellers_count,
  }

No writes here — the API layer composes results on demand. Cheap to recompute.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from config import rules as R


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _days_ago(dt: Optional[datetime]) -> Optional[float]:
    if not dt:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0


def _detect_returned(history: List[Dict[str, Any]]) -> bool:
    """Returns True if the timeline shows a gap >= RETURNED_GAP_DAYS followed by a fresh capture."""
    if len(history) < 2:
        return False
    last_ts = _parse_iso(history[-1].get("captured_at"))
    prev_ts = _parse_iso(history[-2].get("captured_at"))
    if not last_ts or not prev_ts:
        return False
    gap_days = (last_ts - prev_ts).total_seconds() / 86400.0
    return gap_days >= R.RETURNED_GAP_DAYS


def _price_delta_in_window(
    history: List[Dict[str, Any]], window_days: int
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """Return (first_price, last_price, pct_delta) for snapshots within the window."""
    if not history:
        return None, None, None
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    in_window = [
        h for h in history
        if (_parse_iso(h.get("captured_at")) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff
        and h.get("price") is not None
    ]
    if len(in_window) < 2:
        return None, None, None
    first = in_window[0]["price"]
    last = in_window[-1]["price"]
    if not first:
        return first, last, None
    pct = ((last - first) / first) * 100.0
    return first, last, pct


def compute_lifecycle(
    product_key: str,
    latest: Dict[str, Any],
    history: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute lifecycle status + evidence from a single product's snapshot timeline.

    `history` MUST be sorted by captured_at ASC.
    `latest` is the most recent product snapshot (full doc with badges, etc).
    """
    reasons: List[str] = []

    first_seen = _parse_iso(history[0].get("captured_at")) if history else None
    last_seen = _parse_iso(history[-1].get("captured_at")) if history else None
    age_days = _days_ago(first_seen)
    last_seen_ago_days = _days_ago(last_seen)

    last_avail = latest.get("availability")

    # --- price trend over DECLINING_WINDOW_DAYS ---
    first_p, last_p, price_pct = _price_delta_in_window(history, R.DECLINING_WINDOW_DAYS)

    # --- reviews delta over GROWING_WINDOW_DAYS (latest doc has reviews_count) ---
    reviews_now = latest.get("reviews_count") or 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=R.GROWING_WINDOW_DAYS)
    # reviews_count is on `products` docs; we approximate "earliest in window" by scanning history
    # if it carries reviews_count (it doesn't right now — fallback to 0 means 'no signal').
    reviews_then = 0
    for h in history:
        ts = _parse_iso(h.get("captured_at"))
        if ts and ts >= cutoff and "reviews_count" in h:
            reviews_then = h.get("reviews_count") or 0
            break
    reviews_delta = max(reviews_now - reviews_then, 0)

    sellers_set = {h.get("seller") for h in history if h.get("seller")}
    sellers_count = len(sellers_set)

    # --- decide lifecycle (priority order matters) ---
    status = R.LIFECYCLE_ACTIVE

    # 1) Removed: not seen for too long
    if last_seen_ago_days is not None and last_seen_ago_days >= R.REMOVED_AFTER_DAYS:
        status = R.LIFECYCLE_REMOVED
        reasons.append(f"Не зустрічався {int(last_seen_ago_days)} дн.")
    # 2) Out of stock: latest snapshot says unavailable
    elif last_avail is False:
        status = R.LIFECYCLE_OUT_OF_STOCK
        reasons.append("Останній захват — «немає в наявності»")
    # 3) Returned: had a long gap then re-appeared
    elif _detect_returned(history):
        status = R.LIFECYCLE_RETURNED
        reasons.append("Повернувся після тривалої відсутності")
    # 4) New: first seen recently
    elif age_days is not None and age_days <= R.NEW_PRODUCT_DAYS:
        status = R.LIFECYCLE_NEW
        reasons.append(
            f"Вперше зафіксовано {round(age_days, 1)} дн. тому (≤{R.NEW_PRODUCT_DAYS} дн.)"
        )
    else:
        # 5) Trending overlays — declining / growing
        if price_pct is not None and price_pct <= -R.DECLINING_PCT:
            status = R.LIFECYCLE_DECLINING
            reasons.append(
                f"Ціна впала на {abs(round(price_pct, 1))}% за {R.DECLINING_WINDOW_DAYS} дн."
            )
        elif reviews_delta >= R.GROWING_REVIEWS_DELTA:
            status = R.LIFECYCLE_GROWING
            reasons.append(
                f"+{reviews_delta} відгуків за {R.GROWING_WINDOW_DAYS} дн."
            )
        elif price_pct is not None and price_pct >= R.GROWING_PRICE_PCT:
            status = R.LIFECYCLE_GROWING
            reasons.append(
                f"Ціна зросла на {round(price_pct, 1)}% за {R.GROWING_WINDOW_DAYS} дн. (попит росте)"
            )
        else:
            reasons.append("Стабільний асортимент")

    return {
        "product_key": product_key,
        "source": latest.get("source"),
        "title": latest.get("title"),
        "image": latest.get("image"),
        "url": latest.get("url"),
        "seller": latest.get("seller"),
        "category": latest.get("category"),
        "category_path": latest.get("category_path") or [],
        "badges": latest.get("badges") or [],
        "price": latest.get("price"),
        "old_price": latest.get("old_price"),
        "discount_percent": latest.get("discount_percent"),
        "availability": last_avail,
        "first_seen_at": first_seen.isoformat() if first_seen else None,
        "last_seen_at": last_seen.isoformat() if last_seen else None,
        "age_days": round(age_days, 2) if age_days is not None else None,
        "last_seen_ago_days": round(last_seen_ago_days, 2) if last_seen_ago_days is not None else None,
        "lifecycle_status": status,
        "reasons": reasons,
        "snapshots": len(history),
        "first_price": first_p,
        "last_price": last_p,
        "price_delta_pct": round(price_pct, 2) if price_pct is not None else None,
        "reviews_delta": reviews_delta,
        "sellers_count": sellers_count,
    }
