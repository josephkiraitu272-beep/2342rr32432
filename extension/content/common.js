// Гуру — common helpers shared across content scripts
(function () {
    if (window.__guruCommon) return;
    window.__guruCommon = true;

    const PRIZMA_PRICE_RE = /(\d{1,3}(?:[\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(?:₴|грн|uah)/gi;

    const Common = {
        toNumber(text) {
            if (text == null) return null;
            const cleaned = String(text)
                .replace(/[^\d.,-]/g, "")
                .replace(/\s+/g, "")
                .replace(/,(\d{1,2})$/, ".$1")
                .replace(/(?<=\d),(?=\d{3})/g, "");
            const v = parseFloat(cleaned);
            return Number.isFinite(v) ? v : null;
        },
        // Extract all price-looking substrings from given text. Returns numbers.
        extractPrices(text) {
            if (!text) return [];
            const found = [];
            let m;
            const re = new RegExp(PRIZMA_PRICE_RE.source, "gi");
            while ((m = re.exec(text)) !== null) {
                const v = Common.toNumber(m[1]);
                if (v && v >= 5 && v <= 99999999) found.push(v);
            }
            return found;
        },
        // Given a tile DOM, return { price, old_price } using DOM-strikethrough cue then regex fallback.
        pickPrices(tile) {
            // 1) explicit strikethrough = old price
            const strike = tile.querySelector("del, s, [class*='old-price'], [class*='price--old']");
            const oldPrice = strike ? Common.toNumber(strike.textContent) : null;

            // 2) regex over tile text — skip numbers immediately prefixed with minus (those are discount deltas)
            const text = (tile.textContent || "").replace(/[−–—]\s*\d[\d\s\u00a0.,]*\s*(?:₴|грн)/gi, " "); // strip "-1 000 ₴" deltas
            const all = Common.extractPrices(text);
            let price = null;
            if (oldPrice && all.length) {
                // Current price must differ from oldPrice and be at least ~30% of it (filter out tiny noise).
                const candidates = all.filter(
                    (p) => Math.abs(p - oldPrice) > 0.5 && p >= oldPrice * 0.3,
                );
                price = candidates.length ? Math.min(...candidates) : null;
            } else if (all.length) {
                // No strike: take the largest visible price as the current price.
                price = Math.max(...all);
            }

            return { price, old_price: oldPrice };
        },
        debounce(fn, ms = 400) {
            let t;
            return (...args) => {
                clearTimeout(t);
                t = setTimeout(() => fn(...args), ms);
            };
        },
        text(el, sel) {
            const found = sel ? el.querySelector(sel) : el;
            return found ? found.textContent.trim() : null;
        },
        attr(el, sel, attr) {
            const found = sel ? el.querySelector(sel) : el;
            return found ? found.getAttribute(attr) : null;
        },
        absoluteUrl(href) {
            if (!href) return null;
            try {
                return new URL(href, location.origin).toString();
            } catch (e) {
                return href;
            }
        },
        async sendIngestProducts(items, listingUrl, listingTitle) {
            if (!items || items.length === 0) return { ok: true, inserted: 0 };
            return chrome.runtime.sendMessage({
                type: "INGEST_PRODUCTS",
                items,
                listingUrl: listingUrl || location.href,
                listingTitle: listingTitle || document.title,
            });
        },
        async sendIngestPage(page) {
            return chrome.runtime.sendMessage({ type: "INGEST_PAGE", page });
        },
        async sendCfSession() {
            return chrome.runtime.sendMessage({
                type: "INGEST_CF",
                userAgent: navigator.userAgent,
            });
        },
        computePageStats(items) {
            const prices = items.map((i) => i.price).filter((p) => p && p > 0);
            const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
            const sellerDist = {};
            const badgeDist = {};
            for (const it of items) {
                if (it.seller) sellerDist[it.seller] = (sellerDist[it.seller] || 0) + 1;
                for (const b of it.badges || []) badgeDist[b] = (badgeDist[b] || 0) + 1;
            }
            return {
                products_count: items.length,
                avg_price: avg ? Math.round(avg * 100) / 100 : null,
                min_price: prices.length ? Math.min(...prices) : null,
                max_price: prices.length ? Math.max(...prices) : null,
                seller_distribution: sellerDist,
                badge_distribution: badgeDist,
            };
        },
    };

    window.GuruCommon = Common;
    // backward-compat alias
    window.PrizmaCommon = Common;
})();
