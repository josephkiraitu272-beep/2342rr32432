// Guru Normalized Product Schema v1.0 — IMMUTABLE.
// Any change here MUST bump SCHEMA_VERSION and update backend Pydantic model.
(function () {
    if (window.GuruSchema) return;

    const VERSION = "1.0";

    // Non-cryptographic stable hash (djb2). Used for product_key fallback when
    // a marketplace does not expose a numeric source_id.
    function shortHash(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
        return (h >>> 0).toString(16);
    }

    /** product_key = stable identity across captures (used for price history). */
    function productKey(item) {
        const sid = item.source_id || item.external_id;
        if (sid) return `${item.source}:${sid}`;
        if (item.url || item.product_url) {
            try {
                const u = new URL(item.url || item.product_url);
                return `${item.source}:${shortHash(u.pathname)}`;
            } catch (e) {}
        }
        return `${item.source}:${shortHash(item.title || "")}`;
    }

    /** Normalize raw extracted item to canonical schema v1.0. */
    function normalize(raw) {
        if (!raw || !raw.source) return null;
        const sourceId = raw.source_id || raw.external_id || null;
        const url = raw.url || raw.product_url || null;
        const images = Array.isArray(raw.images)
            ? raw.images.filter(Boolean)
            : raw.image
              ? [raw.image]
              : [];

        const item = {
            schema_version: VERSION,
            source: raw.source,
            source_id: sourceId,
            external_id: sourceId, // alias for backend backward-compat
            url,
            product_url: url,
            title: (raw.title || "").trim().slice(0, 500),
            brand: raw.brand || null,
            category: raw.category || null,
            category_path: Array.isArray(raw.category_path) ? raw.category_path : [],
            price: typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : null,
            old_price:
                typeof raw.old_price === "number" && Number.isFinite(raw.old_price)
                    ? raw.old_price
                    : null,
            currency: raw.currency || "UAH",
            availability:
                typeof raw.availability === "boolean" ? raw.availability : null,
            seller: raw.seller || null,
            seller_id: raw.seller_id ? String(raw.seller_id) : null,
            rating:
                typeof raw.rating === "number" && Number.isFinite(raw.rating) ? raw.rating : null,
            reviews_count: Number.isFinite(raw.reviews_count) ? raw.reviews_count : null,
            saves_count: Number.isFinite(raw.saves_count) ? raw.saves_count : null,
            badges: Array.isArray(raw.badges) ? raw.badges.filter(Boolean) : [],
            images,
            image: images[0] || null,
            position: Number.isFinite(raw.position) ? raw.position : null,
            listing_url: raw.listing_url || null,
            raw_data: raw.raw_data || raw.raw || null,
        };
        item.product_key = productKey(item);
        return item;
    }

    function isValid(item) {
        return !!(item && item.source && item.title && item.url);
    }

    window.GuruSchema = { VERSION, normalize, isValid, productKey, shortHash };
})();
