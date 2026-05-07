import { useState } from "react";
import { SCORE_LEVEL_LABELS, SCORE_LEVEL_STYLES } from "@/lib/api";
import { TrendingUp, Users, AlertTriangle, Sparkles, HelpCircle } from "lucide-react";

const KIND_META = {
    demand: { icon: TrendingUp, label: "Demand" },
    competition: { icon: Users, label: "Competition" },
    risk: { icon: AlertTriangle, label: "Risk" },
    opportunity: { icon: Sparkles, label: "Opportunity" },
};

export function ScoreChip({ kind, score, level, size = "sm" }) {
    const m = KIND_META[kind];
    if (!m) return null;
    const Icon = m.icon;
    const styleKey = level && level !== "unknown" ? `${kind}_${level}` : "unknown";
    const cls =
        SCORE_LEVEL_STYLES[styleKey] || SCORE_LEVEL_STYLES.unknown;
    const label = SCORE_LEVEL_LABELS[level] || "—";
    const padding = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]";
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase tracking-wider ${padding} ${cls}`}
            data-testid={`score-chip-${kind}-${level || "unknown"}`}
            title={`${m.label}: ${label}${score != null ? " · " + Math.round(score) : ""}`}
        >
            <Icon size={size === "xs" ? 10 : 11} strokeWidth={2.4} />
            <span>{m.label}</span>
            <span className="opacity-90">{label}</span>
        </span>
    );
}

export function ScoreBlock({ scoring, layout = "row" }) {
    if (!scoring) return null;
    const items = [
        { kind: "demand", data: scoring.demand },
        { kind: "competition", data: scoring.competition },
        { kind: "opportunity", data: scoring.opportunity },
        { kind: "risk", data: scoring.risk },
    ];
    return (
        <div className={layout === "row" ? "flex flex-wrap gap-1.5" : "grid grid-cols-2 gap-1.5"}>
            {items.map((it) => (
                <ScoreChip key={it.kind} kind={it.kind} score={it.data?.score} level={it.data?.level} />
            ))}
        </div>
    );
}

export function ScoreReasonsPopover({ scoring, anchor = "bottom-left" }) {
    if (!scoring) return null;
    const items = [
        { key: "demand", title: "Demand", data: scoring.demand },
        { key: "competition", title: "Competition", data: scoring.competition },
        { key: "risk", title: "Risk", data: scoring.risk },
        { key: "opportunity", title: "Opportunity", data: scoring.opportunity },
    ];
    const pos =
        anchor === "bottom-right"
            ? "right-0 top-full mt-1"
            : anchor === "top-left"
              ? "left-0 bottom-full mb-1"
              : "left-0 top-full mt-1";
    return (
        <div
            className={`absolute z-30 ${pos} w-80 rounded-lg border border-neutral-200 bg-white p-4 shadow-xl text-left`}
        >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-3">
                <Sparkles size={11} className="text-orange-500" />
                Чому такий score
            </div>
            <div className="space-y-3">
                {items.map((it) => {
                    if (!it.data || it.data.score == null) return null;
                    return (
                        <div key={it.key}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-700">
                                    {it.title}
                                </span>
                                <ScoreChip kind={it.key} score={it.data.score} level={it.data.level} size="xs" />
                            </div>
                            {it.data.reasons && it.data.reasons.length > 0 ? (
                                <ul className="space-y-0.5">
                                    {it.data.reasons.map((r, i) => (
                                        <li
                                            key={i}
                                            className="text-[11px] text-neutral-700 leading-snug flex items-start gap-1.5"
                                        >
                                            <span
                                                className={`font-mono font-bold w-10 text-right flex-shrink-0 ${r.weight < 0 ? "text-rose-700" : "text-emerald-700"}`}
                                            >
                                                {r.weight > 0 ? "+" : ""}{r.weight}
                                            </span>
                                            <span>{r.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-[11px] text-neutral-400 italic">Без причин</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function ScoreToggleBlock({ scoring }) {
    const [open, setOpen] = useState(false);
    if (!scoring) return null;
    return (
        <div className="relative inline-flex items-center gap-1.5">
            <ScoreBlock scoring={scoring} />
            <button
                onClick={() => setOpen(!open)}
                className="text-neutral-400 hover:text-orange-600 p-0.5 rounded"
                title="Чому?"
            >
                <HelpCircle size={13} />
            </button>
            {open ? <ScoreReasonsPopover scoring={scoring} /> : null}
        </div>
    );
}
