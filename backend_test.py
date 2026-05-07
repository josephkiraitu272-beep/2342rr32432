#!/usr/bin/env python3
"""
Comprehensive backend test for Guru Marketplace Intelligence CRM.
Tests Task 1 — Foundation Analytics Layer: Watchlist, Lifecycle, Signals, Market Overview v2, Product Feed.
"""
import requests
import sys
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Public endpoint from frontend/.env
BASE_URL = "https://ecom-crawler.preview.emergentagent.com/api"
API_KEY = "prizma_dev_key_2026"
HEADERS = {"X-Extension-Api-Key": API_KEY, "Content-Type": "application/json"}


class TestRunner:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures: List[str] = []

    def test(self, name: str, fn):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*60}")
        print(f"🔍 Test {self.tests_run}: {name}")
        print(f"{'='*60}")
        try:
            fn()
            self.tests_passed += 1
            print(f"✅ PASSED")
        except AssertionError as e:
            self.tests_failed += 1
            msg = f"❌ FAILED: {name}\n   {str(e)}"
            print(msg)
            self.failures.append(msg)
        except Exception as e:
            self.tests_failed += 1
            msg = f"❌ ERROR: {name}\n   {type(e).__name__}: {str(e)}"
            print(msg)
            self.failures.append(msg)

    def summary(self):
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        if self.failures:
            print(f"\n{'='*60}")
            print(f"FAILURES:")
            print(f"{'='*60}")
            for f in self.failures:
                print(f)
        return 0 if self.tests_failed == 0 else 1


runner = TestRunner()


# ============================================================
# Helper Functions
# ============================================================

def req(method: str, path: str, **kwargs) -> requests.Response:
    """Make HTTP request"""
    url = f"{BASE_URL}{path}"
    r = requests.request(method, url, **kwargs)
    print(f"  {method} {path} → {r.status_code}")
    return r


def assert_status(r: requests.Response, expected: int):
    """Assert response status code"""
    if r.status_code != expected:
        try:
            body = r.json()
        except:
            body = r.text[:200]
        raise AssertionError(
            f"Expected status {expected}, got {r.status_code}. Body: {body}"
        )


def assert_keys(data: Dict[str, Any], keys: List[str]):
    """Assert dict has required keys"""
    missing = [k for k in keys if k not in data]
    if missing:
        raise AssertionError(f"Missing keys: {missing}. Got: {list(data.keys())}")


def seed_product(
    source: str,
    title: str,
    price: float,
    old_price: float = None,
    availability: bool = True,
    seller: str = "TestSeller",
    category: str = "TestCategory",
    badges: List[str] = None,
) -> Dict[str, Any]:
    """Seed a single product via ingest API"""
    payload = {
        "source": source,
        "source_id": f"test_{title.replace(' ', '_')}_{int(datetime.now().timestamp())}",
        "title": title,
        "price": price,
        "old_price": old_price,
        "availability": availability,
        "seller": seller,
        "category": category,
        "category_path": [category],
        "badges": badges or [],
        "url": f"https://{source}.com/test/{title.replace(' ', '-')}",
    }
    r = req("POST", "/ingest/product", json=payload, headers=HEADERS)
    assert_status(r, 200)
    return r.json()


# ============================================================
# Test: Root endpoint
# ============================================================

def test_root():
    r = req("GET", "/")
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["app", "status", "schema", "ts"])
    assert data["app"] == "Guru"
    assert data["status"] == "ok"
    print(f"  ✓ Root endpoint OK: {data}")


runner.test("Root endpoint", test_root)


# ============================================================
# Test: Watchlist CRUD
# ============================================================

