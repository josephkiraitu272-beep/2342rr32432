// Guru BaseAdapter — shared interface every marketplace adapter implements.
// Contract:
//   detect(): "listing" | "product" | null
//   parseListing(): RawProduct[]
//   parseProduct(): RawProduct | null
//   extractBreadcrumbs(): string[]
//   getTiles(): Element[]
//   injectInlineBadges(tiles, items): void
(function () {
    if (window.GuruBaseAdapter) return;

    class GuruBaseAdapter {
        constructor(source) {
            this.source = source;
        }
        detect() {
            return null;
        }
        getTiles() {
            return [];
        }
        parseListing() {
            return [];
        }
        parseProduct() {
            return null;
        }
        extractBreadcrumbs() {
            return [];
        }
        injectInlineBadges() {
            /* optional */
        }
    }

    window.GuruBaseAdapter = GuruBaseAdapter;
})();
