import { useEffect, useMemo, useState } from "react";
import { Filter, ArrowUpDown, Star, ShieldCheck } from "lucide-react";
import { getSellersAnalytics } from "@/lib/api";

const SOURCE_PILLS = [
    { v: "", l: "Усі", c: "bg-neutral-950 text-white" },
    { v: "rozetka", l: "Rozetka", c: "bg-red-600 text-white" },
    { v: "epicentr", l: "Epicentr", c: "bg-amber-500 text-white" },
];

const SORT_OPTIONS = [
    { v: "products", l: "Позиції" },
    { v: "avg_price", l: "Сер. ціна" },
    { v: "avg_discount", l: "Сер. знижка" },
    { v: "share", l: "Частка" },
];

function SourceBadge({ source }) {
    if (source === "rozetka") {
        return (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-red-50 border border-red-200 text-red-700 font-bold">
                Rozetka
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-800 font-bold">
            Epicentr
        </span>
    );
}

export default function Sellers() {
    const [source, setSource] = useState("");
    const [sort, setSort] = useState("products");
    const [data, setData] = useState({ items: [], total_unique_products: 0, total_sellers: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const r = await getSellersAnalytics({
                    source: source || undefined,
                    sort,
                    limit: 50,
                });
                setData(r);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [source, sort]);

    const filteredItems = useMemo(() => {
        if (!search) return data.items;
        const s = search.toLowerCase();
        return data.items.filter((i) => (i.seller || "").toLowerCase().includes(s));
    }, [data.items, search]);

    const maxShare = useMemo(
        () => Math.max(1, ...filteredItems.map((i) => i.share_pct || 0)),
        [filteredItems],
    );

    return (
        <div className="space-y-6">
            <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                    <span className="w-6 h-px bg-orange-500" />
                    Аналітика конкурентів
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                    Продавці
                </h1>
                <p className="mt-3 text-neutral-600 max-w-2xl">
                    Повна профільна аналітика: кількість товарів, середня ціна та знижка, частка
                    від відстежуваного ринку.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                    <Filter size={14} className="text-neutral-500 ml-2 mr-1" />
                    {SOURCE_PILLS.map((p) => (
                        <button
                            key={p.v || "all"}
                            data-testid={`sellers-filter-${p.v || "all"}`}
                            onClick={() => setSource(p.v)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                                source === p.v
                                    ? p.c + " shadow-sm"
                                    : "text-neutral-600 hover:text-neutral-950"
                            }`}
                        >
                            {p.l}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                    <ArrowUpDown size={14} className="text-neutral-500 ml-2 mr-1" />
                    {SORT_OPTIONS.map((o) => (
                        <button
                            key={o.v}
                            data-testid={`sellers-sort-${o.v}`}
                            onClick={() => setSort(o.v)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                                sort === o.v
                                    ? "bg-neutral-950 text-white shadow-sm"
                                    : "text-neutral-600 hover:text-neutral-950"
                            }`}
                        >
                            {o.l}
                        </button>
                    ))}
                </div>
                <input
                    data-testid="sellers-search"
                    placeholder="Пошук за назвою…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-2 rounded-md border border-neutral-300 text-sm w-56 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <div className="ml-auto text-xs text-neutral-500 font-mono">
                    {loading
                        ? "Завантаження…"
                        : `${data.total_sellers} продавців · ${data.total_unique_products} унік. товарів`}
                </div>
            </div>

            <div className="guru-card overflow-hidden" data-testid="sellers-table">
                {filteredItems.length === 0 ? (
                    <div className="p-10 text-center text-sm text-neutral-500">
                        {loading
                            ? "Завантаження…"
                            : "Немає даних. Зберіть кілька сторінок видачі через розширення."}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                            <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                                <th className="py-3 px-4">#</th>
                                <th className="py-3 px-4">Продавець</th>
                                <th className="py-3 px-4">Джерела</th>
                                <th className="py-3 px-4 text-right">Товарів</th>
                                <th className="py-3 px-4 text-right">Сер. ціна</th>
                                <th className="py-3 px-4 text-right">Діапазон</th>
                                <th className="py-3 px-4 text-right">Сер. знижка</th>
                                <th className="py-3 px-4 text-right">Частка</th>
                                <th className="py-3 px-4 text-right">Останнє</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((s, i) => (
                                <tr
                                    key={s.seller}
                                    data-testid={`seller-row-${i}`}
                                    className="border-t border-neutral-100 hover:bg-neutral-50/50"
                                >
                                    <td className="py-3 px-4 font-mono text-xs text-neutral-400 w-12">
                                        {String(i + 1).padStart(2, "0")}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="font-bold text-neutral-950">{s.seller}</div>
                                        <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                                            {s.available > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                                    <ShieldCheck size={12} />
                                                    {s.available} наявних
                                                </span>
                                            ) : null}
                                            {s.with_discount > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-rose-600">
                                                    <Star size={12} /> {s.with_discount} зі знижкою
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(s.sources || []).map((src) => (
                                                <SourceBadge key={src} source={src} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold">
                                        {s.unique_products}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono">
                                        {s.avg_price ? `${Math.round(s.avg_price)} ₴` : "—"}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-xs text-neutral-500">
                                        {s.min_price && s.max_price
                                            ? `${Math.round(s.min_price)}–${Math.round(s.max_price)}`
                                            : "—"}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        {s.avg_discount ? (
                                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-xs">
                                                −{Math.round(s.avg_discount)}%
                                            </span>
                                        ) : (
                                            <span className="text-neutral-400">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="font-mono text-sm font-bold text-neutral-950">
                                            {s.share_pct?.toFixed(1)}%
                                        </div>
                                        <div className="mt-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden w-24 ml-auto">
                                            <div
                                                className="h-full bg-orange-500"
                                                style={{
                                                    width: `${Math.min(100, ((s.share_pct || 0) / maxShare) * 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right text-xs font-mono text-neutral-500">
                                        {s.last_seen
                                            ? new Date(s.last_seen).toLocaleString("uk-UA", {
                                                  day: "2-digit",
                                                  month: "2-digit",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                              })
                                            : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
