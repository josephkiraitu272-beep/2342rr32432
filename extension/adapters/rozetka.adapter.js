// Guru Rozetka adapter — DOM parser with multi-selector resilience.
(function () {
    if (window.GuruRozetkaAdapter) return;
    const C = window.GuruCommon || window.PrizmaCommon;
    const Sel = window.GuruSel;
    const Base = window.GuruBaseAdapter;

    // Tile-level selector candidates (most specific → most generic)
    const TILE_SELECTORS = [
        "rz-catalog-tile",
        ".goods-tile",
        ".catalog-tile",
        "[data-goods-id]",
        "li.catalog-grid__cell",
        "div.tile",
    ];
    const TITLE_LINK_SELECTORS = [
        "a.goods-tile__heading",
        "a.tile-title__link",
        "a.product-link",
        "a[href*='/p'][title]",
        "a[href*='/p']",
    ];
    const TITLE_TEXT_SELECTORS = [
        ".goods-tile__title",
        ".tile-title__text",
        "[data-test-id='title-list']",
        "span.goods-tile__title",
        "[class*='title']",
    ];
    const STARS_SELECTORS = [
        ".goods-tile__stars",
        ".star-rating",
        "[class*='rating']",
    ];
    const REVIEWS_SELECTORS = [
        "a[href*='/comments']",
        ".goods-tile__reviews-link",
        "[class*='reviews']",
    ];
    const IMG_SELECTORS = [
        "img.goods-tile__picture",
        "picture img.lazy-img",
        "picture img",
        "img.tile-image",
        "img",
    ];
    const BREADCRUMB_SELECTORS = [
        "rz-breadcrumbs li",
        ".breadcrumbs__item",
        "nav[class*='breadcrumb'] a",
        "[itemprop='itemListElement']",
    ];
    const PROD_TITLE_SELECTORS = [
        "h1.product__title",
        "h1[class*='product']",
        "h1",
    ];
    const PROD_PRICE_SELECTORS = [
        ".product-prices__big",
        ".product-price__big-value",
        ".product-price__big",
        "p.product-price__big",
        "[class*='price__big']",
    ];
    const PROD_OLDPRICE_SELECTORS = [
        ".product-prices__small-a",
        ".product-price__small",
        ".product-prices__small",
        "[class*='price__small']",
        "del",
    ];
    const PROD_SELLER_SELECTORS = [
        ".product__seller-link",
        "[class*='merchant__name']",
        ".rz-seller__name",
        "[class*='seller__name']",
    ];
    const PROD_IMG_SELECTORS = [
        "img.picture-container__picture",
        ".product-photo__main img",
        "meta[property='og:image']",
    ];

    class RozetkaAdapter extends Base {
        constructor() {
            super("rozetka");
        }

        detect() {
            if (/\/p\d+\//i.test(location.pathname)) return "product";
            if (this.getTiles().length >= 3) return "listing";
            if (/\/(c\d+|search)/i.test(location.pathname)) return "listing";
            return null;
        }

        getTiles() {
            // Try canonical tile selectors first
            for (const s of TILE_SELECTORS) {
                const tiles = document.querySelectorAll(s);
                if (tiles.length >= 3) return Array.from(tiles);
            }
            // Fallback: anchor-based discovery
            const links = document.querySelectorAll("a[href*='/p'][href*='rozetka.com.ua']");
            const set = new Set();
            links.forEach((a) => {
                const tile =
                    Sel.closest(a, ...TILE_SELECTORS, "li", "article") || a;
                set.add(tile);
            });
            return Array.from(set);
        }

        extractBreadcrumbs() {
            const out = [];
            for (const s of BREADCRUMB_SELECTORS) {
                document.querySelectorAll(s).forEach((b) => {
                    const txt = (b.textContent || "").trim();
                    if (txt && txt.length < 80 && !out.includes(txt)) out.push(txt);
                });
                if (out.length) break;
            }
            return out;
        }

        parseTile(tile, idx) {
            const link = Sel.q(tile, ...TITLE_LINK_SELECTORS);
            const url = C.absoluteUrl(link?.getAttribute("href"));
            const title =
                link?.getAttribute("title") ||
                Sel.text(tile, ...TITLE_TEXT_SELECTORS) ||
                (link ? (link.textContent || "").trim() : null);

            const { price, old_price } = C.pickPrices(tile);

            // Rating from style width or aria
            let rating = null;
            const starWrap = Sel.q(tile, ...STARS_SELECTORS);
            if (starWrap) {
                const inner = starWrap.querySelector("[style*='width']");
                const styleStr =
                    inner?.getAttribute("style") || starWrap.getAttribute("style") || "";
                const m = styleStr.match(/width:\s*(\d+(?:\.\d+)?)%/);
                if (m) rating = Math.round((parseFloat(m[1]) / 100) * 5 * 10) / 10;
            }

            const reviewsEl = Sel.q(tile, ...REVIEWS_SELECTORS);
            const reviewsCount =
                parseInt((reviewsEl?.textContent || "").replace(/\D/g, "")) || null;

            const imgEl = Sel.q(tile, ...IMG_SELECTORS);
            const img = imgEl?.src || imgEl?.getAttribute("data-src") || null;

            // Badge inference (text-based, language-agnostic via patterns)
            const wholeText = (tile.textContent || "").toLowerCase();
            const badges = new Set();
            if (/реклам/i.test(wholeText)) badges.add("ad");
            if (/топ.{0,5}прода/i.test(wholeText)) badges.add("top_sales");
            if (/акці|знижк/i.test(wholeText)) badges.add("promo");
            if (/вибір\s*rozetka/i.test(tile.textContent || "")) badges.add("rozetka_choice");
            if (/готов.{0,3}до.{0,3}відправк/i.test(tile.textContent || ""))
                badges.add("ready_to_ship");

            const externalIdMatch = url ? url.match(/\/p(\d+)\//) : null;
            const sourceId = externalIdMatch ? externalIdMatch[1] : null;

            if (!title || !url) return null;

            return {
                source: this.source,
                source_id: sourceId,
                title,
                price,
                old_price,
                currency: "UAH",
                availability:
                    !Sel.q(tile, ".status-label--gray", ".status-label--red") &&
                    !/закінчився|немає в наявності/i.test(wholeText),
                rating,
                reviews_count: reviewsCount,
                category_path: this.extractBreadcrumbs(),
                badges: Array.from(badges),
                image: img,
                images: img ? [img] : [],
                url,
                position: idx + 1,
                listing_url: location.href,
            };
        }

        parseListing() {
            const tiles = this.getTiles();
            return tiles
                .map((t, i) => this.parseTile(t, i))
                .filter(Boolean);
        }

        parseProduct() {
            const title =
                Sel.text(document, ...PROD_TITLE_SELECTORS) || document.title;
            const priceText = Sel.text(document, ...PROD_PRICE_SELECTORS);
            const oldPriceText = Sel.text(document, ...PROD_OLDPRICE_SELECTORS);
            const seller = Sel.text(document, ...PROD_SELLER_SELECTORS);

            const ratingEl = Sel.q(document, ...STARS_SELECTORS);
            const ratingStyle = ratingEl?.getAttribute("style") || "";
            const ratingMatch = ratingStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
            const rating = ratingMatch
                ? Math.round((parseFloat(ratingMatch[1]) / 100) * 5 * 10) / 10
                : null;

            const reviewsEl = Sel.q(
                document,
                ".product-tabs__link--comment",
                "[href*='/comments']",
            );
            const reviewsCount =
                parseInt((reviewsEl?.textContent || "").replace(/\D/g, "")) || null;

            const imgEl = Sel.q(document, ...PROD_IMG_SELECTORS);
            const img =
                imgEl?.src ||
                imgEl?.getAttribute?.("content") ||
                Sel.attr(document, "meta[property='og:image']", "content") ||
                null;

            const externalIdMatch = location.pathname.match(/\/p(\d+)\//);
            const price = C.toNumber(priceText);
            const oldPrice = C.toNumber(oldPriceText);

            return {
                source: this.source,
                source_id: externalIdMatch ? externalIdMatch[1] : null,
                title,
                price,
                old_price: oldPrice,
                currency: "UAH",
                availability: !!Sel.q(document, ".status-label--green", ".product__status--green"),
                seller,
                rating,
                reviews_count: reviewsCount,
                category_path: this.extractBreadcrumbs(),
                badges: [],
                image: img,
                images: img ? [img] : [],
                url: location.href,
                listing_url: null,
            };
        }

        injectInlineBadges(tiles, items) {
            tiles.forEach((tile, idx) => {
                if (tile.querySelector(".guru-badge")) return;
                const item = items[idx];
                if (!item) return;
                const titleEl =
                    Sel.q(tile, ...TITLE_TEXT_SELECTORS) || Sel.q(tile, "a[href*='/p']");
                if (!titleEl) return;
                const wrapper = document.createElement("div");
                wrapper.style.cssText =
                    "display:flex; gap:4px; flex-wrap:wrap; margin:4px 0;";
                const rank = document.createElement("span");
                rank.className = "guru-badge b-rank";
                rank.textContent = `#${item.position}`;
                wrapper.appendChild(rank);
                (item.badges || []).forEach((b) => {
                    const span = document.createElement("span");
                    span.className =
                        "guru-badge " +
                        (b === "ad" ? "b-ad" : b === "top_sales" ? "b-top" : "b-fulfilled");
                    span.textContent =
                        b === "ad"
                            ? "Реклама"
                            : b === "top_sales"
                              ? "Топ"
                              : b === "promo"
                                ? "Акція"
                                : b;
                    wrapper.appendChild(span);
                });
                try {
                    titleEl.parentElement?.insertBefore(wrapper, titleEl);
                } catch (e) {}
            });
        }
    }

    window.GuruRozetkaAdapter = RozetkaAdapter;
})();
