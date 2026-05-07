import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    ReferenceLine,
} from "recharts";
import { X, ExternalLink, ShieldCheck, ShieldAlert, ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp, Tag, Flame, Clock, Minus, Sparkles, Link as LinkIcon, Check } from "lucide-react";
import { getProductByKey, getProductHistory, getProductInsights } from "@/lib/api";

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

function fmtTime(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch (e) {
        return iso;
    }
}

export default function ProductHistoryModal({ productKey, onClose }) {
    const [product, setProduct] = useState(null);
    const [history, setHistory] = useState([]);
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!productKey) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const [p, h, ins] = await Promise.all([
                    getProductByKey(productKey),
                    getProductHistory(productKey, 500),
                    getProductInsights(productKey).catch(() => ({ items: [] })),
                ]);
                if (cancelled) return;
                setProduct(p);
                setHistory(h.items || []);
                setInsights(ins.items || []);
            } catch (e) {
                if (cancelled) return;
                setErr(e?.response?.data?.detail || String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [productKey]);

    const copyShareLink = async () => {
        try {
            const url = `${window.location.origin}/products/${encodeURIComponent(productKey)}`;
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            /* ignore */
        }
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!productKey) return null;

    const chartData = history.map((s) => ({
        ts: new Date(s.captured_at).getTime(),
        date: fmtTime(s.captured_at),
        price: s.price,
        old_price: s.old_price || null,
    }));

    const first = history[0];
    const last = history[history.length - 1];
    const delta = first && last && first.price ? last.price - first.price : 0;
    const deltaPct = first && first.price ? (delta / first.price) * 100 : 0;
    const minPrice = chartData.length
        ? Math.min(...chartData.map((d) => d.price).filter(Boolean))
        : null;
    const maxPrice = chartData.length
        ? Math.max(...chartData.map((d) => d.price).filter(Boolean))
        : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-950/60 backdrop-blur-sm p-0 sm:p-6"
            onClick={onClose}
            data-testid="product-history-modal"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
                <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-mono font-bold">
                            Історія ціни
                        </div>
                        {product?.source && <SourceBadge source={product.source} />}
                        <div className="font-mono text-[11px] text-neutral-400 truncate">
                            {productKey}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyShareLink}
                            data-testid="history-modal-copy-link"
                            title="Скопіювати посилання"
                            className="text-xs font-semibold text-neutral-700 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50"
                        >
                            {copied ? <Check size={13} className="text-emerald-600" /> : <LinkIcon size={13} />}
                            {copied ? "Скопійовано" : "Поділитися"}
                        </button>
                        <button
                            onClick={onClose}
                            data-testid="history-modal-close"
                            className="text-neutral-400 hover:text-neutral-950 p-1 rounded hover:bg-neutral-100"
                            aria-label="Закрити"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="overflow-y-auto p-6 space-y-6">
                    {loading && (
                        <div className="py-16 text-center text-neutral-500 text-sm">Завантаження…</div>
                    )}
                    {err && (
                        <div className="py-16 text-center text-red-600 text-sm">{err}</div>
                    )}
                    {!loading && !err && product && (
                        <>
                            <div className="flex items-start gap-5">
                                {product.image ? (
                                    <img
                                        src={product.image}
                                        alt=""
                                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-neutral-200 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-neutral-100 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <a
                                        href={product.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xl font-bold text-neutral-950 hover:underline inline-flex items-start gap-2"
                                    >
                                        <span>{product.title}</span>
                                        <ExternalLink size={14} className="mt-1.5 text-neutral-400 flex-shrink-0" />
                                    </a>
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                                        {product.brand && <span>Бренд: <strong>{product.brand}</strong></span>}
                                        {product.seller && <span>Продавець: <strong>{product.seller}</strong></span>}
                                        {product.category_path?.length ? (
                                            <span className="text-neutral-500 truncate">
                                                {product.category_path.join(" › ")}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Stat label="Поточна" value={product.price ? `${Math.round(product.price)} ₴` : "—"} accent="orange" />
                                        <Stat
                                            label="Стара"
                                            value={
                                                product.old_price ? `${Math.round(product.old_price)} ₴` : "—"
                                            }
                                            strike={!!product.old_price}
                                        />
                                        <Stat
                                            label="Знижка"
                                            value={
                                                product.discount_percent
                                                    ? `−${Math.round(product.discount_percent)}%`
                                                    : "—"
                                            }
                                            accent={product.discount_percent ? "rose" : "neutral"}
                                        />
                                        <Stat
                                            label="Наявність"
                                            value={
                                                product.availability == null
                                                    ? "—"
                                                    : product.availability
                                                      ? "Є"
                                                      : "Немає"
                                            }
                                            icon={
                                                product.availability == null ? null : product.availability ? (
                                                    <ShieldCheck size={14} className="text-emerald-600" />
                                                ) : (
                                                    <ShieldAlert size={14} className="text-red-600" />
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <InsightsCard insights={insights} />

                            <div className="guru-card p-5">
                                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                                    <div>
                                        <h3 className="text-base font-bold text-neutral-950">Графік ціни</h3>
                                        <div className="text-xs text-neutral-500">
                                            {history.length} захоплень · від {fmtTime(first?.captured_at)} до {fmtTime(last?.captured_at)}
                                        </div>
                                    </div>
                                    {history.length >= 2 ? (
                                        <DeltaPill pct={deltaPct} abs={delta} />
                                    ) : null}
                                </div>
                                {history.length < 2 ? (
                                    <div className="py-12 text-center text-sm text-neutral-500">
                                        Потрібні щонайменше 2 захоплення для побудови графіку. Захопіть цю
                                        сторінку ще раз.
                                    </div>
                                ) : (
                                    <div style={{ width: "100%", height: 280 }}>
                                        <ResponsiveContainer>
                                            <LineChart data={chartData}>
                                                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#a3a3a3"
                                                    fontSize={10}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    stroke="#a3a3a3"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    domain={["dataMin - 50", "dataMax + 50"]}
                                                    tickFormatter={(v) => `${Math.round(v)}₴`}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: "#0a0a0a",
                                                        border: 0,
                                                        borderRadius: 8,
                                                        fontSize: 11,
                                                        fontFamily: "JetBrains Mono",
                                                        padding: "6px 10px",
                                                    }}
                                                    labelStyle={{ color: "#a3a3a3" }}
                                                    itemStyle={{ color: "#fff" }}
                                                    formatter={(v) => [`${Math.round(v)} ₴`, "Ціна"]}
                                                />
                                                {minPrice ? (
                                                    <ReferenceLine
                                                        y={minPrice}
                                                        stroke="#16a34a"
                                                        strokeDasharray="3 3"
                                                        label={{ value: `min ${Math.round(minPrice)}`, fill: "#16a34a", fontSize: 10, position: "insideBottomLeft" }}
                                                    />
                                                ) : null}
                                                {maxPrice && maxPrice !== minPrice ? (
                                                    <ReferenceLine
                                                        y={maxPrice}
                                                        stroke="#dc2626"
                                                        strokeDasharray="3 3"
                                                        label={{ value: `max ${Math.round(maxPrice)}`, fill: "#dc2626", fontSize: 10, position: "insideTopLeft" }}
                                                    />
                                                ) : null}
                                                <Line
                                                    type="monotone"
                                                    dataKey="price"
                                                    stroke="#f97316"
                                                    strokeWidth={2.5}
                                                    dot={{ fill: "#f97316", r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {history.length > 0 ? (
                                <div className="guru-card p-5">
                                    <h3 className="text-base font-bold text-neutral-950 mb-3">Таблиця змін</h3>
                                    <div className="max-h-[260px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-white">
                                                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                                                    <th className="py-2">Час</th>
                                                    <th className="py-2 text-right">Ціна</th>
                                                    <th className="py-2 text-right">Стара</th>
                                                    <th className="py-2 text-right">Знижка</th>
                                                    <th className="py-2">Продавець</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...history].reverse().map((s) => (
                                                    <tr key={s.captured_at} className="border-t border-neutral-100">
                                                        <td className="py-2 font-mono text-xs text-neutral-600">
                                                            {fmtTime(s.captured_at)}
                                                        </td>
                                                        <td className="py-2 text-right font-mono font-bold">
                                                            {s.price != null ? `${Math.round(s.price)} ₴` : "—"}
                                                        </td>
                                                        <td className="py-2 text-right font-mono text-neutral-400 line-through">
                                                            {s.old_price ? `${Math.round(s.old_price)} ₴` : "—"}
                                                        </td>
                                                        <td className="py-2 text-right font-mono">
                                                            {s.discount_percent
                                                                ? <span className="text-rose-600 font-bold">−{Math.round(s.discount_percent)}%</span>
                                                                : "—"}
                                                        </td>
                                                        <td className="py-2 text-neutral-700 truncate max-w-[160px]">
                                                            {s.seller || "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, accent = "neutral", strike = false, icon }) {
    const colors = {
        neutral: "text-neutral-950",
        orange: "text-orange-600",
        rose: "text-rose-600",
    };
    return (
        <div className="rounded-md border border-neutral-200 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-mono">
                {label}
            </div>
            <div
                className={`mt-1 font-mono font-bold text-base flex items-center gap-1.5 ${colors[accent]} ${strike ? "line-through opacity-60" : ""}`}
            >
                {icon}
                {value}
            </div>
        </div>
    );
}

function DeltaPill({ pct, abs }) {
    if (pct == null || !isFinite(pct)) return null;
    const down = pct < 0;
    const Icon = down ? ArrowDownRight : ArrowUpRight;
    const cls = down
        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
        : "bg-red-50 border border-red-200 text-red-700";
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded font-mono font-bold text-xs ${cls}`}
        >
            <Icon size={12} />
            {pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%
            <span className="opacity-70">
                ({abs > 0 ? "+" : ""}
                {Math.round(abs)} ₴)
            </span>
        </span>
    );
}

const INSIGHT_ICONS = {
    "trending-down": TrendingDown,
    "trending-up": TrendingUp,
    "arrow-down-right": ArrowDownRight,
    "arrow-up-right": ArrowUpRight,
    tag: Tag,
    flame: Flame,
    clock: Clock,
    minus: Minus,
    "shield-alert": ShieldAlert,
};

const INSIGHT_LEVEL = {
    good: "bg-emerald-50 border-emerald-200 text-emerald-700",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-blue-50 border-blue-200 text-blue-700",
    neutral: "bg-neutral-50 border-neutral-200 text-neutral-700",
};

function InsightsCard({ insights }) {
    return (
        <div
            className="guru-card p-5 relative overflow-hidden"
            data-testid="market-insights-card"
        >
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-orange-500/8 blur-3xl" />
            <div className="relative">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                    <div>
                        <h3 className="text-base font-bold text-neutral-950 flex items-center gap-2">
                            <Sparkles size={16} className="text-orange-500" /> Market Insight
                        </h3>
                        <div className="text-xs text-neutral-500">
                            Автоматичні висновки на основі історії захоплень
                        </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        {insights.length} сигн{insights.length === 1 ? "ал" : "али"}
                    </span>
                </div>
                {insights.length === 0 ? (
                    <div className="py-6 text-center text-sm text-neutral-500">
                        Ще не вистачає даних для висновків. Захопіть товар ще кілька разів — і
                        тут з’явиться розгорнутий профіль.
                    </div>
                ) : (
                    <ul className="grid sm:grid-cols-2 gap-2">
                        {insights.map((it, idx) => {
                            const Icon = INSIGHT_ICONS[it.icon] || Sparkles;
                            const cls = INSIGHT_LEVEL[it.level] || INSIGHT_LEVEL.neutral;
                            return (
                                <li
                                    key={`${it.kind}-${idx}`}
                                    data-testid={`insight-${it.kind}`}
                                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${cls}`}
                                >
                                    <div className="mt-0.5 flex-shrink-0">
                                        <Icon size={15} strokeWidth={2.2} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm leading-tight">
                                            {it.title}
                                        </div>
                                        <div className="text-xs opacity-80 mt-0.5">
                                            {it.detail}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
