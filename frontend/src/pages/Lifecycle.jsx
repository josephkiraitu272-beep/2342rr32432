import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertCircle,
    Filter,
    ArrowDownRight,
    ArrowUpRight,
    ExternalLink,
    Bell,
    Tag,
    History,
    HelpCircle,
} from "lucide-react";
import {
    getProductFeed,
    LIFECYCLE_LABELS,
    LIFECYCLE_STYLES,
} from "@/lib/api";
import { LifecycleChip, SignalChip } from "@/components/IntelChips";
import ProductHistoryModal from "@/components/ProductHistoryModal";

function SourceBadge({ source }) {
    if (source === "rozetka")
        return (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-red-50 border border-red-200 text-red-700 font-bold">
                Rozetka
            </span>
        );
    return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-800 font-bold">
            Epicentr
        </span>
    );
}

const LIFECYCLE_FILTERS = [
    { value: "", label: "Всі" },
    { value: "new", label: LIFECYCLE_LABELS.new },
    { value: "growing", label: LIFECYCLE_LABELS.growing },
    { value: "declining", label: LIFECYCLE_LABELS.declining },
    { value: "out_of_stock", label: LIFECYCLE_LABELS.out_of_stock },
    { value: "returned", label: LIFECYCLE_LABELS.returned },
    { value: "removed", label: LIFECYCLE_LABELS.removed },
];

