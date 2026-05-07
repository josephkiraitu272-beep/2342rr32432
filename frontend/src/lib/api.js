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
