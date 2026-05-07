"""
Backend regression tests for Призма (Prizma) ingest & analytics API.
Covers: root, auth enforcement, ingest endpoints, products listing, analytics, pages, CORS, _id leak, discount calc.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL_TEST") or "https://price-scraper-8.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
EXT_KEY = "prizma_dev_key_2026"
H_AUTH = {"X-Extension-Api-Key": EXT_KEY}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- root ----------
class TestRoot:
    def test_root_ok(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok"
        assert d.get("app") == "Prizma"
        assert "ts" in d


# ---------- auth ----------
class TestAuthEnforcement:
    def test_extension_health_no_key(self, client):
        r = client.get(f"{API}/extension/health")
        assert r.status_code == 401

    def test_extension_health_wrong_key(self, client):
        r = client.get(f"{API}/extension/health", headers={"X-Extension-Api-Key": "wrong"})
        assert r.status_code == 401

    def test_extension_health_ok(self, client):
        r = client.get(f"{API}/extension/health", headers=H_AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert "server_time" in d

    @pytest.mark.parametrize("path,payload", [
        ("/ingest/product", {"source": "rozetka", "title": "x", "product_url": "http://x"}),
        ("/ingest/products", {"items": []}),
        ("/ingest/page", {"source": "rozetka", "url": "http://x"}),
        ("/ingest/cf-session", {"user_agent": "ua"}),
    ])
    def test_ingest_requires_key(self, client, path, payload):
        r = client.post(f"{API}{path}", json=payload)
        assert r.status_code == 401, f"{path} should reject without key"

        r2 = client.post(f"{API}{path}", json=payload, headers={"X-Extension-Api-Key": "bad"})
        assert r2.status_code == 401, f"{path} should reject with wrong key"


# ---------- ingest ----------
class TestIngest:
    def test_ingest_single_product(self, client):
        payload = {
            "source": "rozetka",
            "external_id": "TEST_ID_1",
            "title": "TEST_Product Solo",
            "price": 800.0,
            "old_price": 1000.0,
            "currency": "UAH",
            "seller": "TEST_Seller_A",
            "badges": ["top_sales"],
            "product_url": "https://rozetka.com.ua/test/p1",
            "listing_url": "https://rozetka.com.ua/test/",
        }
        r = client.post(f"{API}/ingest/product", json=payload, headers=H_AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert isinstance(d["id"], str) and len(d["id"]) > 0

    def test_ingest_products_batch(self, client):
        items = [
            {
                "source": "rozetka",
                "external_id": f"TEST_BATCH_{i}",
                "title": f"TEST_Batch Item {i}",
                "price": 100.0 + i,
                "old_price": 150.0 + i,
                "seller": "TEST_Seller_B",
                "badges": ["promo"] if i % 2 else ["ad"],
                "product_url": f"https://rozetka.com.ua/test/b{i}",
                "position": i,
            }
            for i in range(3)
        ] + [
            {
                "source": "epicentr",
                "external_id": "TEST_EP_1",
                "title": "TEST_Epicentr Item",
                "price": 250.0,
                "old_price": 300.0,
                "seller": "TEST_Epi_Seller",
                "badges": ["fulfilled"],
                "product_url": "https://epicentrk.ua/ua/test/e1/",
            }
        ]
        payload = {"items": items, "listing_url": "https://rozetka.com.ua/test/", "listing_title": "TEST listing"}
        r = client.post(f"{API}/ingest/products", json=payload, headers=H_AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["inserted"] == 4
        assert isinstance(d["ids"], list) and len(d["ids"]) == 4

    def test_ingest_products_empty(self, client):
        r = client.post(f"{API}/ingest/products", json={"items": []}, headers=H_AUTH)
        assert r.status_code == 200
        assert r.json()["inserted"] == 0

    def test_ingest_page(self, client):
        payload = {
            "source": "rozetka",
            "url": "https://rozetka.com.ua/test/listing/",
            "title": "TEST listing",
            "category": "Test",
            "category_path": ["Root", "Test"],
            "products_count": 4,
            "avg_price": 250.0,
            "min_price": 100.0,
            "max_price": 800.0,
            "badge_distribution": {"top_sales": 1, "promo": 2, "ad": 1},
            "seller_distribution": {"TEST_Seller_A": 1, "TEST_Seller_B": 3},
        }
        r = client.post(f"{API}/ingest/page", json=payload, headers=H_AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert isinstance(d["id"], str)

    def test_ingest_cf_session(self, client):
        payload = {
            "user_agent": "Mozilla/5.0 TEST",
            "cf_clearance": "TEST_clearance_token_xyz",
            "cf_bm": "TEST_bm",
            "extra_cookies": {"foo": "bar"},
        }
        r = client.post(f"{API}/ingest/cf-session", json=payload, headers=H_AUTH)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_ingest_validation_error(self, client):
        # missing required title and product_url
        r = client.post(f"{API}/ingest/product", json={"source": "rozetka"}, headers=H_AUTH)
        assert r.status_code == 422


# ---------- products listing ----------
class TestProducts:
    def test_list_products_default(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d
        assert isinstance(d["items"], list)
        # _id must not leak
        for it in d["items"]:
            assert "_id" not in it
            assert "id" in it
            assert "captured_at" in it

    def test_list_products_filter_source(self, client):
        r = client.get(f"{API}/products", params={"source": "rozetka", "limit": 20})
        assert r.status_code == 200
        d = r.json()
        for it in d["items"]:
            assert it["source"] == "rozetka"

    def test_list_products_search(self, client):
        r = client.get(f"{API}/products", params={"search": "TEST_Batch"})
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 3
        for it in d["items"]:
            assert "test_batch" in it["title"].lower()

    def test_list_products_pagination(self, client):
        r = client.get(f"{API}/products", params={"limit": 2, "skip": 0})
        assert r.status_code == 200
        d = r.json()
        assert d["limit"] == 2
        assert len(d["items"]) <= 2

    def test_discount_percent_calculated(self, client):
        # find one of our TEST_Batch items where price=100, old_price=150 -> ~33.3%
        r = client.get(f"{API}/products", params={"search": "TEST_Batch Item 0"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        item = items[0]
        assert item.get("discount_percent") is not None
        # 1 - 100/150 = 0.3333 -> 33.3
        assert abs(item["discount_percent"] - 33.3) < 0.5

    def test_discount_none_when_no_old_price(self, client):
        # ingest without old_price
        payload = {
            "source": "epicentr",
            "title": "TEST_NoOldPrice",
            "price": 500.0,
            "product_url": "https://epicentrk.ua/test/nop",
        }
        r = client.post(f"{API}/ingest/product", json=payload, headers=H_AUTH)
        assert r.status_code == 200
        r2 = client.get(f"{API}/products", params={"search": "TEST_NoOldPrice"})
        items = r2.json()["items"]
        assert len(items) >= 1
        assert items[0].get("discount_percent") is None


# ---------- analytics ----------
class TestAnalytics:
    def test_summary(self, client):
        r = client.get(f"{API}/analytics/summary")
        assert r.status_code == 200
        d = r.json()
        for key in ("total_products", "rozetka_count", "epicentr_count",
                    "captured_last_24h", "pages_collected", "by_source",
                    "badge_distribution", "ts"):
            assert key in d, f"missing key {key}"
        assert d["total_products"] >= d["rozetka_count"]
        assert isinstance(d["by_source"], dict)
        # Ensure inserted test data is reflected
        assert d["total_products"] >= 5

    def test_top_sellers(self, client):
        r = client.get(f"{API}/analytics/top-sellers", params={"limit": 5})
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list)
        if d["items"]:
            row = d["items"][0]
            for key in ("seller", "products", "avg_price", "sources"):
                assert key in row
            assert isinstance(row["sources"], list)

    def test_top_sellers_filter_source(self, client):
        r = client.get(f"{API}/analytics/top-sellers", params={"source": "epicentr"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert "epicentr" in it["sources"]

    def test_source_distribution(self, client):
        r = client.get(f"{API}/analytics/source-distribution")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d
        labels = [it["label"] for it in d["items"]]
        for expected in ("Топ продажів", "Реклама", "Rozetka власні", "Фулфілмент", "Інші"):
            assert expected in labels, f"missing canonical bucket: {expected}"
        for it in d["items"]:
            assert it["value"] >= 0


# ---------- pages ----------
class TestPages:
    def test_list_pages(self, client):
        r = client.get(f"{API}/pages")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "count" in d
        assert isinstance(d["items"], list)
        for p in d["items"]:
            assert "_id" not in p
            assert p.get("source") in ("rozetka", "epicentr")


# ---------- CORS ----------
class TestCORS:
    def test_cors_preflight_ingest(self, client):
        r = client.options(
            f"{API}/ingest/products",
            headers={
                "Origin": "https://rozetka.com.ua",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-extension-api-key",
            },
        )
        # Either 200 or 204 is acceptable for preflight
        assert r.status_code in (200, 204)
        allow_origin = r.headers.get("access-control-allow-origin", "")
        assert allow_origin in ("*", "https://rozetka.com.ua"), f"unexpected ACAO: {allow_origin}"

    def test_cors_actual_post_origin_header(self, client):
        r = client.post(
            f"{API}/ingest/products",
            json={"items": []},
            headers={**H_AUTH, "Origin": "https://rozetka.com.ua"},
        )
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") in ("*", "https://rozetka.com.ua")
