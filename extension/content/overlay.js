// Guru overlay — floating sticky panel + universal capture handler registry
(function () {
    if (window.__guruOverlay) return;
    window.__guruOverlay = true;

    const CHART = ["#f97316", "#dc2626", "#2563eb", "#16a34a", "#a855f7"];
    const GUTTER = "#e5e5e5";

    // Global registries — persist across overlay re-creations
    window.__guruHandler = window.__guruHandler || null;
    window.__guruLastError = null;

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === "class") node.className = v;
            else if (k === "style") node.style.cssText = v;
            else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
            else node.setAttribute(k, v);
        }
        for (const c of [].concat(children)) {
            if (c == null) continue;
            node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
        }
        return node;
    }

    function ensureOverlay(source) {
        let root = document.getElementById("guru-overlay-root");
        if (root) return root;

        root = el("div", { id: "guru-overlay-root", class: "guru-overlay" });

        const head = el("div", { class: "guru-overlay-head" }, [
            el("div", { class: "guru-brand" }, [
                el("span", { class: "guru-logo" }, "G"),
                el("span", {}, "Guru"),
                el("span", { class: "guru-source" }, source),
            ]),
            el("div", { class: "guru-actions" }, [
                el(
                    "button",
                    { title: "Згорнути", onclick: () => root.classList.toggle("guru-min") },
                    "—",
                ),
                el("button", { title: "Закрити", onclick: () => root.remove() }, "×"),
            ]),
        ]);

        const body = el("div", { class: "guru-overlay-body", id: "guru-body" });
        const cta = el(
            "button",
            { class: "guru-cta", id: "guru-cta-btn", "data-testid": "overlay-capture-btn" },
            [el("span", {}, "Зібрати дані"), el("span", { class: "guru-arrow" }, "→")],
        );
        const toast = el("div", { class: "guru-toast", id: "guru-toast" });

        // Wire up the click handler IMMEDIATELY using the global registry — this fixes the
        // race where bindCapture was called before the button existed.
        cta.addEventListener("click", async () => {
            const handler = window.__guruHandler;
            if (!handler) {
                setToast("Логіка ще не готова — оновіть сторінку", "err");
                return;
            }
            cta.disabled = true;
            setToast("Збираю…", "idle");
            try {
                const result = await handler();
                const n = result?.inserted ?? result?.items?.length ?? 0;
                setToast(`Надіслано ${n} товарів`, "ok");
                console.log("[Guru] capture sent:", n, "items", result);
            } catch (e) {
                window.__guruLastError = String(e?.message || e);
                console.error("[Guru] capture failed:", e);
                setToast("Помилка: " + window.__guruLastError.slice(0, 40), "err");
            } finally {
                cta.disabled = false;
            }
        });

        root.appendChild(head);
        root.appendChild(body);
        root.appendChild(cta);
        root.appendChild(toast);
        document.body.appendChild(root);
        return root;
    }

    function renderStats(stats, badgeDistribution) {
        const body = document.getElementById("guru-body");
        if (!body) return;
        body.innerHTML = "";

        body.appendChild(
            el("div", { class: "guru-row" }, [
                el("span", { class: "guru-label" }, "Знайдено карток"),
                el("span", { class: "guru-value" }, String(stats.products_count || 0)),
            ]),
        );
        if (stats.avg_price) {
            body.appendChild(
                el("div", { class: "guru-row" }, [
                    el("span", { class: "guru-label" }, "Середня ціна"),
                    el("span", { class: "guru-value" }, `${Math.round(stats.avg_price)} ₴`),
                ]),
            );
        }
        if (stats.min_price && stats.max_price) {
            body.appendChild(
                el("div", { class: "guru-row" }, [
                    el("span", { class: "guru-label" }, "Діапазон"),
                    el(
                        "span",
                        { class: "guru-value" },
                        `${Math.round(stats.min_price)} — ${Math.round(stats.max_price)} ₴`,
                    ),
                ]),
            );
        }

        const buckets = [
            { label: "Топ продажів", key: "top_sales", color: CHART[3] },
            { label: "Реклама", key: "ad", color: CHART[0] },
            { label: "Акція", key: "promo", color: CHART[1] },
            { label: "Вибір", key: "rozetka_choice", color: CHART[2] },
        ];
        const total = stats.products_count || 1;
        const bar = el("div", { class: "guru-bar" });
        const legend = el("div", { class: "guru-legend" });
        let other = total;
        for (const b of buckets) {
            const v = (badgeDistribution && badgeDistribution[b.key]) || 0;
            other -= v;
            const pct = (v / total) * 100;
            if (pct > 0) {
                bar.appendChild(el("span", { style: `width:${pct}%; background:${b.color};` }));
                legend.appendChild(
                    el("span", {}, [
                        el("span", { class: "guru-dot", style: `background:${b.color}` }),
                        el("strong", {}, String(v)),
                        b.label,
                    ]),
                );
            }
        }
        if (other > 0) {
            const pct = (other / total) * 100;
            bar.appendChild(el("span", { style: `width:${pct}%; background:${GUTTER};` }));
            legend.appendChild(
                el("span", {}, [
                    el("span", { class: "guru-dot", style: `background:${GUTTER}` }),
                    el("strong", {}, String(other)),
                    "Інші",
                ]),
            );
        }
        body.appendChild(bar);
        body.appendChild(legend);
    }

    function setToast(text, state = "idle") {
        const t = document.getElementById("guru-toast");
        if (!t) return;
        t.textContent = text;
        t.dataset.state = state;
    }

    function setHandler(handler) {
        window.__guruHandler = handler;
        console.log("[Guru] capture handler registered");
    }

    window.GuruOverlay = {
        ensure: ensureOverlay,
        render: renderStats,
        setToast,
        setHandler,
        // legacy alias
        bindCapture: setHandler,
    };
    window.PrizmaOverlay = window.GuruOverlay;
})();
