import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
    timeout: 20000,
});

export async function getSummary() {
    const r = await api.get("/analytics/summary");
    return r.data;
}

export async function getToday() {
    const r = await api.get("/analytics/today");
    return r.data;
}

export async function getProductInsights(key) {
    const r = await api.get(`/products/by-key/${encodeURIComponent(key)}/insights`);
    return r.data;
}

export async function getTopSellers(limit = 10, source) {
    const params = { limit };
    if (source) params.source = source;
    const r = await api.get("/analytics/top-sellers", { params });
    return r.data.items;
}

export async function getSourceDistribution() {
    const r = await api.get("/analytics/source-distribution");
    return r.data;
}

export async function getProducts({ source, search, seller, limit = 50, skip = 0 } = {}) {
    const params = { limit, skip };
    if (source) params.source = source;
    if (search) params.search = search;
    if (seller) params.seller = seller;
    const r = await api.get("/products", { params });
    return r.data;
}

export async function getPages(limit = 30) {
    const r = await api.get("/pages", { params: { limit } });
    return r.data.items;
}

export async function getProductByKey(key) {
    const r = await api.get(`/products/by-key/${encodeURIComponent(key)}`);
    return r.data;
}

export async function getProductHistory(key, limit = 200) {
    const r = await api.get(
        `/products/by-key/${encodeURIComponent(key)}/history`,
        { params: { limit } },
    );
    return r.data;
}

export async function getPriceChanges({
    window = "7d",
    direction = "down",
    source,
    limit = 20,
} = {}) {
    const params = { window, direction, limit };
    if (source) params.source = source;
    const r = await api.get("/analytics/price-changes", { params });
    return r.data;
}

export async function getTopDiscounts({ source, limit = 20 } = {}) {
    const params = { limit };
    if (source) params.source = source;
    const r = await api.get("/analytics/top-discounts", { params });
    return r.data.items;
}

export async function getSellerDominance({ source, limit = 10 } = {}) {
    const params = { limit };
    if (source) params.source = source;
    const r = await api.get("/analytics/seller-dominance", { params });
    return r.data;
}

export async function getSellersAnalytics({ source, sort = "products", limit = 50 } = {}) {
    const params = { limit, sort };
    if (source) params.source = source;
    const r = await api.get("/analytics/sellers", { params });
    return r.data;
}

export async function getPriceSignals({ window = "24h", minDropPct = 5, source, limit = 20 } = {}) {
    const params = { window, min_drop_pct: minDropPct, limit };
    if (source) params.source = source;
    const r = await api.get("/analytics/price-signals", { params });
    return r.data;
}

