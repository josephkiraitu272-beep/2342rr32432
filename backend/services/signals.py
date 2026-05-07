"""
Market Signals Engine — emits deterministic events into `market_signals` collection.

Called from server's ingest path (`_record_market_signals`) right after we know:
  - the freshly-ingested product doc
  - its prior history (price_snapshots) including the *just-inserted* one

Signal kinds — see config/rules.py.

De-duplication: each signal carries (kind, product_key, day-bucket-of-captured_at).
We upsert by that unique tuple to avoid spamming the same kind for the same day.

Reason strings are stable, human-readable Ukrainian, suitable for UI cards.
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from config import rules as R

log = logging.getLogger("guru.signals")


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _signal_dedup_key(kind: str, product_key: str, captured_at: str) -> str:
    """One signal per (kind, product, day)."""
    day = (captured_at or "")[:10]
    raw = f"{kind}|{product_key}|{day}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _make_signal(
    kind: str,
    latest: Dict[str, Any],
    detail: str,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    captured_at = latest.get("captured_at") or datetime.now(timezone.utc).isoformat()
    sig = {
        "id": str(uuid.uuid4()),
        "dedup_key": _signal_dedup_key(kind, latest["product_key"], captured_at),
        "kind": kind,
        "level": R.SIGNAL_LEVELS.get(kind, "info"),
        "title": R.SIGNAL_TITLES_UA.get(kind, kind),
        "detail": detail,
        "product_key": latest["product_key"],
        "source": latest.get("source"),
        "product_title": latest.get("title"),
        "image": latest.get("image"),
        "url": latest.get("url"),
        "seller": latest.get("seller"),
        "category": latest.get("category"),
        "category_path": latest.get("category_path") or [],
        "price": latest.get("price"),
        "captured_at": captured_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        sig.update(extra)
    return sig


def build_signals_for_ingest(
    latest: Dict[str, Any],
    history: List[Dict[str, Any]],
    is_first_seen: bool,
    last_capture_before_now: Optional[datetime],
) -> List[Dict[str, Any]]:
    """Decide which signals to emit for a freshly-ingested product.

    `latest`  — normalized doc just persisted to `products`.
    `history` — ASC list of price_snapshots for this product_key, including the new one.
    `is_first_seen` — True if this is the first ever capture of this product_key.
    `last_capture_before_now` — the captured_at of the previous snapshot (None on first).
    """
    out: List[Dict[str, Any]] = []
    pkey = latest.get("product_key")
    if not pkey:
        return out

    # 1) NEW_PRODUCT — first ever capture
    if is_first_seen:
        out.append(
            _make_signal(
                R.SIGNAL_NEW_PRODUCT,
                latest,
                "Перший захват товару в системі",
            )
        )

    # 2) RETURNED_PRODUCT — long gap then re-appearance
    if last_capture_before_now is not None:
        now_ts = _parse_iso(latest.get("captured_at")) or datetime.now(timezone.utc)
        gap_days = (now_ts - last_capture_before_now).total_seconds() / 86400.0
        if gap_days >= R.RETURNED_GAP_DAYS:
            out.append(
                _make_signal(
                    R.SIGNAL_RETURNED_PRODUCT,
                    latest,
                    f"Повернувся після {int(gap_days)} дн. відсутності",
                    extra={"gap_days": round(gap_days, 1)},
                )
            )

    # 3) PROMO / TOP_SALES from badges
    badges = latest.get("badges") or []
    if any(b in R.PROMO_BADGE_KEYS for b in badges):
        out.append(
            _make_signal(
                R.SIGNAL_PROMO_DETECTED,
                latest,
                "Бадж «реклама / акція» на картці",
                extra={"badges": badges},
            )
        )
    if any(b in R.TOP_SALES_BADGE_KEYS for b in badges):
        out.append(
            _make_signal(
                R.SIGNAL_TOP_SALES_DETECTED,
                latest,
                "Бадж «топ продажів» на картці",
                extra={"badges": badges},
            )
        )

    # 4) Price drop / rise — compare latest vs first snapshot inside the window
    cutoff = datetime.now(timezone.utc) - timedelta(hours=R.PRICE_SIGNAL_WINDOW_HOURS)
    in_window = [
        h for h in history
        if (_parse_iso(h.get("captured_at")) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff
        and h.get("price") is not None
    ]
    if len(in_window) >= 2:
        first = in_window[0]["price"]
        last = in_window[-1]["price"]
        if first and first > 0:
            pct = ((last - first) / first) * 100.0
            if pct <= -R.PRICE_DROP_PCT:
                out.append(
                    _make_signal(
                        R.SIGNAL_PRICE_DROP,
                        latest,
                        f"Ціна впала {round(first)} → {round(last)} ₴ ({round(pct, 1)}%)",
                        extra={
                            "first_price": first,
                            "last_price": last,
                            "delta_pct": round(pct, 2),
                            "window_hours": R.PRICE_SIGNAL_WINDOW_HOURS,
                        },
                    )
                )
            elif pct >= R.PRICE_RISE_PCT:
                out.append(
                    _make_signal(
                        R.SIGNAL_PRICE_RISE,
                        latest,
                        f"Ціна зросла {round(first)} → {round(last)} ₴ (+{round(pct, 1)}%)",
                        extra={
                            "first_price": first,
                            "last_price": last,
                            "delta_pct": round(pct, 2),
                            "window_hours": R.PRICE_SIGNAL_WINDOW_HOURS,
                        },
                    )
                )

    # 5) STOCK_OUT / BACK_IN_STOCK — availability flip
    if len(history) >= 2:
        prev_avail = history[-2].get("availability")
        curr_avail = latest.get("availability")
        if prev_avail is True and curr_avail is False:
            out.append(
                _make_signal(
                    R.SIGNAL_STOCK_OUT,
                    latest,
                    "Товар був в наявності → зараз «немає»",
                )
            )
        elif prev_avail is False and curr_avail is True:
            out.append(
                _make_signal(
                    R.SIGNAL_BACK_IN_STOCK,
                    latest,
                    "Товар знову в наявності",
                )
            )

    return out
