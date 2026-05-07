import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Boxes,
    Users,
    Clock,
    Puzzle,
    LineChart,
} from "lucide-react";

const NAV = [
    { to: "/", label: "Огляд", icon: LayoutDashboard, end: true },
    { to: "/products", label: "Товари", icon: Boxes },
    { to: "/dynamics", label: "Динаміка", icon: LineChart },
    { to: "/sellers", label: "Продавці", icon: Users },
    { to: "/history", label: "Історія", icon: Clock },
    { to: "/install", label: "Розширення", icon: Puzzle },
];

export default function Layout() {
    const loc = useLocation();
    return (
        <div className="min-h-screen bg-[var(--guru-bg)] text-[var(--guru-text)]">
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/90 border-b border-neutral-200">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-6">
                    <Link to="/" className="flex items-center gap-2.5" data-testid="logo-link">
                        <div className="relative w-9 h-9 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-mono font-bold text-base">
                            G
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
                        </div>
                        <div className="leading-tight">
                            <div className="font-extrabold tracking-tight text-neutral-950 text-lg">
                                Guru
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-mono">
                                rozetka · epicentr
                            </div>
                        </div>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1 ml-4">
                        {NAV.map((n) => {
                            const Icon = n.icon;
                            const active = n.end
                                ? loc.pathname === "/"
                                : loc.pathname.startsWith(n.to);
                            return (
                                <NavLink
                                    key={n.to}
                                    to={n.to}
                                    end={n.end}
                                    data-testid={`nav-${n.label}`}
                                    className={`relative px-3.5 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
                                        active
                                            ? "bg-orange-500 text-white shadow-sm"
                                            : "text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100"
                                    }`}
                                >
                                    <Icon size={15} strokeWidth={2.2} />
                                    <span>{n.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="ml-auto flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold uppercase tracking-[0.16em]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                            Online
                        </span>
                        <Link
                            to="/install"
                            data-testid="header-install-cta"
                            className="text-sm px-3.5 py-2 rounded-md bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-2"
                        >
                            <Puzzle size={14} />
                            <span className="hidden sm:inline">Розширення</span>
                        </Link>
                    </div>
                </div>
            </header>
            <main className="max-w-[1400px] mx-auto px-6 py-8">
                <Outlet />
            </main>
            <footer className="border-t border-neutral-200 mt-12">
                <div className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-neutral-500 font-mono">
                    <div>
                        © 2026 <strong className="text-neutral-950">Guru</strong> · Робоча панель
                        аналітика
                    </div>
                    <div className="uppercase tracking-[0.22em]">v0.4.0 · schema 1.0</div>
                </div>
            </footer>
        </div>
    );
}
