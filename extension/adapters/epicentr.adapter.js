// Guru Epicentr adapter — Nuxt SSR + dataLayer + DOM with multi-selector resilience.
(function () {
    if (window.GuruEpicentrAdapter) return;
    const C = window.GuruCommon || window.PrizmaCommon;
    const Sel = window.GuruSel;
    const Base = window.GuruBaseAdapter;

    const TILE_SELECTORS = [
        "[data-product-id]",
        "[class*='product-card']",
        ".product-card",
        "li.product-tile",
        ".card-product",
        "div._n9MDvqOu",
        "article[class*='product']",
    ];
    const TILE_LINK_SELECTOR = "a[href*='/shop/'][href$='.html']";
    const TITLE_TEXT_SELECTORS = [
        "[class*='product-card__title']",
        "[class*='card-title']",
        "[class*='title']",
        "h3",
        "h4",
        "p",
    ];
    const PRICE_SELECTORS = [
        "[class*='current-price']",
        "[class*='price__current']",
        "[class*='price']",
    ];
    const BREADCRUMB_SELECTORS = [
        "[itemprop='itemListElement'] [itemprop='name']",
        "[class*='breadcrumb'] a",
        "[class*='breadcrumb'] span",
    ];

    class EpicentrAdapter extends Base {
        constructor() {
            super("epicentr");
        }

        detect() {
            if (/\.html(\?|$)/.test(location.pathname)) return "product";
            if (this.getTiles().length >= 3 && location.pathname.includes("/shop/"))
                return "listing";
            return null;
        }

        getTiles() {
            for (const s of TILE_SELECTORS) {
                const tiles = document.querySelectorAll(s);
                if (tiles.length >= 3) return Array.from(tiles);
            }
            const links = document.querySelectorAll(TILE_LINK_SELECTOR);
            const set = new Set();
            links.forEach((a) => {
                const tile =
                    Sel.closest(a, ...TILE_SELECTORS, "li", "article") || a;
                set.add(tile);
            });
            return Array.from(set);
        }

        getDataLayerProduct() {
            // Epicentr SSR injects: dataLayer.push({ pageType: "ProductPage", productId, productName, productPrice, vendorId, vendorName, ... })
            const html = document.documentElement.innerHTML;
            const m = html.match(
                /dataLayer\.push\(\s*\{[^}]*"pageType"\s*:\s*"ProductPage"[^}]*\}/,
            );
            if (!m) return null;
            try {
                const cleaned = m[0]
                    .replace(/^dataLayer\.push\(\s*/, "")
                    .replace(/\)$/, "");
                return JSON.parse(cleaned);
            } catch (e) {
                return null;
            }
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
            const link = tile.matches?.(TILE_LINK_SELECTOR)
                ? tile
                : Sel.q(tile, TILE_LINK_SELECTOR);
            const url = C.absoluteUrl(link?.getAttribute("href"));
            const title =
                link?.getAttribute("title") ||
                Sel.text(tile, ...TITLE_TEXT_SELECTORS) ||
                (link ? (link.textContent || "").trim() : null);
            const { price, old_price } = C.pickPrices(tile);
            const imgEl = Sel.q(tile, "img");
            const img = imgEl?.src || imgEl?.getAttribute?.("data-src") || null;

            const externalIdMatch = url ? url.match(/-(\d{6,})\.html/) : null;
            const sourceId = externalIdMatch ? externalIdMatch[1] : null;

            if (!title || !url) return null;
            // Skip non-product entries: banners/category cards.
            if (!price && !old_price && !img) return null;
            if (!price && title.length < 15) return null;

            const wholeText = (tile.textContent || "").toLowerCase();
            const badges = [];
            if (/реклам/i.test(wholeText)) badges.push("ad");
            if (/топ.{0,5}прода|хіт/i.test(wholeText)) badges.push("top_sales");
            if (/акці|знижк/i.test(wholeText)) badges.push("promo");

            return {
                source: this.source,
                source_id: sourceId,
                title,
                price,
                old_price,
                currency: "UAH",
                availability: !/немає в наявності|закінч/i.test(wholeText),
                category_path: this.extractBreadcrumbs(),
                badges,
                image: img,
                images: img ? [img] : [],
                url,
                position: idx + 1,
                listing_url: location.href,
            };
        }

        parseListing() {
            const tiles = this.getTiles();
            return tiles.map((t, i) => this.parseTile(t, i)).filter(Boolean);
        }

        parseProduct() {
            const dl = this.getDataLayerProduct();
            const ogTitle = Sel.attr(document, "meta[property='og:title']", "content");
            const ogImage = Sel.attr(document, "meta[property='og:image']", "content");
            const breadcrumbs = this.extractBreadcrumbs();
            const title = dl?.productName || ogTitle || document.title;
            const price =
                typeof dl?.productPrice === "number"
                    ? dl.productPrice
                    : C.toNumber(Sel.text(document, ...PRICE_SELECTORS));

            return {
                source: this.source,
                source_id: dl?.productId ? String(dl.productId) : null,
                title,
                price,
                old_price: null,
                currency: "UAH",
                availability:
                    typeof dl?.productAvailable === "boolean" ? dl.productAvailable : null,
                seller: dl?.vendorName || null,
                seller_id: dl?.vendorId ? String(dl.vendorId) : null,
                category: dl?.categoryName || null,
                category_path: breadcrumbs,
                badges: [],
                image: ogImage,
                images: ogImage ? [ogImage] : [],
                url: location.href,
                listing_url: null,
                raw_data: dl ? { dataLayer: dl } : null,
            };
        }

        injectInlineBadges(tiles, items) {
            tiles.forEach((tile, idx) => {
                if (tile.querySelector(".guru-badge")) return;
                const item = items[idx];
                if (!item) return;
                const titleEl = Sel.q(tile, ...TITLE_TEXT_SELECTORS);
                if (!titleEl) return;
                const wrapper = document.createElement("div");
                wrapper.style.cssText =
                    "display:flex; gap:4px; flex-wrap:wrap; margin:4px 0;";
                const rank = document.createElement("span");
                rank.className = "guru-badge b-rank";
                rank.textContent = `#${item.position}`;
                wrapper.appendChild(rank);
                try {
                    titleEl.parentElement?.insertBefore(wrapper, titleEl);
                } catch (e) {}
            });
        }
    }

    window.GuruEpicentrAdapter = EpicentrAdapter;
})();