export default function Lifecycle() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [source, setSource] = useState("");
    const [watchlistOnly, setWatchlistOnly] = useState(false);
    const [search, setSearch] = useState("");
    const [historyKey, setHistoryKey] = useState(null);
    const [openReason, setOpenReason] = useState(null);

    useEffect(() => {
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const r = await getProductFeed({
                    lifecycle: filter || undefined,
                    source: source || undefined,
                    watchlistOnly,
                    search: search || undefined,
                    limit: 100,
                });
                setItems(r.items || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [filter, source, watchlistOnly, search]);

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                        <span className="w-6 h-px bg-orange-500" />
                        Lifecycle &amp; Signals
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                        Товарний feed
                    </h1>
                    <p className="mt-3 text-neutral-600 max-w-2xl leading-relaxed">
                        Оперативна таблиця ринку: lifecycle-статус кожного товару, свіжі сигнали та
                        доказова база «чому» для кожного рішення.
                    </p>
                </div>
                <Link
                    to="/watchlist"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1.5"
                >
                    Налаштувати watchlist <ArrowUpRight size={14} />
                </Link>
            </div>

            <div className="guru-card p-4" data-testid="lifecycle-filters">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                        <Filter size={14} className="text-neutral-500 ml-2 mr-1" />
                        {LIFECYCLE_FILTERS.map((f) => (
                            <button
                                key={f.value || "all"}
                                onClick={() => setFilter(f.value)}
                                data-testid={`lifecycle-filter-${f.value || "all"}`}
                                className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-colors font-mono ${
                                    filter === f.value
                                        ? "bg-neutral-950 text-white shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-950"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                        {[
                            { v: "", l: "Всі", c: "bg-neutral-950 text-white" },
                            { v: "rozetka", l: "Rozetka", c: "bg-red-600 text-white" },
                            { v: "epicentr", l: "Epicentr", c: "bg-amber-500 text-white" },
                        ].map((p) => (
                            <button
                                key={p.v || "all-src"}
                                onClick={() => setSource(p.v)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                                    source === p.v ? p.c : "text-neutral-600 hover:text-neutral-950"
                                }`}
                            >
                                {p.l}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs font-mono text-neutral-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={watchlistOnly}
                            onChange={(e) => setWatchlistOnly(e.target.checked)}
                            data-testid="lifecycle-watchlist-toggle"
                            className="accent-orange-500"
                        />
                        <Tag size={12} className="text-orange-500" /> Тільки watchlist
                    </label>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Пошук…"
                        data-testid="lifecycle-search"
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
                    />
                    <span className="text-xs font-mono text-neutral-500 ml-auto">
                        {loading ? "Завантаження…" : `${items.length} товарів`}
                    </span>
                </div>
            </div>

            <div className="guru-card overflow-visible" data-testid="lifecycle-table">
                {items.length === 0 ? (
                    <div className="p-10 text-center text-neutral-500 text-sm">
                        {loading
                            ? "Завантаження…"
                            : "Немає товарів відповідно до фільтрів."}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                            <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                                <th className="py-3 px-4">Товар</th>
                                <th className="py-3 px-4">Lifecycle</th>
                                <th className="py-3 px-4">Signals</th>
                                <th className="py-3 px-4">Продавець</th>
                                <th className="py-3 px-4 text-right">Ціна</th>
                                <th className="py-3 px-4 text-right">Спостережень</th>
                                <th className="py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((p) => {
                                const reasonOpen = openReason === p.product_key;
                                return (
                                    <tr
                                        key={p.product_key}
                                        data-testid={`feed-row-${p.product_key}`}
                                        className="border-t border-neutral-100 hover:bg-neutral-50/50 align-top"
                                    >
                                        <td className="py-3 px-4 max-w-md">
                                            <div className="flex items-start gap-3">
                                                {p.image ? (
                                                    <img
                                                        src={p.image}
                                                        alt=""
                                                        className="w-10 h-10 object-cover rounded border border-neutral-200 flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded bg-neutral-100 flex-shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-medium text-neutral-950 truncate">
                                                        {p.title}
                                                    </div>
                                                    <div className="text-xs text-neutral-500 truncate flex items-center gap-2 mt-1">
                                                        <SourceBadge source={p.source} />
                                                        {p.category_path?.[0] || p.category || "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 relative">
                                            <div className="flex items-center gap-1.5">
                                                <LifecycleChip status={p.lifecycle_status} />
                                                <button
                                                    onClick={() =>
                                                        setOpenReason(
                                                            reasonOpen ? null : p.product_key,
                                                        )
                                                    }
                                                    data-testid={`reason-btn-${p.product_key}`}
                                                    title="Чому?"
                                                    className="text-neutral-400 hover:text-orange-600 p-0.5 rounded"
                                                >
                                                    <HelpCircle size={13} />
                                                </button>
                                            </div>
                                            {reasonOpen && (
                                                <div className="absolute z-30 left-4 top-full mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg text-left">
                                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-2">
                                                        <AlertCircle size={11} className="text-orange-500" />
                                                        Чому
                                                    </div>
                                                    <ul className="space-y-1">
                                                        {(p.reasons || []).map((r, i) => (
                                                            <li
                                                                key={i}
                                                                className="text-xs text-neutral-700 leading-snug flex gap-1.5"
                                                            >
                                                                <span className="text-orange-500 font-bold">·</span>
                                                                <span>{r}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    {p.first_seen_at ? (
                                                        <div className="mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                                                            вперше: {new Date(p.first_seen_at).toLocaleDateString("uk-UA")}
                                                            {" · "}
                                                            знімків: {p.snapshots}
                                                        </div>
                                                    ) : null}
                                                    <button
                                                        onClick={() => setOpenReason(null)
                                                        }
                                                        className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700 text-[10px]"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(p.signals || []).slice(0, 4).map((s, i) => (
                                                    <SignalChip key={i} kind={s.kind} size="xs" />
                                                ))}
                                                {(p.signals || []).length === 0 ? (
                                                    <span className="text-xs text-neutral-400">—</span>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-neutral-700 max-w-[160px] truncate">
                                            {p.seller || "—"}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="font-mono font-bold text-neutral-950">
                                                {p.price ? `${Math.round(p.price)} ₴` : "—"}
                                            </div>
                                            {p.price_delta_pct != null ? (
                                                <div
                                                    className={`text-[11px] font-mono inline-flex items-center gap-0.5 ${
                                                        p.price_delta_pct < 0
                                                            ? "text-emerald-700"
                                                            : p.price_delta_pct > 0
                                                              ? "text-rose-700"
                                                              : "text-neutral-500"
                                                    }`}
                                                >
                                                    {p.price_delta_pct < 0 ? (
                                                        <ArrowDownRight size={11} />
                                                    ) : p.price_delta_pct > 0 ? (
                                                        <ArrowUpRight size={11} />
                                                    ) : null}
                                                    {p.price_delta_pct.toFixed(1)}%
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-neutral-700">
                                            <div className="text-sm font-bold">{p.snapshots}</div>
                                            {p.last_seen_ago_days != null ? (
                                                <div className="text-[10px] text-neutral-400">
                                                    {p.last_seen_ago_days < 1
                                                        ? "<1д."
                                                        : `${Math.round(p.last_seen_ago_days)}д. тому`}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <button
                                                    onClick={() => setHistoryKey(p.product_key)}
                                                    title="Історія"
                                                    className="text-neutral-400 hover:text-orange-600 p-1 rounded hover:bg-orange-50"
                                                >
                                                    <History size={14} />
                                                </button>
                                                <a
                                                    href={p.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Відкрити"
                                                    className="text-neutral-400 hover:text-orange-600 p-1 rounded hover:bg-orange-50"
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
                    onClose={() => setHistoryKey(null)}
                />
            ) : null}
        </div>
    );
}
