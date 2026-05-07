import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
    Package,
    Tag,
    ShoppingBag,
    TrendingUp,
    TrendingDown,
    Boxes,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    Bell,
    Users,
    Activity,
    Radio,
    Database,
    Zap,
} from "lucide-react";
import {
    getSummary,
    getTopSellers,
    getSourceDistribution,
    getPages,
    getPriceChanges,
    getTopDiscounts,
    getPriceSignals,
    getToday,
} from "@/lib/api";

// Vibrant chart palette — readable, distinct
const CHART_COLORS = ["#f97316", "#dc2626", "#2563eb", "#16a34a", "#a855f7"];

const SELLER_PALETTE = [
    "border-l-orange-500",
    "border-l-blue-500",
    "border-l-emerald-500",
    "border-l-violet-500",
    "border-l-rose-500",
    "border-l-amber-500",
    "border-l-teal-500",
    "border-l-pink-500",
];

function MetricCard({ icon: Icon, label, value, hint, accent = "neutral", testId }) {
    const accents = {
        neutral: "text-neutral-400",
        orange: "text-orange-500",
        red: "text-red-500",
        amber: "text-amber-500",
        blue: "text-blue-500",
    };
    return (
        <div className="guru-card p-6" data-testid={testId}>
            <div className="flex items-start justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                    {label}
                </div>
                <Icon size={18} className={accents[accent]} strokeWidth={2.2} />
            </div>
            <div className="mt-3 font-mono text-3xl font-extrabold text-neutral-950">{value}</div>
            {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
        </div>
    );
}

const KPI_ACCENTS = {
    neutral: { ring: "ring-neutral-200", icon: "text-neutral-400" },
    orange: { ring: "ring-orange-200", icon: "text-orange-500" },
    blue: { ring: "ring-blue-200", icon: "text-blue-500" },
    violet: { ring: "ring-violet-200", icon: "text-violet-500" },
    rose: { ring: "ring-rose-200", icon: "text-rose-500" },
    emerald: { ring: "ring-emerald-200", icon: "text-emerald-600" },
};

function KPI({ icon: Icon, label, value, hint, accent = "neutral", testId }) {
    const a = KPI_ACCENTS[accent] || KPI_ACCENTS.neutral;
    return (
        <div
            className={`guru-card px-4 py-3.5 ring-1 ${a.ring} hover:shadow-sm transition-shadow`}
            data-testid={testId}
        >
            <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-mono">
                    {label}
                </div>
                <Icon size={14} className={a.icon} strokeWidth={2.2} />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-extrabold text-neutral-950 leading-none">
                {value}
            </div>
            {hint ? (
                <div className="mt-1 text-[10px] text-neutral-500 font-mono">{hint}</div>
            ) : null}
        </div>
    );
}

function LoopStep({ n, label, value, unit, icon: Icon, highlight = false }) {
    return (
        <div
            className={`relative rounded-lg p-4 border ${
                highlight
                    ? "bg-orange-500/10 border-orange-500/30"
                    : "bg-white/5 border-white/10"
            }`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-neutral-400">
                    {n} · {label}
                </span>
                <Icon
                    size={14}
                    className={highlight ? "text-orange-400" : "text-neutral-500"}
                />
            </div>
            <div className="font-mono text-3xl font-extrabold text-white leading-none">
                {Number(value).toLocaleString("uk-UA")}
            </div>
            <div className="mt-1 text-[10px] text-neutral-400 font-mono">{unit}</div>
        </div>
    );
}

function fmtSince(seconds) {
    if (seconds < 60) return `${seconds}с`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}хв`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}г`;
    return `${Math.floor(seconds / 86400)}д`;
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

function EmptyHint({ children }) {
    return (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6">
            <div className="text-sm text-neutral-600 leading-relaxed">{children}</div>
            <Link
                to="/install"
                data-testid="empty-install-link"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
                Встановити розширення <ArrowRight size={14} />
            </Link>
        </div>
    );
}

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [today, setToday] = useState(null);
    const [sellers, setSellers] = useState([]);
    const [dist, setDist] = useState({ items: [] });
    const [pages, setPages] = useState([]);
    const [drops, setDrops] = useState([]);
    const [discounts, setDiscounts] = useState([]);
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshedAt, setRefreshedAt] = useState(Date.now());
    const [now, setNow] = useState(Date.now());

    const refresh = async () => {
        setLoading(true);
        try {
            const [s, td, t, d, p, dr, tdsc, sig] = await Promise.all([
                getSummary(),
                getToday(),
                getTopSellers(8),
                getSourceDistribution(),
                getPages(8),
                getPriceChanges({ window: "7d", direction: "down", limit: 5 }).then(
                    (r) => r.items,
                ),
                getTopDiscounts({ limit: 5 }),
                getPriceSignals({ window: "24h", minDropPct: 5, limit: 8 }).then(
                    (r) => r.items,
                ),
            ]);
            setSummary(s);
            setToday(td);
            setSellers(t);
            setDist(d);
            setPages(p);
            setDrops(dr);
            setDiscounts(tdsc);
            setSignals(sig);
            setRefreshedAt(Date.now());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        const t = setInterval(refresh, 15000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const sinceRefresh = Math.max(0, Math.floor((now - refreshedAt) / 1000));
    const lastCaptureMs = today?.last_capture_at
        ? new Date(today.last_capture_at).getTime()
        : null;
    const sinceCapture = lastCaptureMs
        ? Math.max(0, Math.floor((now - lastCaptureMs) / 1000))
        : null;

    const isEmpty = !summary || summary.total_products === 0;

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                        <span className="w-6 h-px bg-orange-500" />
                        Marketplace Intelligence
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                        Огляд
                    </h1>
                </div>
                <div
                    className="flex items-center gap-2 flex-wrap"
                    data-testid="monitoring-strip"
                >
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold uppercase tracking-[0.16em]">
                        <Radio size={11} className="pulse-dot" />
                        LIVE
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700 text-[10px] font-mono font-bold uppercase tracking-[0.14em]">
                        <Zap size={11} />
                        Sync · auto 15s
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-neutral-200 text-neutral-700 text-[10px] font-mono uppercase tracking-[0.14em]">
                        <Activity size={11} className="text-orange-500" />
                        Оновлено: {sinceRefresh}c тому
                    </span>
                    {sinceCapture != null ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-neutral-200 text-neutral-700 text-[10px] font-mono uppercase tracking-[0.14em]">
                            <Database size={11} className="text-blue-500" />
                            Захоплено: {fmtSince(sinceCapture)}
                        </span>
                    ) : null}
                </div>
            </div>

            <div
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
                data-testid="kpi-strip"
            >
                <KPI
                    icon={Package}
                    label="Товарів"
                    value={summary?.total_products ?? "—"}
                    accent="orange"
                    testId="kpi-products"
                />
                <KPI
                    icon={Database}
                    label="Знімків"
                    value={summary?.price_snapshots ?? "—"}
                    accent="blue"
                    testId="kpi-snapshots"
                />
                <KPI
                    icon={Users}
                    label="Продавців"
                    value={summary?.total_sellers ?? "—"}
                    accent="violet"
                    testId="kpi-sellers"
                />
                <KPI
                    icon={Tag}
                    label="Сер. знижка"
                    value={
                        summary?.avg_discount_overall
                            ? `−${Math.round(summary.avg_discount_overall)}%`
                            : "—"
                    }
                    accent="rose"
                    testId="kpi-avg-discount"
                />
                <KPI
                    icon={TrendingDown}
                    label="Змін цін · 24г"
                    value={today?.price_changes_24h ?? "—"}
                    hint={today?.signals_24h ? `${today.signals_24h} сигналів` : null}
                    accent="emerald"
                    testId="kpi-changes"
                />
                <KPI
                    icon={Boxes}
                    label="Сторінок"
                    value={summary?.pages_collected ?? "—"}
                    accent="neutral"
                    testId="kpi-pages"
                />
            </div>

            <div className="guru-card-dark p-6 relative overflow-hidden" data-testid="dataloop-card">
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-orange-500/15 blur-3xl" />
                <div className="relative">
                    <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                        <div>
                            <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-orange-400 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-dot" />
                                Data loop · 24 години
                            </div>
                            <h2 className="text-2xl font-extrabold text-white">
                                Сьогодні зібрано
                            </h2>
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400">
                            Extension → Capture → Analytics → Insights
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <LoopStep
                            n="01"
                            label="Захоплено"
                            value={today?.products_24h ?? 0}
                            unit="товарів"
                            icon={Package}
                        />
                        <LoopStep
                            n="02"
                            label="Записано історії"
                            value={today?.snapshots_24h ?? 0}
                            unit="знімків"
                            icon={Database}
                        />
                        <LoopStep
                            n="03"
                            label="Виявлено зміни"
                            value={today?.price_changes_24h ?? 0}
                            unit="товарів"
                            icon={TrendingDown}
                        />
                        <LoopStep
                            n="04"
                            label="Сформовано сигнали"
                            value={today?.signals_24h ?? 0}
                            unit="≥ 5%"
                            icon={Bell}
                            highlight
                        />
                    </div>
                    <div className="mt-5 flex items-center gap-3 flex-wrap text-xs text-neutral-400 font-mono">
                        <span>
                            Активні джерела:{" "}
                            <span className="text-white font-bold">
                                {(today?.sources_active || []).join(" · ") || "—"}
                            </span>
                        </span>
                        <span>·</span>
                        <span>
                            Активних продавців за добу:{" "}
                            <span className="text-white font-bold">
                                {today?.sellers_24h ?? 0}
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 guru-card p-6" data-testid="distribution-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950">Розподіл</h2>
                        <Boxes size={16} className="text-orange-500" strokeWidth={2.2} />
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">
                        Топ продажів · Реклама · Власні · Фулфілмент · Інші
                    </div>
                    {isEmpty ? (
                        <EmptyHint>
                            Немає даних. Встановіть розширення, відкрийте Rozetka або Epicentr —
                            зведення з’явиться тут автоматично.
                        </EmptyHint>
                    ) : (
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={dist.items}
                                        dataKey="value"
                                        nameKey="label"
                                        innerRadius={62}
                                        outerRadius={104}
                                        paddingAngle={3}
                                        stroke="#fff"
                                        strokeWidth={2}
                                    >
                                        {dist.items.map((_, i) => (
                                            <Cell
                                                key={i}
                                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: "#0a0a0a",
                                            color: "#fff",
                                            border: 0,
                                            borderRadius: 8,
                                            fontFamily: "JetBrains Mono",
                                            fontSize: 11,
                                            padding: "6px 10px",
                                        }}
                                        labelStyle={{ color: "#a3a3a3" }}
                                        itemStyle={{ color: "#fff" }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        formatter={(v) => (
                                            <span className="text-xs text-neutral-700 font-medium">
                                                {v}
                                            </span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-7 guru-card p-6" data-testid="top-sellers-card">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-neutral-950">Лідери продажів</h2>
                            <div className="text-sm text-neutral-500">
                                Найбільше карток у зібраних видачах
                            </div>
                        </div>
                        <Link
                            to="/sellers"
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                            Усі <ArrowUpRight size={14} />
                        </Link>
                    </div>

                    {sellers.length === 0 ? (
                        <EmptyHint>
                            Список з’явиться після першого збору даних з категорії.
                        </EmptyHint>
                    ) : (
                        <ul className="space-y-2">
                            {sellers.map((s, i) => (
                                <li
                                    key={s.seller}
                                    data-testid={`seller-row-${i}`}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-lg border border-neutral-200 border-l-[4px] ${SELLER_PALETTE[i % SELLER_PALETTE.length]} bg-white hover:bg-neutral-50/60 transition-colors`}
                                >
                                    <span className="font-mono text-xs text-neutral-400 w-6">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-neutral-950 truncate">
                                            {s.seller}
                                        </div>
                                        <div className="text-xs text-neutral-500 font-mono mt-0.5 flex items-center gap-2">
                                            <span>{s.products} карток</span>
                                            {s.sources.map((src) => (
                                                <SourceBadge key={src} source={src} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-mono">
                                            Сер.
                                        </div>
                                        <div className="text-sm font-mono font-bold text-neutral-950">
                                            {s.avg_price ? `${Math.round(s.avg_price)} ₴` : "—"}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="guru-card p-6" data-testid="price-signals-card">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-bold text-neutral-950 flex items-center gap-2">
                        <Bell size={18} className="text-orange-500" />
                        Нові цінові сигнали
                        <span className="ml-2 text-xs font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                            24 год · ≥ 5%
                        </span>
                    </h2>
                    <Link
                        to="/dynamics"
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                        Уся динаміка <ArrowUpRight size={14} />
                    </Link>
                </div>
                <div className="text-sm text-neutral-500 mb-4">
                    Товари, чия ціна впала на ≥5% за останню добу
                </div>
                {signals.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-sm text-neutral-600">
                        Жодних значних сигналів за останні 24 години. Слідкуйте — щойно ціна
                        зміниться, тут з’явиться сигнал.
                    </div>
                ) : (
                    <ul className="grid md:grid-cols-2 gap-2">
                        {signals.map((s) => (
                            <li
                                key={s.product_key}
                                data-testid={`signal-row-${s.product_key}`}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:shadow-sm transition-shadow"
                            >
                                {s.image ? (
                                    <img
                                        src={s.image}
                                        alt=""
                                        className="w-10 h-10 object-cover rounded border border-neutral-200 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded bg-neutral-100 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-medium text-neutral-950 truncate block hover:underline"
                                    >
                                        {s.title}
                                    </a>
                                    <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                                        <SourceBadge source={s.source} />
                                        <span className="font-mono">
                                            {Math.round(s.first_price)} → {Math.round(s.last_price)}{" "}
                                            ₴
                                        </span>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold text-xs flex-shrink-0">
                                    <ArrowDownRight size={12} />
                                    {s.delta_pct?.toFixed(1)}%
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 guru-card p-6" data-testid="price-drops-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950 flex items-center gap-2">
                            <TrendingDown size={18} className="text-emerald-600" />
                            Найбільші падіння цін · 7д
                        </h2>
                        <Link
                            to="/dynamics"
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                            Динаміка <ArrowUpRight size={14} />
                        </Link>
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">
                        Товари з найбільшим відсотковим падінням ціни за вікно
                    </div>
                    {drops.length === 0 ? (
                        <EmptyHint>
                            Як тільки розширення зафіксує ту саму картку вдруге, тут з’явиться
                            динаміка ціни.
                        </EmptyHint>
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {drops.map((d) => (
                                <li
                                    key={d.product_key}
                                    data-testid={`drop-row-${d.product_key}`}
                                    className="py-3 flex items-center gap-3"
                                >
                                    {d.image ? (
                                        <img
                                            src={d.image}
                                            alt=""
                                            className="w-10 h-10 object-cover rounded border border-neutral-200 flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-neutral-100 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={d.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-medium text-neutral-950 truncate block hover:underline"
                                        >
                                            {d.title}
                                        </a>
                                        <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                                            <SourceBadge source={d.source} />
                                            <span className="font-mono">
                                                {Math.round(d.first_price)} →{" "}
                                                {Math.round(d.last_price)} ₴
                                            </span>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold text-xs">
                                        <ArrowDownRight size={12} />
                                        {d.delta_pct?.toFixed(1)}%
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="lg:col-span-5 guru-card p-6" data-testid="dashboard-discounts-card">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold text-neutral-950">Топ знижки зараз</h2>
                        <Link
                            to="/dynamics"
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                            Усі <ArrowUpRight size={14} />
                        </Link>
                    </div>
                    <div className="text-sm text-neutral-500 mb-4">
                        Найвищі знижки на актуальних картках
                    </div>
                    {discounts.length === 0 ? (
                        <EmptyHint>Знижки з’являться після першого збору.</EmptyHint>
                    ) : (
                        <ul className="space-y-2">
                            {discounts.map((d) => (
                                <li
                                    key={d.product_key}
                                    data-testid={`discount-row-${d.product_key}`}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-neutral-200 bg-white"
                                >
                                    {d.image ? (
                                        <img
                                            src={d.image}
                                            alt=""
                                            className="w-9 h-9 object-cover rounded border border-neutral-200 flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded bg-neutral-100 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={d.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-medium text-neutral-950 truncate block hover:underline"
                                        >
                                            {d.title}
                                        </a>
                                        <div className="text-[11px] text-neutral-500 font-mono">
                                            {Math.round(d.price)} ₴ ·{" "}
                                            <span className="line-through text-neutral-400">
                                                {Math.round(d.old_price)} ₴
                                            </span>
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
            </div>

            <div className="guru-card p-6" data-testid="recent-pages-card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-neutral-950">Останні сторінки</h2>
                    <Link
                        to="/history"
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                        Уся історія <ArrowUpRight size={14} />
                    </Link>
                </div>
                {pages.length === 0 ? (
                    <EmptyHint>
                        Як тільки розширення зафіксує сторінку категорії, тут з’явиться зведення:
                        середня ціна, діапазон, кількість карток.
                    </EmptyHint>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                                    <th className="py-2 pr-4">Джерело</th>
                                    <th className="py-2 pr-4">Сторінка</th>
                                    <th className="py-2 pr-4">Товарів</th>
                                    <th className="py-2 pr-4">Сер. ціна</th>
                                    <th className="py-2">Час</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pages.map((p) => (
                                    <tr
                                        key={p.id}
                                        className="border-t border-neutral-100"
                                        data-testid={`page-row-${p.id}`}
                                    >
                                        <td className="py-3 pr-4">
                                            <SourceBadge source={p.source} />
                                        </td>
                                        <td className="py-3 pr-4 max-w-md truncate">
                                            <a
                                                href={p.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="hover:underline text-neutral-950"
                                            >
                                                {p.title || p.url}
                                            </a>
                                        </td>
                                        <td className="py-3 pr-4 font-mono">{p.products_count}</td>
                                        <td className="py-3 pr-4 font-mono">
                                            {p.avg_price ? `${Math.round(p.avg_price)} ₴` : "—"}
                                        </td>
                                        <td className="py-3 text-neutral-500 font-mono text-xs">
                                            {new Date(p.captured_at).toLocaleString("uk-UA")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
