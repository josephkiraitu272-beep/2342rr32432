import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Tag,
    Database,
    ArrowRight,
    Search as SearchIcon,
    ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import {
    getWatchlist,
    addWatchlist,
    patchWatchlist,
    deleteWatchlist,
    getWatchlistCategories,
} from "@/lib/api";

function SourceBadge({ source }) {
    if (!source)
        return (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-neutral-100 border border-neutral-200 text-neutral-600">
                всі
            </span>
        );
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

export default function Watchlist() {
    const [items, setItems] = useState([]);
    const [discovered, setDiscovered] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSource, setNewSource] = useState("");

    const refresh = async () => {
        setLoading(true);
        try {
            const [wl, cats] = await Promise.all([getWatchlist(), getWatchlistCategories(200)]);
            setItems(wl.items || []);
            setDiscovered(cats.items || []);
        } catch (e) {
            console.error(e);
            toast.error("Не вдалось завантажити watchlist");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const onAdd = async (categoryName, source) => {
        const name = (categoryName || "").trim();
        if (!name) return;
        try {
            setAdding(true);
            const r = await addWatchlist({
                category_key: name,
                category_name: name,
                source: source || null,
                enabled: true,
                priority: 5,
            });
            toast.success(r.created ? "Додано до watchlist" : "Оновлено");
            setNewName("");
            await refresh();
        } catch (e) {
            console.error(e);
            toast.error("Помилка при додаванні");
        } finally {
            setAdding(false);
        }
    };

    const onToggle = async (it) => {
        await patchWatchlist(it.id, { enabled: !it.enabled });
        await refresh();
    };

    const onPriority = async (it, delta) => {
        const next = Math.max(0, (it.priority || 0) + delta);
        await patchWatchlist(it.id, { priority: next });
        await refresh();
    };

    const onDelete = async (it) => {
        if (!window.confirm(`Видалити «${it.category_name}» з watchlist?`)) return;
        await deleteWatchlist(it.id);
        toast.success("Видалено");
        await refresh();
    };

    const trackedSet = new Set(items.map((i) => `${i.category_key}|${i.source || ""}`));
    const filteredDiscovered = discovered.filter(
        (d) =>
            !trackedSet.has(`${d.category_key}|${d.source || ""}`) &&
            (!search || d.category_name.toLowerCase().includes(search.toLowerCase())),
    );

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                        <span className="w-6 h-px bg-orange-500" />
                        Tracked Categories
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                        Watchlist
                    </h1>
                    <p className="mt-3 text-neutral-600 max-w-2xl leading-relaxed">
                        Активні категорії визначають, які товари потрапляють у lifecycle, signals, огляд
                        ринку та product feed, коли вмикнено режим «Тільки watchlist».
                    </p>
                </div>
                <Link
                    to="/"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1.5"
                >
                    До огляду <ArrowRight size={14} />
                </Link>
            </div>

            <div className="guru-card p-6" data-testid="watchlist-add-card">
                <div className="flex items-center gap-2 mb-4">
                    <Plus size={16} className="text-orange-500" />
                    <h2 className="text-lg font-bold text-neutral-950">Додати категорію</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        data-testid="watchlist-new-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onAdd(newName, newSource);
                        }}
                        placeholder="Назва категорії (напр. «Смартфони»)"
                        className="flex-1 min-w-[260px] px-3 py-2.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
                    />
                    <select
                        data-testid="watchlist-new-source"
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        className="px-3 py-2.5 rounded-md border border-neutral-300 bg-white text-sm"
                    >
                        <option value="">Всі джерела</option>
                        <option value="rozetka">Rozetka</option>
                        <option value="epicentr">Epicentr</option>
                    </select>
                    <button
                        data-testid="watchlist-add-btn"
                        onClick={() => onAdd(newName, newSource)}
                        disabled={!newName.trim() || adding}
                        className="px-4 py-2.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
                    >
                        <Plus size={14} /> Додати
                    </button>
                </div>
            </div>

            <div className="guru-card p-6" data-testid="watchlist-active-card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ListFilter size={16} className="text-orange-500" />
                        <h2 className="text-lg font-bold text-neutral-950">Активні категорії</h2>
                        <span className="text-xs font-mono text-neutral-500">{items.length}</span>
                    </div>
                </div>
                {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-sm text-neutral-600">
                        Ще немає відстежуваних категорій. Додайте вище або оберіть зі списку «Доступні
                        категорії» нижче.
                    </div>
                ) : (
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map((it) => (
                            <li
                                key={it.id}
                                data-testid={`watchlist-item-${it.id}`}
                                className={`relative rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow ${
                                    it.enabled
                                        ? "border-neutral-200"
                                        : "border-neutral-200 opacity-60"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Tag size={13} className="text-orange-500 flex-shrink-0" />
                                            <SourceBadge source={it.source} />
                                            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                                                P{it.priority || 0}
                                            </span>
                                        </div>
                                        <div className="font-bold text-neutral-950 truncate text-base">
                                            {it.category_name}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-1">
                                    <button
                                        onClick={() => onToggle(it)}
                                        data-testid={`watchlist-toggle-${it.id}`}
                                        title={it.enabled ? "Вимкнути" : "Увімкнути"}
                                        className={`p-1.5 rounded text-xs font-semibold inline-flex items-center gap-1 ${
                                            it.enabled
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                        }`}
                                    >
                                        {it.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                                        {it.enabled ? "Активна" : "Пауза"}
                                    </button>
                                    <button
                                        onClick={() => onPriority(it, +1)}
                                        title="Пріоритет +1"
                                        className="px-2 py-1.5 rounded text-xs font-mono font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                                    >
                                        +
                                    </button>
                                    <button
                                        onClick={() => onPriority(it, -1)}
                                        title="Пріоритет −1"
                                        className="px-2 py-1.5 rounded text-xs font-mono font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                                    >
                                        −
                                    </button>
                                    <button
                                        onClick={() => onDelete(it)}
                                        data-testid={`watchlist-delete-${it.id}`}
                                        title="Видалити"
                                        className="ml-auto p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="guru-card p-6" data-testid="watchlist-discovered-card">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <Database size={16} className="text-blue-500" />
                        <h2 className="text-lg font-bold text-neutral-950">Доступні категорії</h2>
                        <span className="text-xs font-mono text-neutral-500">
                            {filteredDiscovered.length}
                        </span>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <SearchIcon
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                            data-testid="watchlist-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Пошук по категоріях…"
                            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
                        />
                    </div>
                </div>
                {loading ? (
                    <div className="text-sm text-neutral-500">Завантаження…</div>
                ) : filteredDiscovered.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-6 text-sm text-neutral-600">
                        Немає доступних категорій. Зберіть кілька товарів через розширення — вони
                        з’являться тут автоматично.
                    </div>
                ) : (
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {filteredDiscovered.slice(0, 60).map((d, i) => (
                            <li
                                key={`${d.category_key}-${d.source || ""}-${i}`}
                                data-testid={`discovered-${i}`}
                                className="flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
                            >
                                <SourceBadge source={d.source} />
                                <span className="flex-1 min-w-0 truncate text-sm font-medium text-neutral-800">
                                    {d.category_name}
                                </span>
                                <span className="text-[10px] font-mono text-neutral-400">
                                    {d.products_count}
                                </span>
                                <button
                                    onClick={() => onAdd(d.category_name, d.source)}
                                    title="Додати в watchlist"
                                    className="p-1 rounded hover:bg-orange-100 text-orange-600"
                                >
                                    <Plus size={14} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