export function buildExportUrl(format, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
        if (v != null && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    return `${API}/export/products.${format}${qs ? "?" + qs : ""}`;
}

// ============================================================
// Task 1 — Foundation Analytics Layer
// ============================================================

// ---- Watchlist ----
export async function getWatchlist() {
    const r = await api.get("/watchlist");
    return r.data;
}
export async function addWatchlist(payload) {
    const r = await api.post("/watchlist", payload);
    return r.data;
}
export async function patchWatchlist(id, patch) {
    const r = await api.patch(`/watchlist/${encodeURIComponent(id)}`, patch);
    return r.data;
}
export async function deleteWatchlist(id) {
    const r = await api.delete(`/watchlist/${encodeURIComponent(id)}`);
    return r.data;
}
export async function getWatchlistCategories(limit = 200) {
    const r = await api.get("/watchlist/categories", { params: { limit } });
    return r.data;
}

// ---- Lifecycle ----
export async function getLifecycleSummary({ watchlistOnly = false, source } = {}) {
    const params = { watchlist_only: watchlistOnly };
    if (source) params.source = source;
    const r = await api.get("/lifecycle/summary", { params });
    return r.data;
}
export async function getLifecycleFeed({ status, watchlistOnly = false, source, limit = 50 } = {}) {
    const params = { limit, watchlist_only: watchlistOnly };
    if (status) params.status = status;
    if (source) params.source = source;
    const r = await api.get("/lifecycle/feed", { params });
    return r.data;
}

// ---- Market Signals ----
export async function getSignals({ kinds, source, watchlistOnly = false, sinceHours = 72, limit = 100 } = {}) {
    const params = { since_hours: sinceHours, limit, watchlist_only: watchlistOnly };
    if (kinds && kinds.length) params.kinds = kinds.join(",");
    if (source) params.source = source;
    const r = await api.get("/signals", { params });
    return r.data;
}
export async function getSignalsSummary({ sinceHours = 24, watchlistOnly = false } = {}) {
    const params = { since_hours: sinceHours, watchlist_only: watchlistOnly };
    const r = await api.get("/signals/summary", { params });
    return r.data;
}

// ---- Market Overview v2 ----
export async function getMarketOverview({ watchlistOnly = false, source, windowDays = 7 } = {}) {
    const params = { window_days: windowDays, watchlist_only: watchlistOnly };
    if (source) params.source = source;
    const r = await api.get("/market/overview", { params });
    return r.data;
}
export async function getMarketHeat({ windowDays = 7, watchlistOnly = false, source, limit = 12 } = {}) {
    const params = { window_days: windowDays, watchlist_only: watchlistOnly, limit };
    if (source) params.source = source;
    const r = await api.get("/market/heat", { params });
    return r.data;
}
export async function getSellerPressure({ windowDays = 7, watchlistOnly = false, source, limit = 15 } = {}) {
    const params = { window_days: windowDays, watchlist_only: watchlistOnly, limit };
    if (source) params.source = source;
    const r = await api.get("/market/seller-pressure", { params });
    return r.data;
}
export async function getMarketPromo({ windowDays = 7, watchlistOnly = false, source, limit = 20 } = {}) {
    const params = { window_days: windowDays, watchlist_only: watchlistOnly, limit };
    if (source) params.source = source;
    const r = await api.get("/market/promo", { params });
    return r.data;
}

// ---- Product Feed (v2) ----
export async function getProductFeed({ watchlistOnly = false, source, lifecycle, signalKind, search, limit = 50 } = {}) {
    const params = { watchlist_only: watchlistOnly, limit };
    if (source) params.source = source;
    if (lifecycle) params.lifecycle = lifecycle;
    if (signalKind) params.signal_kind = signalKind;
    if (search) params.search = search;
    const r = await api.get("/feed/products", { params });
    return r.data;
}

// ---- Backfill (admin) ----
export async function runBackfill(apiKey) {
    const r = await api.post(
        "/admin/backfill",
        {},
        { headers: { "X-Extension-Api-Key": apiKey || "prizma_dev_key_2026" } },
    );
    return r.data;
}

// ---- Lifecycle / Signal labels (mirror config/rules.py) ----
export const LIFECYCLE_LABELS = {
    new: "Новинка",
    active: "Активний",
    out_of_stock: "Немає в наявності",
    removed: "Знятий",
    returned: "Повернувся",
    declining: "Згасає",
    growing: "Зростає",
};

export const LIFECYCLE_STYLES = {
    new: "bg-emerald-50 border-emerald-200 text-emerald-700",
    active: "bg-neutral-100 border-neutral-200 text-neutral-700",
    out_of_stock: "bg-rose-50 border-rose-200 text-rose-700",
    removed: "bg-neutral-200 border-neutral-300 text-neutral-600",
    returned: "bg-blue-50 border-blue-200 text-blue-700",
    declining: "bg-amber-50 border-amber-200 text-amber-800",
    growing: "bg-violet-50 border-violet-200 text-violet-700",
};

export const SIGNAL_LABELS = {
    new_product: "Новинка",
    removed_product: "Зник",
    returned_product: "Повернувся",
    promo_detected: "Реклама",
    top_sales_detected: "Топ",
    price_drop: "Ціна ↓",
    price_rise: "Ціна ↑",
    stock_out: "Закінчився",
    back_in_stock: "В наявності",
    seller_attack: "Цінова атака",
};

export const SIGNAL_STYLES = {
    new_product: "bg-emerald-50 border-emerald-200 text-emerald-700",
    removed_product: "bg-neutral-100 border-neutral-200 text-neutral-700",
    returned_product: "bg-blue-50 border-blue-200 text-blue-700",
    promo_detected: "bg-orange-50 border-orange-200 text-orange-700",
    top_sales_detected: "bg-amber-50 border-amber-200 text-amber-800",
    price_drop: "bg-emerald-50 border-emerald-200 text-emerald-700",
    price_rise: "bg-rose-50 border-rose-200 text-rose-700",
    stock_out: "bg-rose-50 border-rose-200 text-rose-700",
    back_in_stock: "bg-emerald-50 border-emerald-200 text-emerald-700",
    seller_attack: "bg-violet-50 border-violet-200 text-violet-700",
};