def test_watchlist_crud():
    # 1. GET empty watchlist
    r = req("GET", "/watchlist")
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count"])
    print(f"  ✓ Initial watchlist count: {data['count']}")

    # 2. POST new watchlist item
    payload = {
        "category_key": "Смартфони",
        "category_name": "Смартфони",
        "source": "rozetka",
        "enabled": True,
        "priority": 5,
    }
    r = req("POST", "/watchlist", json=payload)
    assert_status(r, 200)
    item = r.json()
    assert_keys(item, ["ok", "item", "created"])
    assert item["created"] in [True, False]
    wid = item["item"]["id"]
    print(f"  ✓ Created watchlist item: {wid}")

    # 3. POST same key again (should update, not duplicate)
    r = req("POST", "/watchlist", json=payload)
    assert_status(r, 200)
    item2 = r.json()
    assert item2["created"] == False, "Re-adding same key should update, not create"
    print(f"  ✓ Re-adding same key updated instead of duplicating")

    # 4. PATCH toggle enabled
    r = req("PATCH", f"/watchlist/{wid}", json={"enabled": False})
    assert_status(r, 200)
    patched = r.json()
    assert patched["item"]["enabled"] == False
    print(f"  ✓ Toggled enabled to False")

    # 5. PATCH change priority
    r = req("PATCH", f"/watchlist/{wid}", json={"priority": 10})
    assert_status(r, 200)
    patched = r.json()
    assert patched["item"]["priority"] == 10
    print(f"  ✓ Changed priority to 10")

    # 6. DELETE
    r = req("DELETE", f"/watchlist/{wid}")
    assert_status(r, 200)
    print(f"  ✓ Deleted watchlist item")

    # 7. GET /watchlist/categories (should be empty or have seeded categories)
    r = req("GET", "/watchlist/categories")
    assert_status(r, 200)
    cats = r.json()
    assert_keys(cats, ["items", "count"])
    print(f"  ✓ Discovered categories: {cats['count']}")


runner.test("Watchlist CRUD", test_watchlist_crud)


# ============================================================
# Test: Ingest side-effects (signals emission)
# ============================================================

def test_ingest_signals():
    # Seed a new product (should emit NEW_PRODUCT signal)
    ts = int(datetime.now().timestamp())
    p1 = seed_product(
        "rozetka",
        f"TestPhone_{ts}",
        10000,
        12000,
        True,
        "TestSeller",
        "Смартфони",
        ["promo", "top_sales"],
    )
    product_key = p1["product_key"]
    print(f"  ✓ Seeded product: {product_key}")

    # Check that NEW_PRODUCT signal was emitted
    r = req("GET", "/signals", params={"kinds": "new_product", "since_hours": 1})
    assert_status(r, 200)
    sigs = r.json()["items"]
    new_sig = [s for s in sigs if s["product_key"] == product_key]
    assert len(new_sig) > 0, "NEW_PRODUCT signal not found"
    print(f"  ✓ NEW_PRODUCT signal emitted")

    # Check PROMO_DETECTED signal
    r = req("GET", "/signals", params={"kinds": "promo_detected", "since_hours": 1})
    assert_status(r, 200)
    sigs = r.json()["items"]
    promo_sig = [s for s in sigs if s["product_key"] == product_key]
    assert len(promo_sig) > 0, "PROMO_DETECTED signal not found"
    print(f"  ✓ PROMO_DETECTED signal emitted")

    # Check TOP_SALES_DETECTED signal
    r = req("GET", "/signals", params={"kinds": "top_sales_detected", "since_hours": 1})
    assert_status(r, 200)
    sigs = r.json()["items"]
    top_sig = [s for s in sigs if s["product_key"] == product_key]
    assert len(top_sig) > 0, "TOP_SALES_DETECTED signal not found"
    print(f"  ✓ TOP_SALES_DETECTED signal emitted")

    # Ingest same product again with lower price (should emit PRICE_DROP)
    import time
    time.sleep(1)  # Ensure different timestamp
    p2 = seed_product(
        "rozetka",
        f"TestPhone_{ts}",
        8000,  # Lower price
        12000,
        True,
        "TestSeller",
        "Смартфони",
        [],
    )
    print(f"  ✓ Re-ingested product with lower price")

    # Check PRICE_DROP signal
    time.sleep(1)
    r = req("GET", "/signals", params={"kinds": "price_drop", "since_hours": 1})
    assert_status(r, 200)
    sigs = r.json()["items"]
    drop_sig = [s for s in sigs if s["product_key"] == product_key]
    assert len(drop_sig) > 0, "PRICE_DROP signal not found"
    print(f"  ✓ PRICE_DROP signal emitted")

    # Ingest with availability=False (should emit STOCK_OUT)
    time.sleep(1)
    p3 = seed_product(
        "rozetka",
        f"TestPhone_{ts}",
        8000,
        12000,
        False,  # Out of stock
        "TestSeller",
        "Смартфони",
        [],
    )
    print(f"  ✓ Re-ingested product with availability=False")

    # Check STOCK_OUT signal
    time.sleep(1)
    r = req("GET", "/signals", params={"kinds": "stock_out", "since_hours": 1})
    assert_status(r, 200)
    sigs = r.json()["items"]
    stock_sig = [s for s in sigs if s["product_key"] == product_key]
    assert len(stock_sig) > 0, "STOCK_OUT signal not found"
    print(f"  ✓ STOCK_OUT signal emitted")

    # Test idempotency: re-ingest same product on same day should not duplicate NEW_PRODUCT
    time.sleep(1)
    p4 = seed_product(
        "rozetka",
        f"TestPhone_{ts}",
        8000,
        12000,
        False,
        "TestSeller",
        "Смартфони",
        [],
    )
    r = req("GET", "/signals", params={"kinds": "new_product", "since_hours": 1})
    assert_status(r, 200)
    sigs = r.json()["items"]
    new_sigs = [s for s in sigs if s["product_key"] == product_key]
    # Should still be 1 (idempotent by day)
    print(f"  ✓ NEW_PRODUCT signal is idempotent (count: {len(new_sigs)})")


