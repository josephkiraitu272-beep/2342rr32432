import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, ExternalLink, Filter, FileDown, History } from "lucide-react";
import { getProducts, buildExportUrl } from "@/lib/api";
import ProductHistoryModal from "@/components/ProductHistoryModal";

const BADGE_STYLE = {
    ad: "bg-orange-50 border border-orange-200 text-orange-700",
    promo: "bg-amber-50 border border-amber-200 text-amber-800",
    top_sales: "bg-emerald-50 border border-emerald-200 text-emerald-700",
    rozetka_choice: "bg-rose-50 border border-rose-200 text-rose-700",
    fulfilled: "bg-violet-50 border border-violet-200 text-violet-700",
    ready_to_ship: "bg-blue-50 border border-blue-200 text-blue-700",
};

function ProductBadge({ kind }) {
    const labels = {
        ad: "Реклама",
        promo: "Акція",
        top_sales: "Топ",
        rozetka_choice: "Вибір",
        fulfilled: "Фулф.",
        ready_to_ship: "Готово",
    };
    return (
        <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                BADGE_STYLE[kind] || "bg-neutral-100 border border-neutral-200 text-neutral-700"
            }`}
        >
            {labels[kind] || kind}
        </span>
    );
}

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

export default function Products() {
    const { productKey: routeKey } = useParams();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [source, setSource] = useState("");
    const [minDiscount, setMinDiscount] = useState("");
    const [loading, setLoading] = useState(true);
    const [historyKey, setHistoryKey] = useState(routeKey || null);

    useEffect(() => {
        // Sync with route param (back/forward navigation, direct link)
        setHistoryKey(routeKey || null);
    }, [routeKey]);

    const openHistory = (key) => {
        navigate(`/products/${encodeURIComponent(key)}`);
    };
    const closeHistory = () => {
        navigate("/products");
    };

    useEffect(() => {
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const r = await getProducts({ search, source, limit: 100 });
                setItems(r.items);
                setTotal(r.total);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [search, source]);

    const exportFilters = useMemo(() => {
        const f = { limit: 10000 };
        if (source) f.source = source;
        if (search) f.search = search;
        if (minDiscount) f.min_discount = minDiscount;
        return f;
    }, [source, search, minDiscount]);

    const filterPills = useMemo(
        () => [
            { value: "", label: "Усі", color: "bg-neutral-950 text-white" },
            { value: "rozetka", label: "Rozetka", color: "bg-red-600 text-white" },
            { value: "epicentr", label: "Epicentr", color: "bg-amber-500 text-white" },
        ],
        [],
    );

    return (
        <div className="space-y-6">
            <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                    <span className="w-6 h-px bg-orange-500" />
                    Каталог
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                    Товари
                </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[260px] max-w-xl">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                        data-testid="products-search"
                        type="text"
                        placeholder="Пошук за назвою…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
                    />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                    <Filter size={14} className="text-neutral-500 ml-2 mr-1" />
                    {filterPills.map((p) => (
                        <button
                            key={p.value || "all"}
                            data-testid={`filter-${p.value || "all"}`}
                            onClick={() => setSource(p.value)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                                source === p.value
                                    ? p.color + " shadow-sm"
                                    : "text-neutral-600 hover:text-neutral-950"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto text-xs text-neutral-500 font-mono">
                    {loading ? "Завантаження…" : `Знайдено ${total}`}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min="0"
                        max="99"
                        placeholder="Знижка ≥ %"
                        value={minDiscount}
                        onChange={(e) => setMinDiscount(e.target.value)}
                        data-testid="filter-min-discount"
                        className="w-28 px-2.5 py-2 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
                    />
                    <a
                        href={buildExportUrl("csv", exportFilters)}
                        data-testid="export-csv-btn"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white border border-neutral-300 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                        <FileDown size={14} /> CSV
                    </a>
                    <a
                        href={buildExportUrl("xlsx", exportFilters)}
                        data-testid="export-xlsx-btn"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-neutral-950 border border-neutral-950 text-sm font-semibold text-white hover:bg-neutral-800"
                    >
                        <FileDown size={14} /> XLSX
                    </a>
                </div>
            </div>

            <div className="guru-card overflow-hidden" data-testid="products-table">
                {items.length === 0 ? (
                    <div className="p-10 text-center text-neutral-500 text-sm">
                        Немає товарів. Зберіть дані через розширення.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                            <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                                <th className="py-3 px-4">Товар</th>
                                <th className="py-3 px-4">Джерело</th>
                                <th className="py-3 px-4">Продавець</th>
                                <th className="py-3 px-4 text-right">Ціна</th>
                                <th className="py-3 px-4">Бейджі</th>
                                <th className="py-3 px-4 text-right">Рейтинг</th>
                                <th className="py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((p) => {
                                const discount =
                                    p.old_price && p.price && p.old_price > p.price
                                        ? Math.round((1 - p.price / p.old_price) * 100)
                                        : null;
                                return (
                                    <tr
                                        key={p.id}
                                        className="border-t border-neutral-100 hover:bg-neutral-50/50"
                                    >
                                        <td className="py-3 px-4 max-w-sm">
                                            <div className="flex items-center gap-3">
                                                {p.image ? (
                                                    <img
                                                        src={p.image}
                                                        alt=""
                                                        className="w-10 h-10 object-cover rounded border border-neutral-200"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded bg-neutral-100" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-medium text-neutral-950 truncate">
                                                        {p.title}
                                                    </div>
                                                    {p.category ? (
                                                        <div className="text-xs text-neutral-500 truncate">
                                                            {p.category}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <SourceBadge source={p.source} />
                                        </td>
                                        <td className="py-3 px-4 text-neutral-700">
                                            {p.seller || "—"}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="font-mono font-bold text-neutral-950">
                                                {p.price ? `${Math.round(p.price)} ₴` : "—"}
                                            </div>
                                            {p.old_price && p.old_price > p.price ? (
                                                <div className="flex items-center justify-end gap-1.5 text-[11px]">
                                                    <span className="text-neutral-400 line-through font-mono">
                                                        {Math.round(p.old_price)} ₴
                                                    </span>
                                                    {discount ? (
                                                        <span className="px-1 py-px rounded bg-red-50 border border-red-200 text-red-700 font-mono font-bold">
                                                            −{discount}%
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(p.badges || []).slice(0, 3).map((b) => (
                                                    <ProductBadge key={b} kind={b} />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-neutral-700">
                                            {p.rating ? (
                                                <span className="text-amber-500 font-bold">
                                                    {p.rating.toFixed(1)} ★
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                            {p.reviews_count ? (
                                                <div className="text-[10px] text-neutral-400">
                                                    {p.reviews_count} відг.
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                {p.product_key ? (
                                                    <button
                                                        onClick={() => openHistory(p.product_key)}
                                                        data-testid={`history-btn-${p.id}`}
                                                        title="Історія ціни"
                                                        className="text-neutral-400 hover:text-orange-600 p-1 rounded hover:bg-orange-50"
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                ) : null}
                                                <a
                                                    href={p.product_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-neutral-400 hover:text-orange-600 p-1 rounded hover:bg-orange-50"
                                                    data-testid={`product-link-${p.id}`}
                                                    title="Відкрити в магазині"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {historyKey ? (
                <ProductHistoryModal
                    productKey={historyKey}
                    onClose={closeHistory}
                />
            ) : null}
        </div>
    );
}
