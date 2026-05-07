import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Sparkles,
    AlertTriangle,
    Activity,
    Anchor,
    Filter,
    ExternalLink,
    History as HistoryIcon,
    ArrowUpRight,
} from "lucide-react";
import {
    getOpportunities,
    getCategoryScoring,
    SCORE_LEVEL_STYLES,
} from "@/lib/api";
import { ScoreBlock, ScoreReasonsPopover } from "@/components/ScoreChip";
import { LifecycleChip } from "@/components/IntelChips";
import ProductHistoryModal from "@/components/ProductHistoryModal";

const SECTIONS = [
    {
        key: "trending",
        title: "Трендові можливості",
        subtitle: "Високий opportunity за низького/середнього ризику",
        icon: Sparkles,
        accent: "text-orange-500",
        empty: "Немає трендових можливостей за поточними фільтрами.",
    },
    {
        key: "emerging",
        title: "Нові та зростаючі",
        subtitle: "Товари в lifecycle new/growing з добрим попитом",
        icon: Activity,
        accent: "text-emerald-600",
        empty: "Новинок/зростаючих товарів поки не виявлено.",
    },
    {
        key: "stable",
        title: "Стабільні лідери",
        subtitle: "Active, низька волатильність, стабільний попит",
        icon: Anchor,
        accent: "text-blue-500",
        empty: "Для висновку про стабільність потрібно ≥ 5 знімків на товар. Збирайте більше даних.",
    },
    {
        key: "risk",
        title: "Високий ризик",
        subtitle: "Цінові війни, агресивні знижки, declining lifecycle",
        icon: AlertTriangle,
        accent: "text-rose-600",
        empty: "Поки немає товарів з підвищеним ризиком.",
    },
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

function OpportunityRow({ item, onHistory }) {
    const [openWhy, setOpenWhy] = useState(false);
    return (
        <li
            data-testid={`opp-row-${item.product_key}`}
            className="py-3 px-3 rounded-lg border border-neutral-200 bg-white hover:shadow-sm transition-shadow flex items-start gap-3 relative"
        >
            {item.image ? (
                <img
                    src={item.image}
                    alt=""
                    className="w-12 h-12 object-cover rounded border border-neutral-200 flex-shrink-0"
                />
            ) : (
                <div className="w-12 h-12 rounded bg-neutral-100 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <SourceBadge source={item.source} />
                    <LifecycleChip status={item.lifecycle_status} size="xs" />
                    <span className="text-[10px] font-mono text-neutral-400">
                        {item.category}
                    </span>
                </div>
                <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-neutral-950 hover:underline block truncate"
                >
                    {item.title}
                </a>
                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                    {item.seller || "—"} · {item.price ? `${Math.round(item.price)} ₴` : "—"}
                    {item.discount_percent ? (
                        <span className="text-rose-700 ml-1">
                            −{Math.round(item.discount_percent)}%
                        </span>
                    ) : null}
                </div>
                <div className="mt-2 relative">
                    <div className="flex items-center gap-2 flex-wrap">
                        <ScoreBlock scoring={item} />
                        <button
                            onClick={() => setOpenWhy(!openWhy)}
                            data-testid={`opp-why-${item.product_key}`}
                            className="text-[10px] font-mono text-orange-600 hover:text-orange-700 underline decoration-dotted"
                        >
                            {openWhy ? "сховати" : "чому?"}
                        </button>
                    </div>
                    {openWhy ? <ScoreReasonsPopover scoring={item} /> : null}
                </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button
                    onClick={() => onHistory(item.product_key)}
                    title="Історія"
                    className="text-neutral-400 hover:text-orange-600 p-1.5 rounded hover:bg-orange-50"
                >
                    <HistoryIcon size={14} />
                </button>
                <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Відкрити"
                    className="text-neutral-400 hover:text-orange-600 p-1.5 rounded hover:bg-orange-50"
                >
                    <ExternalLink size={14} />
                </a>
            </div>
        </li>
    );
}

export default function Opportunities() {
    const [data, setData] = useState({ trending: [], emerging: [], stable: [], risk: [] });
    const [categories, setCategories] = useState([]);
    const [active, setActive] = useState("trending");
    const [source, setSource] = useState("");
    const [watchlistOnly, setWatchlistOnly] = useState(false);
    const [historyKey, setHistoryKey] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try {
            const [tr, em, st, rk, cats] = await Promise.all([
                getOpportunities("trending", { source: source || undefined, watchlistOnly, limit: 30 }),
                getOpportunities("emerging", { source: source || undefined, watchlistOnly, limit: 30 }),
                getOpportunities("stable", { source: source || undefined, watchlistOnly, limit: 30 }),
                getOpportunities("risk", { source: source || undefined, watchlistOnly, limit: 30 }),
                getCategoryScoring({ source: source || undefined, watchlistOnly, limit: 20 }),
            ]);
            setData({
                trending: tr.items || [],
                emerging: em.items || [],
                stable: st.items || [],
                risk: rk.items || [],
            });
            setCategories(cats.items || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, watchlistOnly]);

    const counts = useMemo(
        () => ({
            trending: data.trending.length,
            emerging: data.emerging.length,
            stable: data.stable.length,
            risk: data.risk.length,
        }),
        [data],
    );

    const items = data[active] || [];

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                        <span className="w-6 h-px bg-orange-500" />
                        Decision Intelligence
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                        Можливості
                    </h1>
                    <p className="mt-3 text-neutral-600 max-w-2xl leading-relaxed">
                        Чотири score на ринок: <strong>Demand</strong>, <strong>Competition</strong>,
                        <strong> Risk</strong>, <strong>Opportunity</strong>. Комбінації визначають, де
                        варто заходити в асортимент, а де обходити. Без AI, все детерміновано ї
                        explainable.
                    </p>
                </div>
                <Link
                    to="/lifecycle"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1.5"
                >
                    Lifecycle feed <ArrowUpRight size={14} />
                </Link>
            </div>

            <div className="guru-card p-4" data-testid="opportunities-filters">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 p-1 rounded-md bg-neutral-100">
                        <Filter size={14} className="text-neutral-500 ml-2 mr-1" />
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
                            data-testid="opportunities-watchlist-toggle"
                            className="accent-orange-500"
                        />
                        Тільки watchlist
                    </label>
                    <span className="ml-auto text-xs font-mono text-neutral-500">
                        {loading ? "Завантаження…" : `Побудовано ${(items || []).length}`}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="opportunity-tabs">
                {SECTIONS.map((s) => {
                    const Icon = s.icon;
                    const isActive = active === s.key;
                    return (
                        <button
                            key={s.key}
                            onClick={() => setActive(s.key)}
                            data-testid={`opp-tab-${s.key}`}
                            className={`text-left guru-card p-4 transition-all ${
                                isActive
                                    ? "ring-2 ring-orange-300 ring-offset-1 -translate-y-0.5 shadow-md"
                                    : "hover:shadow-sm hover:-translate-y-0.5"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Icon size={18} className={s.accent} strokeWidth={2.2} />
                                <span className="font-mono font-extrabold text-2xl text-neutral-950">
                                    {counts[s.key]}
                                </span>
                            </div>
                            <div className="font-bold text-neutral-950">{s.title}</div>
                            <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                                {s.subtitle}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="guru-card p-6" data-testid="opportunity-list">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-neutral-950">
                        {SECTIONS.find((s) => s.key === active)?.title}
                    </h2>
                </div>
                {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-sm text-neutral-600">
                        {SECTIONS.find((s) => s.key === active)?.empty}
                    </div>
                ) : (
                    <ul className="grid lg:grid-cols-2 gap-3">
                        {items.map((it) => (
                            <OpportunityRow
                                key={it.product_key}
                                item={it}
                                onHistory={setHistoryKey}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <div className="guru-card p-6" data-testid="category-scoring-card">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-neutral-950">Категорії ринку</h2>
                        <div className="text-sm text-neutral-500">
                            Агреговані score по категоріях · ранжир за opportunity
                        </div>
                    </div>
                </div>
                {categories.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-sm text-neutral-600">
                        Ще немає категорій з 3+ товарами. Збирайте більше даних.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                                    <th className="py-2 pr-4">Категорія</th>
                                    <th className="py-2 pr-4 text-right">Товарів</th>
                                    <th className="py-2 pr-4 text-right">Нові</th>
                                    <th className="py-2 pr-4 text-right">Зняті</th>
                                    <th className="py-2 pr-4">Demand</th>
                                    <th className="py-2 pr-4">Competition</th>
                                    <th className="py-2 pr-4">Risk</th>
                                    <th className="py-2">Opportunity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c, i) => (
                                    <tr
                                        key={c.category}
                                        data-testid={`category-row-${i}`}
                                        className="border-t border-neutral-100"
                                    >
                                        <td className="py-2.5 pr-4 font-bold text-neutral-950">
                                            {c.category}
                                        </td>
                                        <td className="py-2.5 pr-4 text-right font-mono text-neutral-700">
                                            {c.products}
                                        </td>
                                        <td className="py-2.5 pr-4 text-right font-mono text-emerald-700">
                                            {c.new_products || "—"}
                                        </td>
                                        <td className="py-2.5 pr-4 text-right font-mono text-neutral-500">
                                            {c.removed_products || "—"}
                                        </td>
                                        <td className="py-2.5 pr-4">
                                            <CategoryScoreBadge
                                                kind="demand"
                                                score={c.demand?.score}
                                                level={c.demand?.level}
                                            />
                                        </td>
                                        <td className="py-2.5 pr-4">
                                            <CategoryScoreBadge
                                                kind="competition"
                                                score={c.competition?.score}
                                                level={c.competition?.level}
                                            />
                                        </td>
                                        <td className="py-2.5 pr-4">
                                            <CategoryScoreBadge
                                                kind="risk"
                                                score={c.risk?.score}
                                                level={c.risk?.level}
                                            />
                                        </td>
                                        <td className="py-2.5">
                                            <CategoryScoreBadge
                                                kind="opportunity"
                                                score={c.opportunity?.score}
                                                level={c.opportunity?.level}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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

function CategoryScoreBadge({ kind, score, level }) {
    if (score == null)
        return <span className="text-xs text-neutral-400 font-mono">—</span>;
    const styleKey = `${kind}_${level}`;
    const cls = SCORE_LEVEL_STYLES[styleKey] || SCORE_LEVEL_STYLES.unknown;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase tracking-wider px-2 py-0.5 text-[11px] ${cls}`}
        >
            {Math.round(score)} <span className="opacity-80">{level}</span>
        </span>
    );
}
