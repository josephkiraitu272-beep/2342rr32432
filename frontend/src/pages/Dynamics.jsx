import { useEffect, useMemo, useState } from "react";
import {
    TrendingDown,
    TrendingUp,
    Tag,
    ArrowDownRight,
    ArrowUpRight,
    Filter,
    Sparkles,
    Clock,
} from "lucide-react";
import {
    getPriceChanges,
    getTopDiscounts,
    getSellerDominance,
} from "@/lib/api";

const WINDOW_OPTIONS = [
    { value: "24h", label: "24 години" },
    { value: "7d", label: "7 днів" },
    { value: "30d", label: "30 днів" },
];

const SOURCE_OPTIONS = [
    { value: "", label: "Усі", color: "bg-neutral-950 text-white" },
    { value: "rozetka", label: "Rozetka", color: "bg-red-600 text-white" },
    { value: "epicentr", label: "Epicentr", color: "bg-amber-500 text-white" },
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

function DeltaPill({ pct, abs }) {
    if (pct == null) return <span className="text-neutral-400 font-mono">—</span>;
    const down = pct < 0;
    const Icon = down ? ArrowDownRight : ArrowUpRight;
    const cls = down
        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
        : "bg-red-50 border border-red-200 text-red-700";
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-xs ${cls}`}
        >
            <Icon size={12} />
            {pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%
            <span className="opacity-60">({abs > 0 ? "+" : ""}
                {Math.round(abs)} ₴)
            </span>
        </span>
    );
}

export default function Dynamics() {
    const [windowParam, setWindowParam] = useState("7d");
    const [source, setSource] = useState("");
    const [drops, setDrops] = useState({ items: [] });
    const [hikes, setHikes] = useState({ items: [] });
    const [discounts, setDiscounts] = useState([]);
    const [dominance, setDominance] = useState({ items: [], total_unique_products: 0 });
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try {
            const [d, h, td, sd] = await Promise.all([
                getPriceChanges({ window: windowParam, direction: "down", source, limit: 15 }),
                getPriceChanges({ window: windowParam, direction: "up", source, limit: 15 }),
                getTopDiscounts({ source, limit: 15 }),
                getSellerDominance({ source, limit: 8 }),
            ]);
            setDrops(d);
            setHikes(h);
            setDiscounts(td);
            setDominance(sd);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowParam, source]);

    const isEmpty = useMemo(
        () =>
            drops.items.length === 0 &&
            hikes.items.length === 0 &&
            discounts.length === 0 &&
            dominance.items.length === 0,
        [drops, hikes, discounts, dominance],
    );

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                        <span className="w-6 h-px bg-orange-500" />
                        Аналітика цін
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                        Динаміка
                    </h1>
                    <p className="mt-2 text-sm text-neutral-600 max-w-xl">
                        Шторм цін, топ-знижки та домінування продавців на Rozetka і Epicentr за обраний
                        період.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                        <Clock size={14} className="text-neutral-500 ml-2 mr-1" />
                        {WINDOW_OPTIONS.map((w) => (
                            <button
                                key={w.value}
                                onClick={() => setWindowParam(w.value)}
                                data-testid={`window-${w.value}`}
                                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                                    windowParam === w.value
                                        ? "bg-neutral-950 text-white shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-950"
                                }`}
                            >
                                {w.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                        <Filter size={14} className="text-neutral-500 ml-2 mr-1" />
                        {SOURCE_OPTIONS.map((p) => (
                            <button
                                key={p.value || "all"}
                                onClick={() => setSource(p.value)}
                                data-testid={`source-${p.value || "all"}`}
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
                </div>
            </div>

            {isEmpty ? (
                <div className="guru-card p-10 text-center">
                    <Sparkles size={28} className="mx-auto text-orange-500 mb-3" />
                    <div className="text-base text-neutral-700 font-semibold">
                        Ще не вистачає даних для динаміки
                    </div>
                    <div className="mt-2 text-sm text-neutral-500 max-w-md mx-auto">
                        Для порівняння цін потрібно щонайменше 2 захоплення одного товару. Пройдіться по
                        категоріям єще одного разу — і тут з’являться топ-падіння та рости ціни.
                    </div>
                </div>
            ) : null}

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="guru-card p-6" data-testid="price-drops-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950 flex items-center gap-2">
                            <TrendingDown size={20} className="text-emerald-600" /> Топ падіння
                            ціни
                        </h2>
                        <span className="text-xs font-mono text-neutral-500">{drops.items.length}</span>
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">Найбільші відсоткові падіння в обраному вікні</div>
                    <PriceChangeList items={drops.items} loading={loading} kind="down" />
                </div>

                <div className="guru-card p-6" data-testid="price-hikes-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950 flex items-center gap-2">
                            <TrendingUp size={20} className="text-red-600" /> Рости ціни
                        </h2>
                        <span className="text-xs font-mono text-neutral-500">{hikes.items.length}</span>
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">Найбільші подорожчання в обраному вікні</div>
                    <PriceChangeList items={hikes.items} loading={loading} kind="up" />
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 guru-card p-6" data-testid="top-discounts-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950 flex items-center gap-2">
                            <Tag size={20} className="text-rose-600" /> Топ знижок (зараз)
                        </h2>
                        <span className="text-xs font-mono text-neutral-500">{discounts.length}</span>
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">Актуальні знижки від старої ціни на картці</div>
                    {discounts.length === 0 && !loading ? (
                        <div className="py-8 text-center text-sm text-neutral-500">Знижок не знайдено</div>
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {discounts.map((d) => (
                                <li key={d.product_key} className="py-3 flex items-center gap-3">
                                    {d.image ? (
                                        <img
                                            src={d.image}
                                            alt=""
                                            className="w-12 h-12 object-cover rounded border border-neutral-200 flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded bg-neutral-100 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={d.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-medium text-neutral-950 truncate block hover:underline"
                                            title={d.title}
                                        >
                                            {d.title}
                                        </a>
                                        <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                                            <SourceBadge source={d.source} />
                                            {d.seller ? <span className="truncate">{d.seller}</span> : null}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="font-mono font-bold text-neutral-950">
                                            {Math.round(d.price)} ₴
                                        </div>
                                        <div className="text-[11px] text-neutral-400 line-through font-mono">
                                            {Math.round(d.old_price)} ₴
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-xs flex-shrink-0">
                                        −{Math.round(d.discount_percent)}%
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="lg:col-span-5 guru-card p-6" data-testid="seller-dominance-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950">Домінування продавців</h2>
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">
                        Частка від всіх відстежуваних товарів
                    </div>
                    {dominance.items.length === 0 && !loading ? (
                        <div className="py-8 text-center text-sm text-neutral-500">
                            Немає даних
                        </div>
                    ) : (
                        <ul className="space-y-2.5">
                            {dominance.items.map((s, i) => (
                                <li key={s.seller}>
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="font-semibold text-neutral-950 truncate">
                                            {String(i + 1).padStart(2, "0")} · {s.seller}
                                        </span>
                                        <span className="font-mono text-xs text-neutral-500">
                                            {s.unique_products} · {s.share_pct}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500"
                                            style={{ width: `${Math.min(100, s.share_pct)}%` }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function PriceChangeList({ items, loading, kind }) {
    if (loading && items.length === 0)
        return <div className="py-8 text-center text-sm text-neutral-500">Завантаження…</div>;
    if (items.length === 0)
        return (
            <div className="py-8 text-center text-sm text-neutral-500">
                Немає змін в обраному вікні
            </div>
        );
    return (
        <ul className="divide-y divide-neutral-100">
            {items.map((it) => (
                <li key={it.product_key} className="py-3 flex items-center gap-3">
                    {it.image ? (
                        <img
                            src={it.image}
                            alt=""
                            className="w-12 h-12 object-cover rounded border border-neutral-200 flex-shrink-0"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded bg-neutral-100 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <a
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-neutral-950 truncate block hover:underline"
                            title={it.title}
                        >
                            {it.title}
                        </a>
                        <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                            <span className="font-mono">
                                {Math.round(it.first_price)} ₴ → {Math.round(it.last_price)} ₴
                            </span>
                            {it.seller ? <span className="truncate">· {it.seller}</span> : null}
                        </div>
                    </div>
                    <DeltaPill pct={it.delta_pct} abs={it.delta_abs} />
                </li>
            ))}
        </ul>
    );
}
