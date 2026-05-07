// Guru background service worker — persistent ingest queue + retry/backoff + diagnostics.
//
// Flow:
//   content/runtime.js -> chrome.runtime.sendMessage({type:"INGEST_PRODUCTS", items})
//      -> enqueue(items) into chrome.storage.local under QUEUE_KEY
//      -> scheduleFlush() drains queue in batches with retry on failure.
//
// On network failure: items remain in queue, retry via chrome.alarms (1min backoff, capped).
// Dedup: by product_key within 24h window, persistent across restarts.
const QUEUE_KEY = "guru_ingest_queue";
const SEEN_KEY = "guru_seen_keys";
const FLUSH_ALARM = "guru_flush_retry";
const BATCH_SIZE = 50;
const SEEN_TTL_MS = 24 * 3600 * 1000; // 24h dedup window

const DEFAULTS = {
    backendUrl: "https://parser-logic.preview.emergentagent.com",
    apiKey: "prizma_dev_key_2026",
    enabled: true,
};

chrome.runtime.onInstalled.addListener(async () => {
    const stored = await chrome.storage.local.get([
        "backendUrl",
        "apiKey",
        "enabled",
        "capturedTotal",
        "capturedToday",
        "capturedDate",
    ]);
    const next = {
        backendUrl: stored.backendUrl || DEFAULTS.backendUrl,
        apiKey: stored.apiKey || DEFAULTS.apiKey,
        enabled: stored.enabled !== false,
        capturedTotal: stored.capturedTotal || 0,
        capturedToday: stored.capturedToday || 0,
        capturedDate: stored.capturedDate || new Date().toDateString(),
        lastError: null,
    };
    await chrome.storage.local.set(next);
    console.log("[Guru/bg] installed", next);
});

async function getCfg() {
    return chrome.storage.local.get([
        "backendUrl",
        "apiKey",
        "enabled",
        "capturedTotal",
        "capturedToday",
        "capturedDate",
    ]);
}

async function getCfCookies() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: "rozetka.com.ua" });
        const map = {};
        for (const c of cookies) {
            if (c.name === "cf_clearance" || c.name === "__cf_bm") map[c.name] = c.value;
        }
        return map;
    } catch (e) {
        return {};
    }
}

async function postJson(url, apiKey, body) {
    let r;
    try {
        r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Extension-Api-Key": apiKey,
            },
            body: JSON.stringify(body),
        });
    } catch (e) {
        return { ok: false, status: 0, error: `Network: ${e?.message || e}` };
    }
    let data = null;
    try {
        data = await r.json();
    } catch (e) {
        data = { raw: await r.text().catch(() => "") };
    }
    if (!r.ok) {
        return {
            ok: false,
            status: r.status,
            error: data?.detail
                ? `HTTP ${r.status}: ${JSON.stringify(data.detail).slice(0, 200)}`
                : `HTTP ${r.status}`,
            data,
        };
    }
    return { ok: true, status: r.status, data };
}

async function recordError(err) {
    try {
        await chrome.storage.local.set({
            lastError: { message: String(err), at: new Date().toISOString() },
        });
    } catch (e) {}
}

// ---------- Queue ----------

async function getQueueAndSeen() {
    const r = await chrome.storage.local.get([QUEUE_KEY, SEEN_KEY]);
    return {
        queue: Array.isArray(r[QUEUE_KEY]) ? r[QUEUE_KEY] : [],
        seen: r[SEEN_KEY] && typeof r[SEEN_KEY] === "object" ? r[SEEN_KEY] : {},
    };
}

async function setQueueAndSeen(queue, seen) {
    await chrome.storage.local.set({ [QUEUE_KEY]: queue, [SEEN_KEY]: seen });
}

function pruneSeen(seen) {
    const now = Date.now();
    const out = {};
    for (const [k, ts] of Object.entries(seen)) {
        if (now - ts < SEEN_TTL_MS) out[k] = ts;
    }
    return out;
}

async function enqueueItems(items, listingUrl, listingTitle) {
    if (!items?.length) return { added: 0, deduped: 0 };
    const { queue, seen } = await getQueueAndSeen();
    const prunedSeen = pruneSeen(seen);
    let added = 0;
    let deduped = 0;
    for (const it of items) {
        const key = it.product_key || `${it.source}:${it.source_id || it.url}`;
        // Dedup: skip if seen within TTL AND same price (price changes → always re-ingest)
        const seenSig = prunedSeen[key];
        const priceSig = `${it.price || ""}:${it.old_price || ""}`;
        if (seenSig && seenSig.priceSig === priceSig) {
            deduped++;
            continue;
        }
        if (listingUrl) it.listing_url = it.listing_url || listingUrl;
        if (listingTitle) it.listing_title = it.listing_title || listingTitle;
        queue.push({ item: it, enqueued_at: Date.now() });
        prunedSeen[key] = { ts: Date.now(), priceSig };
        added++;
    }
    await setQueueAndSeen(queue, prunedSeen);
    return { added, deduped, queue_size: queue.length };
}

let flushTimer = null;
let flushing = false;

function scheduleFlush(ms = 1500) {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushQueue();
    }, ms);
}

