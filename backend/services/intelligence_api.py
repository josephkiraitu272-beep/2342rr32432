"""
Intelligence API routes — wired into the existing FastAPI app via include_router.

Adds:
  - Watchlist CRUD          (/api/watchlist*)
  - Lifecycle endpoints     (/api/lifecycle/*)
  - Signals feed            (/api/signals*)
  - Market Overview v2      (/api/market/overview, /heat, /pressure, /promo)
  - Product Feed v2         (/api/feed/products) — joined lifecycle + signals
  - Backfill                (POST /api/admin/backfill)

Shares the same Mongo client as server.py via `db` injected on import.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from config import rules as R
from services.lifecycle import compute_lifecycle
from services.signals import build_signals_for_ingest

log = logging.getLogger("guru.intelligence")


# ---------- Pydantic ----------

SourceType = Literal["rozetka", "epicentr"]


class WatchlistIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category_key: str = Field(..., min_length=1, max_length=200)
    category_name: str = Field(..., min_length=1, max_length=200)
    source: Optional[SourceType] = None
    enabled: bool = True
    priority: int = 0


class WatchlistPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    category_name: Optional[str] = None


# ---------- Helpers (DB-aware) ----------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_router(db, require_extension_key) -> APIRouter:
    """Factory so we share the existing db handle and auth dep."""
    router = APIRouter(prefix="/api")

    # ---------- Watchlist ----------

    @router.get("/watchlist")
    async def list_watchlist():
        cursor = db.watchlists.find({}, {"_id": 0}).sort([("priority", -1), ("created_at", 1)])
        items = await cursor.to_list(500)
        return {"items": items, "count": len(items)}

    @router.post("/watchlist")
    async def add_watchlist(payload: WatchlistIn):
        doc = payload.model_dump()
        # Upsert by (category_key, source) so re-adding doesn't dup
        existing = await db.watchlists.find_one(
            {"category_key": doc["category_key"], "source": doc.get("source")},
            {"_id": 0},
        )
        if existing:
            await db.watchlists.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "category_name": doc["category_name"],
                    "enabled": doc["enabled"],
                    "priority": doc["priority"],
                    "updated_at": now_iso(),
                }},
            )
            updated = await db.watchlists.find_one({"id": existing["id"]}, {"_id": 0})
            return {"ok": True, "item": updated, "created": False}
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now_iso()
        doc["updated_at"] = doc["created_at"]
        await db.watchlists.insert_one(dict(doc))
        return {"ok": True, "item": doc, "created": True}

    @router.patch("/watchlist/{wid}")
    async def patch_watchlist(wid: str, payload: WatchlistPatch):
        update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
        if not update:
            raise HTTPException(status_code=400, detail="Nothing to update")
        update["updated_at"] = now_iso()
        r = await db.watchlists.update_one({"id": wid}, {"$set": update})
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        item = await db.watchlists.find_one({"id": wid}, {"_id": 0})
        return {"ok": True, "item": item}

    @router.delete("/watchlist/{wid}")
    async def delete_watchlist(wid: str):
        r = await db.watchlists.delete_one({"id": wid})
        if r.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    @router.get("/watchlist/categories")
    async def watchlist_categories(limit: int = Query(default=200, ge=1, le=2000)):
        """Discoverable categories from observed products — for category picker UI."""
        pipeline = [
            {"$match": {"category_path": {"$ne": []}}},
            {"$project": {"category_path": 1, "source": 1}},
            {"$unwind": "$category_path"},
            {"$group": {
                "_id": {"name": "$category_path", "source": "$source"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        items = []
        async for r in db.products.aggregate(pipeline):
            items.append({
                "category_key": r["_id"]["name"],
                "category_name": r["_id"]["name"],
                "source": r["_id"]["source"],
                "products_count": r["count"],
            })
        # Also surface single-field `category` if it has data and category_path didn't cover
        async for r in db.products.aggregate([
            {"$match": {"category": {"$ne": None}, "category_path": {"$in": [[], None]}}},
            {"$group": {"_id": {"name": "$category", "source": "$source"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]):
            items.append({
                "category_key": r["_id"]["name"],
                "category_name": r["_id"]["name"],
                "source": r["_id"]["source"],
                "products_count": r["count"],
            })
        # Deduplicate by (key, source)
        seen = set()
        deduped = []
        for it in items:
            sig = (it["category_key"], it.get("source"))
            if sig in seen:
                continue
            seen.add(sig)
            deduped.append(it)
        return {"items": deduped[:limit], "count": len(deduped[:limit])}

    async def _get_watchlist_filter() -> Dict[str, Any]:
        """Build a Mongo filter that matches products in any enabled watchlist category."""
        cursor = db.watchlists.find({"enabled": True}, {"_id": 0, "category_key": 1, "source": 1})
        rules = await cursor.to_list(500)
        if not rules:
            return {}  # empty = no filter (whole market)
        ors = []
        for r in rules:
            ck = r.get("category_key")
            src = r.get("source")
            if not ck:
                continue
            cond: Dict[str, Any] = {
                "$or": [
                    {"category_path": ck},
                    {"category": ck},
                ]
            }
            if src:
                cond["source"] = src
            ors.append(cond)
        if not ors:
            return {}
        return {"$or": ors}

    # ---------- Lifecycle ----------

    async def _history_for(product_key: str, limit: int = 2000) -> List[Dict[str, Any]]:
        cur = (
            db.price_snapshots.find({"product_key": product_key}, {"_id": 0})
            .sort("captured_at", 1)
            .limit(limit)
        )
        return await cur.to_list(limit)

    async def _latest_product(product_key: str) -> Optional[Dict[str, Any]]:
        return await db.products.find_one(
            {"product_key": product_key},
            {"_id": 0},
            sort=[("captured_at", -1)],
        )

    @router.get("/lifecycle/products/{product_key}")
    async def lifecycle_for_product(product_key: str):
        latest = await _latest_product(product_key)
        if not latest:
            raise HTTPException(status_code=404, detail="Product not found")
        history = await _history_for(product_key)
        return compute_lifecycle(product_key, latest, history)

    @router.get("/lifecycle/summary")
    async def lifecycle_summary(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
    ):
        """Counts of products in each lifecycle bucket."""
        match: Dict[str, Any] = {}
        if source:
            match["source"] = source
        if watchlist_only:
            wf = await _get_watchlist_filter()
            if wf:
                match = {"$and": [match, wf]} if match else wf
            else:
                # No active watchlist rules → empty result
                return {
                    "buckets": {k: 0 for k in [
                        R.LIFECYCLE_NEW, R.LIFECYCLE_ACTIVE, R.LIFECYCLE_OUT_OF_STOCK,
                        R.LIFECYCLE_REMOVED, R.LIFECYCLE_RETURNED, R.LIFECYCLE_DECLINING,
                        R.LIFECYCLE_GROWING,
                    ]},
                    "total": 0,
                    "watchlist_active": False,
                }

        # Get the latest doc per product_key and compute lifecycle on the fly.
        pipeline = [
            {"$match": match},
            {"$sort": {"captured_at": -1}},
            {"$group": {"_id": "$product_key", "latest": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$latest"}},
            {"$limit": 5000},
        ]
        buckets: Dict[str, int] = {k: 0 for k in [
            R.LIFECYCLE_NEW, R.LIFECYCLE_ACTIVE, R.LIFECYCLE_OUT_OF_STOCK,
            R.LIFECYCLE_REMOVED, R.LIFECYCLE_RETURNED, R.LIFECYCLE_DECLINING,
            R.LIFECYCLE_GROWING,
        ]}
        total = 0
        async for latest in db.products.aggregate(pipeline):
            pk = latest.get("product_key")
            if not pk:
                continue
            history = await _history_for(pk)
            life = compute_lifecycle(pk, latest, history)
            buckets[life["lifecycle_status"]] = buckets.get(life["lifecycle_status"], 0) + 1
            total += 1
        return {
            "buckets": buckets,
            "total": total,
            "watchlist_active": watchlist_only and bool(await db.watchlists.count_documents({"enabled": True})),
        }

    @router.get("/lifecycle/feed")
    async def lifecycle_feed(
        status: Optional[str] = Query(default=None),
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=50, ge=1, le=500),
    ):
        """Latest products with computed lifecycle status, optionally filtered to a bucket."""
        match: Dict[str, Any] = {}
        if source:
            match["source"] = source
        if watchlist_only:
            wf = await _get_watchlist_filter()
            if wf:
                match = {"$and": [match, wf]} if match else wf

        pipeline = [
            {"$match": match},
            {"$sort": {"captured_at": -1}},
            {"$group": {"_id": "$product_key", "latest": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$latest"}},
            {"$limit": 1000},
        ]
        results: List[Dict[str, Any]] = []
        async for latest in db.products.aggregate(pipeline):
            pk = latest.get("product_key")
            if not pk:
                continue
            history = await _history_for(pk)
            life = compute_lifecycle(pk, latest, history)
            if status and life["lifecycle_status"] != status:
                continue
            results.append(life)
            if len(results) >= limit:
                break
        return {"items": results, "count": len(results)}

    # ---------- Signals ----------

    @router.get("/signals")
    async def list_signals(
        kinds: Optional[str] = Query(default=None, description="comma-separated"),
        source: Optional[SourceType] = None,
        watchlist_only: bool = False,
        since_hours: int = Query(default=72, ge=1, le=720),
        limit: int = Query(default=100, ge=1, le=500),
    ):
        match: Dict[str, Any] = {
            "captured_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()}
        }
        if kinds:
            match["kind"] = {"$in": [k.strip() for k in kinds.split(",") if k.strip()]}
        if source:
            match["source"] = source
        if watchlist_only:
            # Match by category — signals carry category_path
            wl = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
            cats = list({w["category_key"] for w in wl})
            if not cats:
                return {"items": [], "count": 0, "watchlist_active": False}
            match["$or"] = [
                {"category": {"$in": cats}},
                {"category_path": {"$in": cats}},
            ]
        cursor = db.market_signals.find(match, {"_id": 0}).sort("captured_at", -1).limit(limit)
        items = await cursor.to_list(limit)
        return {"items": items, "count": len(items)}

    @router.get("/signals/summary")
    async def signals_summary(
        since_hours: int = Query(default=24, ge=1, le=720),
        watchlist_only: bool = False,
    ):
        match: Dict[str, Any] = {
            "captured_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()}
        }
        if watchlist_only:
            wl = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
            cats = list({w["category_key"] for w in wl})
            if not cats:
                return {"buckets": {}, "total": 0, "since_hours": since_hours, "watchlist_active": False}
            match["$or"] = [{"category": {"$in": cats}}, {"category_path": {"$in": cats}}]

        pipeline = [
            {"$match": match},
            {"$group": {"_id": "$kind", "count": {"$sum": 1}}},
        ]
        buckets: Dict[str, int] = {}
        total = 0
        async for r in db.market_signals.aggregate(pipeline):
            buckets[r["_id"]] = r["count"]
            total += r["count"]
        return {"buckets": buckets, "total": total, "since_hours": since_hours}

    # ---------- Market Overview v2 ----------

    @router.get("/market/overview")
    async def market_overview(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        window_days: int = Query(default=7, ge=1, le=90),
    ):
        """High-level operational panel for the dashboard.

        Returns:
          - new_products_count, returned_products_count, removed_products_count,
            stock_outs_count, promo_count, top_sales_count
          - active_categories (≥ CATEGORY_MIN_PRODUCTS in window)
          - sellers_count, total_products
        """
        since_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
        match_sigs: Dict[str, Any] = {"captured_at": {"$gte": since_iso}}
        if source:
            match_sigs["source"] = source
        if watchlist_only:
            wl = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
            cats = list({w["category_key"] for w in wl})
            if cats:
                match_sigs["$or"] = [{"category": {"$in": cats}}, {"category_path": {"$in": cats}}]
            else:
                match_sigs["_no_match"] = "1"  # empty result if WL empty

        async def cnt(kind: str) -> int:
            q = {**match_sigs, "kind": kind}
            return await db.market_signals.count_documents(q)

        new_products = await cnt(R.SIGNAL_NEW_PRODUCT)
        returned_products = await cnt(R.SIGNAL_RETURNED_PRODUCT)
        stock_outs = await cnt(R.SIGNAL_STOCK_OUT)
        promo = await cnt(R.SIGNAL_PROMO_DETECTED)
        top_sales = await cnt(R.SIGNAL_TOP_SALES_DETECTED)
        price_drops = await cnt(R.SIGNAL_PRICE_DROP)
        price_rises = await cnt(R.SIGNAL_PRICE_RISE)

        # Removed = derived from products not seen in REMOVED_AFTER_DAYS
        removed_pipeline = [
            {"$sort": {"captured_at": -1}},
            {"$group": {"_id": "$product_key", "last_seen": {"$first": "$captured_at"}, "src": {"$first": "$source"}}},
            {"$match": {"last_seen": {"$lt": (datetime.now(timezone.utc) - timedelta(days=R.REMOVED_AFTER_DAYS)).isoformat()}}},
            {"$count": "n"},
        ]
        removed = 0
        async for r in db.products.aggregate(removed_pipeline):
            removed = r.get("n", 0)

        # Active categories with movement in the window
        cat_pipeline = [
            {"$match": match_sigs},
            {"$unwind": {"path": "$category_path", "preserveNullAndEmptyArrays": True}},
            {"$group": {"_id": "$category_path", "events": {"$sum": 1}}},
            {"$match": {"events": {"$gte": R.CATEGORY_MIN_PRODUCTS}, "_id": {"$ne": None}}},
            {"$count": "n"},
        ]
        active_cats = 0
        async for r in db.market_signals.aggregate(cat_pipeline):
            active_cats = r.get("n", 0)

        # Total products & sellers (latest dedup)
        total_products = len(await db.products.distinct("product_key"))
        total_sellers = len(await db.products.distinct("seller", {"seller": {"$ne": None}}))

        return {
            "window_days": window_days,
            "new_products": new_products,
            "returned_products": returned_products,
            "removed_products": removed,
            "stock_outs": stock_outs,
            "promo_count": promo,
            "top_sales_count": top_sales,
            "price_drops": price_drops,
            "price_rises": price_rises,
            "active_categories": active_cats,
            "total_products": total_products,
            "total_sellers": total_sellers,
            "watchlist_active": watchlist_only,
            "ts": now_iso(),
        }

    @router.get("/market/heat")
    async def market_heat(
        window_days: int = Query(default=7, ge=1, le=90),
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=12, ge=1, le=50),
    ):
        """Categories ranked by recent activity (signals + new captures)."""
        since_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
        match: Dict[str, Any] = {"captured_at": {"$gte": since_iso}}
        if source:
            match["source"] = source
        if watchlist_only:
            wl = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
            cats = list({w["category_key"] for w in wl})
            if not cats:
                return {"items": [], "count": 0}
            match["$or"] = [{"category": {"$in": cats}}, {"category_path": {"$in": cats}}]

        pipeline = [
            {"$match": match},
            {"$unwind": {"path": "$category_path", "preserveNullAndEmptyArrays": False}},
            {"$group": {
                "_id": "$category_path",
                "events": {"$sum": 1},
                "by_kind": {"$push": "$kind"},
            }},
            {"$match": {"events": {"$gte": R.CATEGORY_MIN_PRODUCTS}}},
            {"$sort": {"events": -1}},
            {"$limit": limit},
        ]
        items = []
        async for r in db.market_signals.aggregate(pipeline):
            kinds = r.get("by_kind", [])
            items.append({
                "category": r["_id"],
                "events": r["events"],
                "new": kinds.count(R.SIGNAL_NEW_PRODUCT),
                "removed": kinds.count(R.SIGNAL_REMOVED_PRODUCT),
                "promo": kinds.count(R.SIGNAL_PROMO_DETECTED),
                "price_drops": kinds.count(R.SIGNAL_PRICE_DROP),
                "stock_outs": kinds.count(R.SIGNAL_STOCK_OUT),
            })
        return {"items": items, "count": len(items), "window_days": window_days}

    @router.get("/market/seller-pressure")
    async def market_seller_pressure(
        window_days: int = Query(default=7, ge=1, le=90),
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=15, ge=1, le=50),
    ):
        """Sellers ranked by aggressiveness in the window: new listings + price drops + promo."""
        since_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
        match: Dict[str, Any] = {"captured_at": {"$gte": since_iso}, "seller": {"$ne": None}}
        if source:
            match["source"] = source
        if watchlist_only:
            wl = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
            cats = list({w["category_key"] for w in wl})
            if not cats:
                return {"items": [], "count": 0}
            match["$or"] = [{"category": {"$in": cats}}, {"category_path": {"$in": cats}}]

        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": "$seller",
                "events": {"$sum": 1},
                "kinds": {"$push": "$kind"},
                "products": {"$addToSet": "$product_key"},
            }},
            {"$addFields": {"unique_products": {"$size": "$products"}}},
            {"$sort": {"events": -1}},
            {"$limit": limit},
        ]
        items = []
        async for r in db.market_signals.aggregate(pipeline):
            kinds = r.get("kinds", [])
            items.append({
                "seller": r["_id"],
                "events": r["events"],
                "unique_products": r.get("unique_products", 0),
                "price_drops": kinds.count(R.SIGNAL_PRICE_DROP),
                "promo": kinds.count(R.SIGNAL_PROMO_DETECTED),
                "new_products": kinds.count(R.SIGNAL_NEW_PRODUCT),
                "stock_outs": kinds.count(R.SIGNAL_STOCK_OUT),
            })
        return {"items": items, "count": len(items), "window_days": window_days}

    @router.get("/market/promo")
    async def market_promo(
        window_days: int = Query(default=7, ge=1, le=90),
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        limit: int = Query(default=20, ge=1, le=100),
    ):
        """Recent promo / top_sales detections — what marketplace is actively pushing."""
        since_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
        match: Dict[str, Any] = {
            "captured_at": {"$gte": since_iso},
            "kind": {"$in": [R.SIGNAL_PROMO_DETECTED, R.SIGNAL_TOP_SALES_DETECTED]},
        }
        if source:
            match["source"] = source
        if watchlist_only:
            wl = await db.watchlists.find({"enabled": True}, {"_id": 0}).to_list(500)
            cats = list({w["category_key"] for w in wl})
            if not cats:
                return {"items": [], "count": 0}
            match["$or"] = [{"category": {"$in": cats}}, {"category_path": {"$in": cats}}]
        cursor = db.market_signals.find(match, {"_id": 0}).sort("captured_at", -1).limit(limit)
        items = await cursor.to_list(limit)
        return {"items": items, "count": len(items), "window_days": window_days}

    # ---------- Product Feed Intelligence ----------

    @router.get("/feed/products")
    async def product_feed(
        watchlist_only: bool = False,
        source: Optional[SourceType] = None,
        lifecycle: Optional[str] = Query(default=None),
        signal_kind: Optional[str] = Query(default=None),
        search: Optional[str] = None,
        limit: int = Query(default=50, ge=1, le=200),
    ):
        """Unified per-product feed with lifecycle + recent signals attached."""
        match: Dict[str, Any] = {}
        if source:
            match["source"] = source
        if search:
            match["title"] = {"$regex": search, "$options": "i"}
        if watchlist_only:
            wf = await _get_watchlist_filter()
            if wf:
                match = {"$and": [match, wf]} if match else wf

        pipeline = [
            {"$match": match},
            {"$sort": {"captured_at": -1}},
            {"$group": {"_id": "$product_key", "latest": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$latest"}},
            {"$limit": 1000},
        ]
        results: List[Dict[str, Any]] = []
        # batched signal lookup
        keys: List[str] = []
        latests: Dict[str, Dict[str, Any]] = {}
        async for d in db.products.aggregate(pipeline):
            pk = d.get("product_key")
            if not pk:
                continue
            keys.append(pk)
            latests[pk] = d
            if len(keys) >= 500:
                break

        # signals grouped by product_key (last 7 days)
        sigs_by_key: Dict[str, List[Dict[str, Any]]] = {}
        if keys:
            cur = db.market_signals.find(
                {"product_key": {"$in": keys},
                 "captured_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}},
                {"_id": 0},
            ).sort("captured_at", -1)
            async for s in cur:
                sigs_by_key.setdefault(s["product_key"], []).append(s)

        for pk in keys:
            latest = latests[pk]
            history = await _history_for(pk)
            life = compute_lifecycle(pk, latest, history)
            sigs = sigs_by_key.get(pk, [])[:5]
            if lifecycle and life["lifecycle_status"] != lifecycle:
                continue
            if signal_kind and not any(s["kind"] == signal_kind for s in sigs):
                continue
            results.append({**life, "signals": sigs})
            if len(results) >= limit:
                break
        return {"items": results, "count": len(results)}

    # ---------- Backfill ----------

    @router.post("/admin/backfill", dependencies=[Depends(require_extension_key)])
    async def backfill():
        """Recompute first/last_seen across products from price_snapshots history.

        Idempotent. Also re-emits NEW_PRODUCT signal for products that don't have one yet
        (so historical data benefits from lifecycle UI immediately).
        """
        keys = await db.price_snapshots.distinct("product_key")
        new_emitted = 0
        for pk in keys:
            cur = db.price_snapshots.find({"product_key": pk}, {"_id": 0}).sort("captured_at", 1)
            history = await cur.to_list(2000)
            if not history:
                continue
            first_seen = history[0]["captured_at"]
            last_seen = history[-1]["captured_at"]
            await db.products.update_many(
                {"product_key": pk},
                {"$set": {"first_seen_at": first_seen, "last_seen_at": last_seen}},
            )
            # If no NEW_PRODUCT signal exists for this product_key, emit one
            existing = await db.market_signals.count_documents(
                {"product_key": pk, "kind": R.SIGNAL_NEW_PRODUCT}
            )
            if existing == 0:
                latest_doc = await db.products.find_one(
                    {"product_key": pk}, {"_id": 0}, sort=[("captured_at", -1)]
                )
                if latest_doc:
                    sigs = build_signals_for_ingest(
                        latest_doc, history, is_first_seen=True, last_capture_before_now=None,
                    )
                    if sigs:
                        try:
                            await db.market_signals.insert_many(
                                [dict(s) for s in sigs], ordered=False
                            )
                            new_emitted += len([s for s in sigs if s["kind"] == R.SIGNAL_NEW_PRODUCT])
                        except Exception as e:
                            log.warning("backfill signal insert: %s", e)
        return {"ok": True, "products_updated": len(keys), "new_signals_emitted": new_emitted}

    return router