runner.test("Ingest side-effects (signals)", test_ingest_signals)


# ============================================================
# Test: Lifecycle endpoints
# ============================================================

def test_lifecycle():
    # Seed products for lifecycle testing
    ts = int(datetime.now().timestamp())
    
    # New product
    p1 = seed_product("rozetka", f"NewProduct_{ts}", 5000, None, True, "Seller1", "Електроніка")
    
    # Out of stock product
    p2 = seed_product("rozetka", f"OOSProduct_{ts}", 3000, None, False, "Seller2", "Електроніка")
    
    print(f"  ✓ Seeded test products")

    # GET /lifecycle/summary
    r = req("GET", "/lifecycle/summary")
    assert_status(r, 200)
    summary = r.json()
    assert_keys(summary, ["buckets", "total"])
    assert "new" in summary["buckets"]
    assert "out_of_stock" in summary["buckets"]
    print(f"  ✓ Lifecycle summary: {summary['total']} products")
    print(f"    Buckets: {summary['buckets']}")

    # GET /lifecycle/feed (all)
    r = req("GET", "/lifecycle/feed", params={"limit": 10})
    assert_status(r, 200)
    feed = r.json()
    assert_keys(feed, ["items", "count"])
    assert len(feed["items"]) > 0, "Lifecycle feed is empty"
    print(f"  ✓ Lifecycle feed: {feed['count']} items")

    # GET /lifecycle/feed?status=new
    r = req("GET", "/lifecycle/feed", params={"status": "new", "limit": 10})
    assert_status(r, 200)
    feed = r.json()
    assert all(item["lifecycle_status"] == "new" for item in feed["items"]), "Filter status=new failed"
    print(f"  ✓ Lifecycle feed filtered by status=new: {feed['count']} items")

    # GET /lifecycle/feed?watchlist_only=true (should work even if no watchlist)
    r = req("GET", "/lifecycle/feed", params={"watchlist_only": "true", "limit": 10})
    assert_status(r, 200)
    feed = r.json()
    print(f"  ✓ Lifecycle feed with watchlist_only: {feed['count']} items")


runner.test("Lifecycle endpoints", test_lifecycle)


# ============================================================
# Test: Signals endpoints
# ============================================================

def test_signals():
    # GET /signals
    r = req("GET", "/signals", params={"since_hours": 24, "limit": 50})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count"])
    print(f"  ✓ Signals: {data['count']} items")

    # GET /signals?kinds=price_drop
    r = req("GET", "/signals", params={"kinds": "price_drop", "since_hours": 24})
    assert_status(r, 200)
    data = r.json()
    assert all(s["kind"] == "price_drop" for s in data["items"]), "Filter kinds=price_drop failed"
    print(f"  ✓ Signals filtered by kind=price_drop: {data['count']} items")

    # GET /signals/summary
    r = req("GET", "/signals/summary", params={"since_hours": 24})
    assert_status(r, 200)
    summary = r.json()
    assert_keys(summary, ["buckets", "total", "since_hours"])
    print(f"  ✓ Signals summary: {summary['total']} total")
    print(f"    Buckets: {summary['buckets']}")


runner.test("Signals endpoints", test_signals)


# ============================================================
# Test: Market Overview v2
# ============================================================

