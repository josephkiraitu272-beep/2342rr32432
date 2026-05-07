import { useEffect, useState } from "react";
import { getPages } from "@/lib/api";
import { Clock } from "lucide-react";

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

export default function History() {
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const items = await getPages(100);
                setPages(items);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                    <span className="w-6 h-px bg-orange-500" />
                    Хронологія
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                    Історія
                </h1>
            </div>

            <div className="guru-card p-2" data-testid="history-list">
                {loading ? (
                    <div className="p-6 text-sm text-neutral-500">Завантаження…</div>
                ) : pages.length === 0 ? (
                    <div className="p-10 text-center text-sm text-neutral-500">
                        Поки що немає історії. Як тільки розширення зафіксує першу сторінку, вона
                        з’явиться тут.
                    </div>
                ) : (
                    <ul>
                        {pages.map((p, idx) => (
                            <li
                                key={p.id}
                                data-testid={`history-row-${idx}`}
                                className="flex items-start gap-4 px-4 py-4 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60 transition-colors"
                            >
                                <div
                                    className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                                        p.source === "rozetka"
                                            ? "bg-red-50 text-red-600"
                                            : "bg-amber-50 text-amber-700"
                                    }`}
                                >
                                    <Clock size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <SourceBadge source={p.source} />
                                        <span className="text-xs text-neutral-500 font-mono">
                                            {new Date(p.captured_at).toLocaleString("uk-UA")}
                                        </span>
                                    </div>
                                    <a
                                        href={p.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-semibold text-neutral-950 hover:text-orange-600 truncate block"
                                    >
                                        {p.title || p.url}
                                    </a>
                                    <div className="text-xs text-neutral-500 mt-1 font-mono">
                                        {p.products_count} товарів
                                        {p.avg_price ? (
                                            <>
                                                <span className="mx-1.5">·</span>сер.{" "}
                                                <span className="text-neutral-950 font-semibold">
                                                    {Math.round(p.avg_price)} ₴
                                                </span>
                                            </>
                                        ) : null}
                                        {p.min_price && p.max_price ? (
                                            <>
                                                <span className="mx-1.5">·</span>
                                                {Math.round(p.min_price)} —{" "}
                                                {Math.round(p.max_price)} ₴
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