async function flushQueue() {
    if (flushing) return;
    flushing = true;
    try {
        const cfg = await getCfg();
        let { queue } = await getQueueAndSeen();
        if (queue.length === 0) {
            await chrome.alarms.clear(FLUSH_ALARM);
            return;
        }
        while (queue.length) {
            const batch = queue.slice(0, BATCH_SIZE).map((q) => q.item);
            const result = await postJson(
                `${cfg.backendUrl}/api/ingest/products`,
                cfg.apiKey,
                { items: batch },
            );
            if (result.ok) {
                queue = queue.slice(batch.length);
                const { seen } = await getQueueAndSeen();
                await setQueueAndSeen(queue, seen);
                const today = new Date().toDateString();
                const todayCnt =
                    cfg.capturedDate === today
                        ? (cfg.capturedToday || 0) + batch.length
                        : batch.length;
                await chrome.storage.local.set({
                    capturedTotal: (cfg.capturedTotal || 0) + batch.length,
                    capturedToday: todayCnt,
                    capturedDate: today,
                    lastError: null,
                });
                cfg.capturedTotal = (cfg.capturedTotal || 0) + batch.length;
                cfg.capturedToday = todayCnt;
                cfg.capturedDate = today;
            } else {
                await recordError(result.error);
                // Schedule retry with chrome.alarms (min interval is 1 min in MV3 release builds)
                await chrome.alarms.create(FLUSH_ALARM, { delayInMinutes: 1 });
                console.warn("[Guru/bg] flush failed, will retry in 1m:", result.error);
                return;
            }
        }
        await chrome.alarms.clear(FLUSH_ALARM);
    } finally {
        flushing = false;
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FLUSH_ALARM) flushQueue();
});

// ---------- Message router ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        const cfg = await getCfg();

        if (msg.type === "GET_CONFIG") {
            const { queue } = await getQueueAndSeen();
            sendResponse({ ok: true, config: { ...cfg, queue_size: queue.length } });
            return;
        }

        if (msg.type === "SAVE_CONFIG") {
            await chrome.storage.local.set({
                backendUrl: msg.backendUrl,
                apiKey: msg.apiKey,
                enabled: msg.enabled !== false,
                lastError: null,
            });
            // Try draining any pending queue with new config
            scheduleFlush(500);
            sendResponse({ ok: true });
            return;
        }

        if (msg.type === "INGEST_PRODUCTS") {
            // Always go through queue — never lose data on flaky networks
            const r = await enqueueItems(msg.items, msg.listingUrl, msg.listingTitle);
            scheduleFlush(800);
            sendResponse({ ok: true, queued: r.added, deduped: r.deduped, queue_size: r.queue_size });
            return;
        }

        if (msg.type === "INGEST_PAGE") {
            const result = await postJson(
                `${cfg.backendUrl}/api/ingest/page`,
                cfg.apiKey,
                msg.page,
            );
            if (!result.ok) await recordError(result.error);
            sendResponse(result);
            return;
        }

        if (msg.type === "INGEST_CF") {
            const cookies = await getCfCookies();
            const result = await postJson(
                `${cfg.backendUrl}/api/ingest/cf-session`,
                cfg.apiKey,
                {
                    user_agent: msg.userAgent || "",
                    cf_clearance: cookies.cf_clearance,
                    cf_bm: cookies.__cf_bm,
                },
            );
            sendResponse(result);
            return;
        }

        if (msg.type === "PING_BACKEND") {
            try {
                const r = await fetch(`${cfg.backendUrl}/api/extension/health`, {
                    headers: { "X-Extension-Api-Key": cfg.apiKey },
                });
                sendResponse({ ok: r.ok, status: r.status });
            } catch (e) {
                await recordError(`Network: ${e?.message || e}`);
                sendResponse({ ok: false, error: String(e) });
            }
            return;
        }

        if (msg.type === "FLUSH_QUEUE") {
            await flushQueue();
            const { queue } = await getQueueAndSeen();
            sendResponse({ ok: true, queue_size: queue.length });
            return;
        }

        if (msg.type === "CLEAR_QUEUE") {
            await setQueueAndSeen([], {});
            sendResponse({ ok: true });
            return;
        }

        if (msg.type === "TEST_INGEST") {
            const testItem = {
                schema_version: "1.0",
                source: "rozetka",
                source_id: "guru_test_" + Date.now(),
                title: "GURU TEST: ping product",
                price: 1,
                url: "https://rozetka.com.ua/__guru_test__/p0/",
                product_url: "https://rozetka.com.ua/__guru_test__/p0/",
                seller: "Guru Diagnostics",
                badges: ["test"],
                category_path: [],
                images: [],
                product_key: "rozetka:guru_test",
            };
            const r = await enqueueItems([testItem], "guru://test", "Guru self-test");
            await flushQueue();
            sendResponse({ ok: true, ...r });
            return;
        }

        sendResponse({ ok: false, error: "Unknown message type" });
    })();
    return true;
});

// On startup, try to drain any leftover queue from previous session
chrome.runtime.onStartup.addListener(() => {
    setTimeout(flushQueue, 2000);
});
