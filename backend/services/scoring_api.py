"""
Scoring API routes (Task 2 — Market Scoring Engine).

Mounted alongside the intelligence_api router.

Endpoints:
  GET /api/scoring/products/{product_key}         — full 4-score breakdown
  GET /api/scoring/products/{product_key}/history — score over time
  GET /api/scoring/categories                     — category-level scoring
  GET /api/opportunities/trending                 — high opportunity, low risk
  GET /api/opportunities/risk                     — high risk products to avoid
  GET /api/opportunities/stable                   — stable winners
  GET /api/opportunities/emerging                 — new + growing
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from config import rules as R
from services.lifecycle import compute_lifecycle
from services.scoring import (
    compute_product_scores,
    compute_category_scores,
)

log = logging.getLogger("guru.scoring")

SourceType = Literal["rozetka", "epicentr"]


def make_scoring_router(db) -> APIRouter:
    router = APIRouter(prefix="/api")

    async def _history(pkey: str) -> List[Dict[str, Any]]:
        cur = (
            db.price_snapshots.find({"product_key": pkey}, {"_id": 0})
            .sort("captured_at", 1)
        )
        return await cur.to_list(2000)

    async def _latest(pkey: str) -> Optional[Dict[str, Any]]:
        return await db.products.find_one(
            {"product_key": pkey}, {"_id": 0}, sort=[("captured_at", -1)]
        )

    async def _signals(pkey: str, days: int = 14) -> List[Dict[str, Any]]:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        cur = db.market_signals.find(
            {"product_key": pkey, "captured_at": {"$gte": cutoff}}, {"_id": 0}
        ).sort("captured_at", -1)
        return await cur.to_list(500)

    async def _watchlist_filter() -> Dict[str, Any]:
        rules = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
        if not rules:
            return {}
        ors = []
        for r in rules:
            ck = r.get("category_key")
            src = r.get("source")
            if not ck:
                continue
            cond: Dict[str, Any] = {"$or": [{"category_path": ck}, {"category": ck}]}
            if src:
                cond["source"] = src
            ors.append(cond)
        return {"$or": ors} if ors else {}

    async def _score_for_product(pkey: str) -> Optional[Dict[str, Any]]:
        latest = await _latest(pkey)
        if not latest:
            return None
        history = await _history(pkey)
        lc = compute_lifecycle(pkey, latest, history)
        sigs = await _signals(pkey)
        # Same-category sellers: count distinct sellers carrying any product in the same category
        cat_root = (latest.get("category_path") or [None])[0] or latest.get("category")
        category_sellers = 0
        if cat_root:
            cs = await db.products.distinct(
                "seller",
                {"$or": [{"category_path": cat_root}, {"category": cat_root}],
                 "seller": {"$ne": None}},
            )
            category_sellers = len(cs)
        scores = compute_product_scores(
            latest, history, lc["lifecycle_status"], signals=sigs,
            same_category_sellers=category_sellers,
        )
        scores["title"] = latest.get("title")
        scores["url"] = latest.get("url")
        scores["image"] = latest.get("image")
        scores["source"] = latest.get("source")
        scores["seller"] = latest.get("seller")
        scores["category"] = cat_root
        scores["price"] = latest.get("price")
        scores["discount_percent"] = latest.get("discount_percent")
        scores["snapshots"] = len(history)
        return scores

    @router.get("/scoring/products/{product_key}")
    async def scoring_for_product(product_key: str):
        s = await _score_for_product(product_key)
        if not s:
            raise HTTPException(status_code=404, detail="Product not found")
        return s

    @router.get("/scoring/products/{product_key}/history")
    async def scoring_history(product_key: str, limit: int = Query(default=200, ge=1, le=2000)):
        cur = (
            db.score_snapshots.find({"product_key": product_key}, {"_id": 0})
            .sort("computed_at", 1)
            .limit(limit)
        )
        items = await cur.to_list(limit)
        return {"product_key": product_key, "count": len(items), "items": items}

    async def _all_products(watchlist_only: bool, source: Optional[str], limit: int = 1000):
        match: Dict[str, Any] = {}
        if source:
            match["source"] = source
        if watchlist_only:
            wf = await _watchlist_filter()
            if wf:
                match = {"$and": [match, wf]} if match else wf
            else:
                return []
        pipeline = [
            {"$match": match},
            {"$sort": {"captured_at": -1}},
            {"$group": {"_id": "$product_key", "latest": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$latest"}},
            {"$limit": limit},
        ]
        keys: List[str] = []
        async for r in db.products.aggregate(pipeline):
            pk = r.get("product_key")
            if pk:
                keys.append(pk)
        scored = []
        for pk in keys:
            s = await _score_for_product(pk)
            if s:
                scored.append(s)
        return scored

    @router.get("/opportunities/trending")
    async def opportunities_trending(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=20, ge=1, le=100),
    ):
        all_scored = await _all_products(watchlist_only, source)
        # Trending = high opportunity AND low/med risk
        items = [
            s for s in all_scored
            if s["opportunity"]["score"] is not None
            and s["opportunity"]["score"] >= R.SCORE_LEVEL_MED
            and s["risk"]["score"] is not None
            and s["risk"]["score"] < R.SCORE_LEVEL_HIGH
        ]
        items.sort(key=lambda s: s["opportunity"]["score"], reverse=True)
        return {"items": items[:limit], "count": min(limit, len(items)), "total_scored": len(all_scored)}

    @router.get("/opportunities/risk")
    async def opportunities_risk(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=20, ge=1, le=100),
    ):
        all_scored = await _all_products(watchlist_only, source)
        items = [s for s in all_scored if s["risk"]["score"] is not None and s["risk"]["score"] >= R.SCORE_LEVEL_MED]
        items.sort(key=lambda s: s["risk"]["score"], reverse=True)
        return {"items": items[:limit], "count": min(limit, len(items))}

    @router.get("/opportunities/stable")
    async def opportunities_stable(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=20, ge=1, le=100),
    ):
        """Stable winners = active, low volatility, demand >= med, risk low."""
        all_scored = await _all_products(watchlist_only, source)
        items = [
            s for s in all_scored
            if s["lifecycle_status"] == R.LIFECYCLE_ACTIVE
            and (s["market_context"].get("volatility_pct") or 0) < 3.0
            and s["demand"]["score"] is not None and s["demand"]["score"] >= R.SCORE_LEVEL_MED
            and s["risk"]["score"] is not None and s["risk"]["score"] < R.SCORE_LEVEL_MED
            and s["snapshots"] >= 5
        ]
        items.sort(key=lambda s: (s["demand"]["score"], s["snapshots"]), reverse=True)
        return {"items": items[:limit], "count": min(limit, len(items))}

    @router.get("/opportunities/emerging")
    async def opportunities_emerging(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=20, ge=1, le=100),
    ):
        """Emerging = lifecycle in {new, growing} AND demand >= med."""
        all_scored = await _all_products(watchlist_only, source)
        items = [
            s for s in all_scored
            if s["lifecycle_status"] in (R.LIFECYCLE_NEW, R.LIFECYCLE_GROWING)
            and s["demand"]["score"] is not None
            and s["demand"]["score"] >= R.SCORE_LEVEL_MED
        ]
        items.sort(key=lambda s: s["opportunity"]["score"] or 0, reverse=True)
        return {"items": items[:limit], "count": min(limit, len(items))}

    @router.get("/scoring/categories")
    async def category_scoring(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=20, ge=1, le=100),
    ):
        """Aggregate scores per category by averaging product-level scores in that category."""
        all_scored = await _all_products(watchlist_only, source)
        by_cat: Dict[str, List[Dict[str, Any]]] = {}
        for s in all_scored:
            cat = s.get("category")
            if not cat:
                continue
            by_cat.setdefault(cat, []).append(s)

        # Count new/removed product signals per category in the last 7 days
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        new_by_cat: Dict[str, int] = {}
        removed_by_cat: Dict[str, int] = {}
        async for r in db.market_signals.aggregate([
            {"$match": {"captured_at": {"$gte": since}, "kind": {"$in": [R.SIGNAL_NEW_PRODUCT, R.SIGNAL_REMOVED_PRODUCT]}}},
            {"$unwind": {"path": "$category_path", "preserveNullAndEmptyArrays": True}},
            {"$group": {"_id": {"cat": "$category_path", "kind": "$kind"}, "n": {"$sum": 1}}},
        ]):
            cat = r["_id"].get("cat")
            kind = r["_id"].get("kind")
            if not cat:
                continue
            if kind == R.SIGNAL_NEW_PRODUCT:
                new_by_cat[cat] = new_by_cat.get(cat, 0) + r["n"]
            elif kind == R.SIGNAL_REMOVED_PRODUCT:
                removed_by_cat[cat] = removed_by_cat.get(cat, 0) + r["n"]

        items = []
        for cat, prods in by_cat.items():
            cs = compute_category_scores(
                cat, prods,
                new_products_in_window=new_by_cat.get(cat, 0),
                removed_products_in_window=removed_by_cat.get(cat, 0),
            )
            items.append(cs)
        items.sort(key=lambda c: (c["opportunity"]["score"] or -1), reverse=True)
        return {"items": items[:limit], "count": min(limit, len(items))}

    return router


# ---------- score snapshot persistence (called from ingest path) ----------

async def record_score_snapshot(db, scored: Dict[str, Any]) -> None:
    """Idempotent per (product_key, 6h-bucket)."""
    pk = scored.get("product_key")
    if not pk:
        return
    computed = scored.get("computed_at") or datetime.now(timezone.utc).isoformat()
    # bucket = floor(hours / SCORE_SNAPSHOT_DEDUP_HOURS)
    try:
        ts = datetime.fromisoformat(computed.replace("Z", "+00:00"))
    except Exception:
        ts = datetime.now(timezone.utc)
    bucket = ts.replace(microsecond=0, second=0, minute=0).replace(
        hour=(ts.hour // R.SCORE_SNAPSHOT_DEDUP_HOURS) * R.SCORE_SNAPSHOT_DEDUP_HOURS
    )
    dedup = f"{pk}|{bucket.isoformat()}"
    doc = {
        "dedup_key": dedup,
        "product_key": pk,
        "computed_at": computed,
        "lifecycle_status": scored.get("lifecycle_status"),
        "demand_score": scored["demand"]["score"],
        "demand_level": scored["demand"]["level"],
        "competition_score": scored["competition"]["score"],
        "competition_level": scored["competition"]["level"],
        "risk_score": scored["risk"]["score"],
        "risk_level": scored["risk"]["level"],
        "opportunity_score": scored["opportunity"]["score"],
        "opportunity_level": scored["opportunity"]["level"],
        "snapshots": scored.get("snapshots"),
        "sellers_count": (scored.get("market_context") or {}).get("sellers_count"),
    }
    try:
        await db.score_snapshots.update_one(
            {"dedup_key": dedup}, {"$setOnInsert": doc}, upsert=True
        )
    except Exception as e:
        log.warning("score_snapshot upsert failed: %s", e)
