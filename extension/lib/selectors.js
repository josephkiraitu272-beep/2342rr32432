// Guru Selector Resilience Engine
// Multi-selector strategy: try each candidate, fall back gracefully.
// This is the layer that makes the extension survive DOM drift on Rozetka/Epicentr.
(function () {
    if (window.GuruSel) return;

    const Sel = {
        /**
         * Return the first element that matches any of the provided selectors.
         * Selectors are tried in order — list "strict" ones first, then fallbacks.
         */
        q(root, ...selectors) {
            if (!root) return null;
            for (const s of selectors) {
                if (!s) continue;
                try {
                    const el = root.querySelector(s);
                    if (el) return el;
                } catch (e) {
                    /* invalid selector, ignore */
                }
            }
            return null;
        },

        /**
         * Return the first non-empty NodeList for any of the provided selectors.
         */
        qAll(root, ...selectors) {
            if (!root) return [];
            for (const s of selectors) {
                if (!s) continue;
                try {
                    const list = root.querySelectorAll(s);
                    if (list.length) return Array.from(list);
                } catch (e) {}
            }
            return [];
        },

        /** Resilient text content from any of the candidate selectors. */
        text(root, ...selectors) {
            const el = Sel.q(root, ...selectors);
            return el ? (el.textContent || "").trim() || null : null;
        },

        /** Get an attribute value from the first matching element. */
        attr(root, sel, attrName) {
            const el = Sel.q(root, sel);
            return el ? el.getAttribute(attrName) : null;
        },

        /** First matching ancestor for any of the candidate selectors. */
        closest(el, ...selectors) {
            if (!el) return null;
            for (const s of selectors) {
                if (!s) continue;
                try {
                    const found = el.closest(s);
                    if (found) return found;
                } catch (e) {}
            }
            return null;
        },

        /**
         * Try a series of extractor fns until one returns a truthy value.
         * Useful for cascading parser fallbacks.
         */
        tryFns(...fns) {
            for (const fn of fns) {
                try {
                    const v = fn();
                    if (v != null && v !== "") return v;
                } catch (e) {}
            }
            return null;
        },

        /** Match a regex against a sequence of texts and return the first hit. */
        textIncludes(root, texts) {
            const lower = (root.textContent || "").toLowerCase();
            for (const t of texts) {
                if (lower.includes(t.toLowerCase())) return t;
            }
            return null;
        },
    };

    window.GuruSel = Sel;
})();