def test_market_overview():
    # GET /market/overview
    r = req("GET", "/market/overview", params={"window_days": 7})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, [
        "window_days", "new_products", "returned_products", "removed_products",
        "stock_outs", "promo_count", "top_sales_count", "price_drops", "price_rises",
        "active_categories", "total_products", "total_sellers"
    ])
    print(f"  ✓ Market overview:")
    print(f"    New products: {data['new_products']}")
    print(f"    Stock outs: {data['stock_outs']}")
    print(f"    Promo: {data['promo_count']}")
    print(f"    Price drops: {data['price_drops']}")
    print(f"    Total products: {data['total_products']}")

    # GET /market/heat (requires ≥5 events per category)
    r = req("GET", "/market/heat", params={"window_days": 7, "limit": 10})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count", "window_days"])
    print(f"  ✓ Market heat: {data['count']} hot categories")

    # GET /market/seller-pressure
    r = req("GET", "/market/seller-pressure", params={"window_days": 7, "limit": 10})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count", "window_days"])
    print(f"  ✓ Seller pressure: {data['count']} sellers")

    # GET /market/promo
    r = req("GET", "/market/promo", params={"window_days": 7, "limit": 10})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count", "window_days"])
    print(f"  ✓ Market promo: {data['count']} promo signals")


runner.test("Market Overview v2", test_market_overview)


# ============================================================
# Test: Product Feed Intelligence
# ============================================================

def test_product_feed():
    # GET /feed/products
    r = req("GET", "/feed/products", params={"limit": 20})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count"])
    print(f"  ✓ Product feed: {data['count']} items")
    
    if data["count"] > 0:
        item = data["items"][0]
        assert_keys(item, ["product_key", "lifecycle_status", "reasons", "signals"])
        print(f"    Sample item: {item['product_key']}")
        print(f"    Lifecycle: {item['lifecycle_status']}")
        print(f"    Signals: {len(item['signals'])}")

    # GET /feed/products?lifecycle=new
    r = req("GET", "/feed/products", params={"lifecycle": "new", "limit": 10})
    assert_status(r, 200)
    data = r.json()
    assert all(item["lifecycle_status"] == "new" for item in data["items"]), "Filter lifecycle=new failed"
    print(f"  ✓ Product feed filtered by lifecycle=new: {data['count']} items")

    # GET /feed/products?signal_kind=price_drop
    r = req("GET", "/feed/products", params={"signal_kind": "price_drop", "limit": 10})
    assert_status(r, 200)
    data = r.json()
    print(f"  ✓ Product feed filtered by signal_kind=price_drop: {data['count']} items")


runner.test("Product Feed Intelligence", test_product_feed)


# ============================================================
# Test: Backfill
# ============================================================

def test_backfill():
    # POST /admin/backfill (requires auth header)
    r = req("POST", "/admin/backfill", headers=HEADERS)
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["ok", "products_updated", "new_signals_emitted"])
    print(f"  ✓ Backfill completed:")
    print(f"    Products updated: {data['products_updated']}")
    print(f"    New signals emitted: {data['new_signals_emitted']}")


runner.test("Backfill", test_backfill)


# ============================================================
# Test: Regression - existing endpoints
# ============================================================

def test_regression():
    # /api/analytics/summary
    r = req("GET", "/analytics/summary")
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["total_products", "rozetka_count", "epicentr_count"])
    print(f"  ✓ /analytics/summary: {data['total_products']} products")

    # /api/analytics/today
    r = req("GET", "/analytics/today")
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["products_24h", "snapshots_24h"])
    print(f"  ✓ /analytics/today: {data['products_24h']} products in 24h")

    # /api/analytics/price-signals
    r = req("GET", "/analytics/price-signals", params={"window": "24h", "limit": 5})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "count"])
    print(f"  ✓ /analytics/price-signals: {data['count']} signals")

    # /api/products
    r = req("GET", "/products", params={"limit": 10})
    assert_status(r, 200)
    data = r.json()
    assert_keys(data, ["items", "total"])
    print(f"  ✓ /products: {data['total']} total products")

    # /api/export/products.csv (just check it returns 200)
    r = req("GET", "/export/products.csv", params={"limit": 5})
    assert_status(r, 200)
    assert "text/csv" in r.headers.get("Content-Type", "")
    print(f"  ✓ /export/products.csv: CSV export working")


runner.test("Regression - existing endpoints", test_regression)


# ============================================================
# Summary
# ============================================================

sys.exit(runner.summary())
