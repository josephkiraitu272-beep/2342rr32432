// Guru Runtime — picks the right adapter, drives parsing, observation,
// overlay handler registration. Replaces per-marketplace bootstrap code.
(function () {
    if (window.__guruRuntime) return;
    window.__guruRuntime = true;

    const C = window.GuruCommon || window.PrizmaCommon;
    const O = window.GuruOverlay || window.PrizmaOverlay;
    const Schema = window.GuruSchema;

    function pickAdapter() {
        const host = location.hostname;
        if (host.includes("rozetka.com.ua") && window.GuruRozetkaAdapter)
            return new window.GuruRozetkaAdapter();
        if (host.includes("epicentrk.ua") && window.GuruEpicentrAdapter)
            return new window.GuruEpicentrAdapter();
        return null;
    }

    const adapter = pickAdapter();
    if (!adapter) {
        console.warn("[Guru/runtime] no adapter for", location.host);
        return;
    }
    const SOURCE = adapter.source;
    console.log("[Guru/runtime] adapter:", SOURCE);

    function refresh() {
        O.ensure(SOURCE);
        const mode = adapter.detect();
        let items = [];
        let tiles = [];
        try {
            if (mode === "listing") {
                tiles = adapter.getTiles();
                items = adapter.parseListing();
            } else if (mode === "product") {
                const p = adapter.parseProduct();
                if (p && p.title) items = [p];
            }
        } catch (e) {
            console.error("[Guru/runtime] parse error:", e);
        }
        const normalized = items.map(Schema.normalize).filter(Schema.isValid);
        const stats = C.computePageStats(normalized);
        O.render(stats, stats.badge_distribution || {});
        if (tiles.length) adapter.injectInlineBadges(tiles, normalized);
        window.__guruItems = normalized;
        window.__guruStats = stats;
        window.__guruMode = mode;
        return normalized;
    }

    O.setHandler(async () => {
        console.log("[Guru/runtime] capture started for", SOURCE);
        const items = window.__guruItems?.length ? window.__guruItems : refresh();
        if (!items || items.length === 0) {
            console.warn("[Guru/runtime] no items on this page");
            return { inserted: 0 };
        }
        // Send to background queue — background drains with retry/batch.
        const result = await chrome.runtime.sendMessage({
            type: "INGEST_PRODUCTS",
            items,
            listingUrl: location.href,
            listingTitle: document.title,
        });
        if (!result?.ok) {
            const err = result?.error || "ingest failed";
            console.error("[Guru/runtime] ingest error:", err);
            throw new Error(err);
        }
        const stats = C.computePageStats(items);
        await chrome.runtime.sendMessage({
            type: "INGEST_PAGE",
            page: {
                source: SOURCE,
                url: location.href,
                title: document.title,
                category: adapter.extractBreadcrumbs().slice(-1)[0] || null,
                category_path: adapter.extractBreadcrumbs(),
                ...stats,
            },
        });
        if (SOURCE === "rozetka") {
            chrome.runtime.sendMessage({
                type: "INGEST_CF",
                userAgent: navigator.userAgent,
            });
        }
        return result?.data || { inserted: items.length, queued: result?.queued };
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === "GURU_CAPTURE" || msg.type === "PRIZMA_CAPTURE") {
            const btn = document.getElementById("guru-cta-btn");
            if (btn) btn.click();
            sendResponse({ ok: true });
        }
        return true;
    });

    const debounced = C.debounce(refresh, 700);
    refresh();
    new MutationObserver(debounced).observe(document.body, {
        childList: true,
        subtree: true,
    });
})();
