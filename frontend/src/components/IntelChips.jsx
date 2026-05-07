import { LIFECYCLE_LABELS, LIFECYCLE_STYLES, SIGNAL_LABELS, SIGNAL_STYLES } from "@/lib/api";

export function LifecycleChip({ status, withLabel = true, size = "sm" }) {
    if (!status) return null;
    const cls = LIFECYCLE_STYLES[status] || "bg-neutral-100 border-neutral-200 text-neutral-700";
    const label = LIFECYCLE_LABELS[status] || status;
    const padding = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase tracking-wider ${padding} ${cls}`}
            data-testid={`lifecycle-chip-${status}`}
            title={label}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {withLabel ? label : null}
        </span>
    );
}

export function SignalChip({ kind, size = "sm" }) {
    if (!kind) return null;
    const cls = SIGNAL_STYLES[kind] || "bg-neutral-100 border-neutral-200 text-neutral-700";
    const label = SIGNAL_LABELS[kind] || kind;
    const padding = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
    return (
        <span
            className={`inline-flex items-center rounded border font-mono font-bold uppercase tracking-wider ${padding} ${cls}`}
            data-testid={`signal-chip-${kind}`}
        >
            {label}
        </span>
    );
}

export function ReasonsTooltip({ reasons }) {
    if (!reasons || reasons.length === 0) return null;
    return (
        <div
            role="tooltip"
            className="absolute z-20 left-0 top-full mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg text-left"
        >
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-2">
                Чому
            </div>
            <ul className="space-y-1">
                {reasons.map((r, i) => (
                    <li key={i} className="text-xs text-neutral-700 leading-snug flex gap-1.5">
                        <span className="text-orange-500 font-bold">·</span>
                        <span>{r}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
