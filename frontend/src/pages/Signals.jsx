import { useEffect, useState } from "react";
import { Bell, Filter, ExternalLink, History, Activity } from "lucide-react";
import { getSignals, getSignalsSummary, SIGNAL_LABELS } from "@/lib/api";
import { SignalChip } from "@/components/IntelChips";
import ProductHistoryModal from "@/components/ProductHistoryModal";

const KIND_FILTERS = [
    { value: "", label: "Всі" },
    { value: "price_drop", label: SIGNAL_LABELS.price_drop },
    { value: "price_rise", label: SIGNAL_LABELS.price_rise },
    { value: "new_product", label: SIGNAL_LABELS.new_product },
    { value: "returned_product", label: SIGNAL_LABELS.returned_product },
    { value: "stock_out", label: SIGNAL_LABELS.stock_out },
    { value: "back_in_stock", label: SIGNAL_LABELS.back_in_stock },
    { value: "promo_detected", label: SIGNAL_LABELS.promo_detected },
    { value: "top_sales_detected", label: SIGNAL_LABELS.top_sales_detected },
];

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

export default function Signals() {
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [kind, setKind] = useState("");
    const [watchlistOnly, setWatchlistOnly] = useState(false);
    const [sinceHours, setSinceHours] = useState(72);
    const [historyKey, setHistoryKey] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try {
            const [r, s] = await Promise.all([
                getSignals({
                    kinds: kind ? [kind] : null,
                    watchlistOnly,
                    sinceHours,
                    limit: 200,
                }),
                getSignalsSummary({ sinceHours, watchlistOnly }),
            ]);
            setItems(r.items || []);
            setSummary(s);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        const t = setInterval(refresh, 30000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, watchlistOnly, sinceHours]);

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                        <span className="w-6 h-px bg-orange-500" />
                        Market Signals
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                        Сигнали
                    </h1>
                    <p className="mt-3 text-neutral-600 max-w-2xl leading-relaxed">
                        Детерміновані події ринку: падіння / ріст цін, нові товари, реклама,
                        відсутність. Ніякого AI — лише корреляції за history-базою.
                    </p>
                </div>
            </div>

            {summary?.total > 0 ? (
                <div className="guru-card p-5" data-testid="signals-summary">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity size={14} className="text-orange-500" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">
                            За останні {sinceHours} год.
                        </span>
                        <span className="text-2xl font-mono font-extrabold text-neutral-950 ml-auto">
                            {summary.total}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">сигналів</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(summary.buckets || {})
                            .sort((a, b) => b[1] - a[1])
                            .map(([k, v]) => (
                                <button
                                    key={k}
                                    onClick={() => setKind(kind === k ? "" : k)}
                                    className={`flex items-center gap-1.5 ${
                                        kind === k
                                            ? "ring-2 ring-orange-300 ring-offset-1"
                                            : ""
                                    } rounded`}
                                >
                                    <SignalChip kind={k} />
                                    <span className="text-xs font-mono font-bold text-neutral-700">
                                        {v}
                                    </span>
                                </button>
                            ))}
                    </div>
                </div>
            ) : null}

            <div className="guru-card p-4" data-testid="signals-filters">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100 flex-wrap">
                        <Filter size={14} className="text-neutral-500 ml-2 mr-1" />
                        {KIND_FILTERS.map((f) => (
                            <button
                                key={f.value || "all"}
                                onClick={() => setKind(f.value)}
                                data-testid={`signals-filter-${f.value || "all"}`}
                                className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-colors font-mono ${
                                    kind === f.value
                                        ? "bg-neutral-950 text-white shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-950"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <select
                        value={sinceHours}
                        onChange={(e) => setSinceHours(parseInt(e.target.value))}
                        data-testid="signals-window"
                        className="px-3 py-1.5 rounded-md border border-neutral-300 bg-white text-sm"
                    >
                        <option value="24">24 год</option>
                        <option value="72">72 год</option>
                        <option value="168">7 днів</option>
                        <option value="720">30 днів</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs font-mono text-neutral-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={watchlistOnly}
                            onChange={(e) => setWatchlistOnly(e.target.checked)}
                            data-testid="signals-watchlist-toggle"
                            className="accent-orange-500"
                        />
                        Тільки watchlist
                    </label>
                    <span className="ml-auto text-xs font-mono text-neutral-500">
                        {loading ? "Завантаження…" : `${items.length} знайдено`}
                    </span>
                </div>
            </div>

            <div className="guru-card overflow-hidden" data-testid="signals-table">
                {items.length === 0 ? (
                    <div className="p-10 text-center text-neutral-500 text-sm">
                        <Bell size={28} className="mx-auto mb-3 text-neutral-300" />
                        Жодних сигналів за обраними фільтрами. Попробуйте розширити вікно або
                        вимкнути «тільки watchlist».
                    </div>
                ) : (
                    <ul className="divide-y divide-neutral-100">
                        {items.map((s) => (
                            <li
                                key={s.id}
                                data-testid={`signal-${s.id}`}
                                className="p-4 flex items-start gap-3 hover:bg-neutral-50/50"
                            >
                                {s.image ? (
                                    <img
                                        src={s.image}
                                        alt=""
                                        className="w-12 h-12 object-cover rounded border border-neutral-200 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded bg-neutral-100 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <SignalChip kind={s.kind} />
                                        <SourceBadge source={s.source} />
                                        <span className="text-[10px] font-mono text-neutral-500">
                                            {new Date(s.captured_at).toLocaleString("uk-UA", {
                                                day: "2-digit",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                    <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-neutral-950 hover:underline block truncate"
                                    >
                                        {s.product_title}
                                    </a>
                                    <div className="text-xs text-neutral-600 mt-0.5">{s.detail}</div>
                                    {s.seller || s.category ? (
                                        <div className="text-[11px] text-neutral-500 font-mono mt-1 flex flex-wrap gap-x-3">
                                            {s.seller ? <span>{s.seller}</span> : null}
                                            {s.category ? <span>· {s.category}</span> : null}
                                            {s.category_path?.length ? (
                                                <span>· {s.category_path.slice(-1)[0]}</span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => setHistoryKey(s.product_key)}
                                        title="Історія"
                                        className="text-neutral-400 hover:text-orange-600 p-1.5 rounded hover:bg-orange-50"
                                    >
                                        <History size={14} />
                                    </button>
                                    <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Відкрити"
                                        className="text-neutral-400 hover:text-orange-600 p-1.5 rounded hover:bg-orange-50"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </li>
                        ))}
                    </ul>
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
