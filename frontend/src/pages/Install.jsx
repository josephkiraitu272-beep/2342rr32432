import {
    Download,
    Puzzle,
    Settings,
    CheckCircle2,
    Lock,
    LineChart,
    BarChart3,
    Calculator,
    Wallet,
    Boxes,
    Receipt,
    BookOpen,
    Sparkles,
    Target,
    ExternalLink,
    Bell,
    SendHorizonal,
    FlaskConical,
} from "lucide-react";

const MODULES = [
    {
        id: "extension",
        title: "Браузерне розширення",
        desc: "Збір даних з Rozetka та Epicentr через сесію користувача.",
        icon: Puzzle,
        tier: "active",
    },
    {
        id: "dynamics",
        title: "Динаміка цін",
        desc: "Історія, падіння, рости. Real-time за обраним вікном.",
        icon: LineChart,
        tier: "active",
        link: "/dynamics",
    },
    {
        id: "products",
        title: "Товари",
        desc: "Каталог з фільтрами, історією ціни, експортом, deep-link.",
        icon: Boxes,
        tier: "active",
        link: "/products",
    },
    {
        id: "analytics",
        title: "Аналітика продавців",
        desc: "Частка, сер. знижка, діапазон, останні захоплення.",
        icon: BarChart3,
        tier: "active",
        link: "/sellers",
    },
    {
        id: "price-signals",
        title: "Цінові сигнали",
        desc: "Drop-detection ≥ 5% за 24 год. Доставки ще немає.",
        icon: Bell,
        tier: "labs",
        link: "/dynamics",
    },
    {
        id: "position-tracker",
        title: "Трекер позицій",
        desc: "Щоденний моніторинг видачі за ключовими словами. Внутрішнє тестування.",
        icon: Target,
        tier: "labs",
    },
    {
        id: "telegram-delivery",
        title: "Telegram-доставка",
        desc: "Push сигналів у канал/чат через Bot API.",
        icon: SendHorizonal,
        tier: "soon",
    },
    {
        id: "unit-economics",
        title: "Юніт-економіка",
        desc: "Маржа, вартість залучення, ROI по товарах.",
        icon: Calculator,
        tier: "soon",
    },
    {
        id: "profit-calc",
        title: "Калькулятор прибутку",
        desc: "Облік собівартості, комісії маркетплейсу, логістики.",
        icon: Wallet,
        tier: "soon",
    },
    {
        id: "orders",
        title: "Менеджер замовлень",
        desc: "Пайплайн від заявки до відправлення в одному вікні.",
        icon: Receipt,
        tier: "soon",
    },
    {
        id: "warehouse",
        title: "Склад",
        desc: "Залишки, прогноз розпродажу, автозаказ.",
        icon: BookOpen,
        tier: "soon",
    },
    {
        id: "accounting",
        title: "Бухгалтерія",
        desc: "Акти, ЧП, ПДВ та звірка з маркетплейсом.",
        icon: Wallet,
        tier: "soon",
    },
    {
        id: "ai-insider",
        title: "AI інсайдер",
        desc: "Сокі з видач та категорій, AI-копілот для асортименту.",
        icon: Sparkles,
        tier: "soon",
    },
];

const STEPS = [
    {
        n: "01",
        title: "Завантажте архів",
        desc: "Натисніть кнопку — отримаєте ZIP з розпакованим розширенням Guru.",
    },
    {
        n: "02",
        title: "chrome://extensions",
        desc: 'У Chrome відкрийте chrome://extensions → увімкніть «Режим розробника».',
    },
    {
        n: "03",
        title: "Розпаковане",
        desc: '«Завантажити розпаковане» → виберіть розпаковану папку. Готово.',
    },
];
const STEP_ACCENTS = ["bg-orange-500", "bg-blue-500", "bg-emerald-500"];

function TierPill({ tier }) {
    if (tier === "active")
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.18em] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                Активний
            </span>
        );
    if (tier === "labs")
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.18em] bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                <FlaskConical size={9} />
                Beta · Labs
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.18em] bg-neutral-100 border border-neutral-200 text-neutral-500 font-bold">
            <Lock size={9} />
            Roadmap
        </span>
    );
}

function ModuleCard({ m, downloadHref, onScrollToInstall }) {
    const Icon = m.icon;
    const isActive = m.tier === "active";
    const isLabs = m.tier === "labs";
    const cardCls = isActive
        ? "hover:shadow-md hover:-translate-y-0.5"
        : isLabs
          ? "ring-1 ring-amber-200/70 bg-amber-50/30"
          : "opacity-80 grayscale-[40%]";
    const iconCls = isActive
        ? "bg-orange-500 text-white"
        : isLabs
          ? "bg-amber-500 text-white"
          : "bg-neutral-100 text-neutral-400";
    return (
        <div
            data-testid={`module-card-${m.id}`}
            className={`relative guru-card p-5 transition-all ${cardCls}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div
                    className={`w-10 h-10 rounded-md flex items-center justify-center ${iconCls}`}
                >
                    <Icon size={18} />
                </div>
                <TierPill tier={m.tier} />
            </div>
            <h3 className="text-base font-bold text-neutral-950">{m.title}</h3>
            <p className="mt-1 text-sm text-neutral-600 leading-snug">{m.desc}</p>
            <div className="mt-4 flex items-center gap-2">
                {m.id === "extension" ? (
                    <>
                        <a
                            href={downloadHref}
                            data-testid="module-extension-download"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600"
                        >
                            <Download size={12} /> .zip
                        </a>
                        <button
                            onClick={onScrollToInstall}
                            data-testid="module-extension-instructions"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                        >
                            Інструкція
                        </button>
                    </>
                ) : (isActive || isLabs) && m.link ? (
                    <a
                        href={m.link}
                        data-testid={`module-${m.id}-open`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold ${
                            isActive
                                ? "bg-neutral-950 text-white hover:bg-neutral-800"
                                : "border border-amber-300 text-amber-800 hover:bg-amber-100"
                        }`}
                    >
                        Відкрити <ExternalLink size={11} />
                    </a>
                ) : isLabs ? (
                    <span className="text-xs text-amber-700 font-mono">внутрішнє тестування</span>
                ) : (
                    <span className="text-xs text-neutral-400 font-mono">в розробці</span>
                )}
            </div>
        </div>
    );
}

function Section({ id, eyebrow, title, count, accent, children }) {
    return (
        <section data-testid={`section-${id}`}>
            <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                    <div
                        className={`inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] mb-2 ${accent}`}
                    >
                        <span className={`w-6 h-px ${accent.replace("text-", "bg-")}`} />
                        {eyebrow}
                    </div>
                    <h2 className="text-2xl font-bold text-neutral-950">{title}</h2>
                </div>
                <div className="text-xs font-mono text-neutral-500">{count} модулів</div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
        </section>
    );
}

export default function Install() {
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    const apiKey = "prizma_dev_key_2026";
    const downloadHref = `${backendUrl}/prizma-extension.zip`;
    const onScrollToInstall = () => {
        document
            .getElementById("install-section")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const active = MODULES.filter((m) => m.tier === "active");
    const labs = MODULES.filter((m) => m.tier === "labs");
    const soon = MODULES.filter((m) => m.tier === "soon");

    return (
        <div className="space-y-12">
            <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-3">
                    <span className="w-6 h-px bg-orange-500" />
                    Marketplace Helper Suite
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.05]">
                    Продукти
                </h1>
                <p className="mt-3 text-neutral-600 max-w-2xl">
                    Модульна система Price Intelligence для продавців Rozetka та Epicentr.
                    {" "}
                    <strong className="text-emerald-700">{active.length} активних</strong> ·
                    {" "}
                    <strong className="text-amber-700">{labs.length} в Labs</strong> ·
                    {" "}
                    <strong className="text-neutral-700">{soon.length} у Roadmap</strong>.
                </p>
            </div>

            <Section
                id="active"
                eyebrow="Active · production"
                title="Активні модулі"
                count={active.length}
                accent="text-emerald-600"
            >
                {active.map((m) => (
                    <ModuleCard
                        key={m.id}
                        m={m}
                        downloadHref={downloadHref}
                        onScrollToInstall={onScrollToInstall}
                    />
                ))}
            </Section>

            <Section
                id="labs"
                eyebrow="Labs · beta"
                title="У лабораторії"
                count={labs.length}
                accent="text-amber-600"
            >
                {labs.map((m) => (
                    <ModuleCard
                        key={m.id}
                        m={m}
                        downloadHref={downloadHref}
                        onScrollToInstall={onScrollToInstall}
                    />
                ))}
            </Section>

            <Section
                id="roadmap"
                eyebrow="Roadmap · in queue"
                title="У дорожній карті"
                count={soon.length}
                accent="text-neutral-500"
            >
                {soon.map((m) => (
                    <ModuleCard
                        key={m.id}
                        m={m}
                        downloadHref={downloadHref}
                        onScrollToInstall={onScrollToInstall}
                    />
                ))}
            </Section>

            <section id="install-section" className="space-y-6">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-orange-600 mb-2">
                        <span className="w-6 h-px bg-orange-500" />
                        Розширення · встановлення
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950">
                        Як встановити Guru в Chrome
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {STEPS.map((s, i) => (
                        <div
                            key={s.n}
                            className="guru-card p-7"
                            data-testid={`install-step-${s.n}`}
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <div
                                    className={`w-10 h-10 rounded-md ${STEP_ACCENTS[i]} text-white flex items-center justify-center font-mono font-bold`}
                                >
                                    {s.n}
                                </div>
                                <div className="h-px flex-1 bg-neutral-200" />
                            </div>
                            <h3 className="text-xl font-bold text-neutral-950 mb-3">{s.title}</h3>
                            <p className="text-neutral-600 leading-relaxed">{s.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="grid md:grid-cols-12 gap-6">
                    <div className="md:col-span-7 guru-card-dark p-7 relative overflow-hidden">
                        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-orange-500/20 blur-3xl" />
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-md bg-orange-500 text-white flex items-center justify-center">
                                    <Puzzle size={18} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">Завантажити Guru</h2>
                                    <div className="text-sm text-neutral-400">
                                        Chrome / Edge / Brave — Manifest V3 · v0.4.0
                                    </div>
                                </div>
                            </div>
                            <p className="text-neutral-300 leading-relaxed mb-5">
                                Архів містить папку з розширенням. Розпакуйте її та завантажте в Chrome
                                як «розпаковане».
                            </p>
                            <a
                                href={downloadHref}
                                data-testid="download-extension-btn"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                            >
                                <Download size={16} /> Завантажити .zip
                            </a>
                        </div>
                    </div>

                    <div className="md:col-span-5 guru-card p-7">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-md bg-neutral-950 text-white flex items-center justify-center">
                                <Settings size={18} />
                            </div>
                            <h2 className="text-xl font-bold text-neutral-950">Налаштування</h2>
                        </div>
                        <p className="text-neutral-600 leading-relaxed mb-4 text-sm">
                            У popup розширення введіть ці значення (вже встановлені за замовчуванням):
                        </p>
                        <div className="space-y-3 text-sm">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-1">
                                    Backend URL
                                </div>
                                <code className="block bg-neutral-50 border border-neutral-200 px-3 py-2 rounded font-mono text-xs break-all">
                                    {backendUrl}
                                </code>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-1">
                                    API key
                                </div>
                                <code className="block bg-neutral-50 border border-neutral-200 px-3 py-2 rounded font-mono text-xs">
                                    {apiKey}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="guru-card p-7">
                    <h2 className="text-2xl font-bold text-neutral-950 mb-5">Що робить розширення</h2>
                    <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-neutral-700">
                        {[
                            "Знаходить картки товарів на Rozetka та Epicentr",
                            "Зчитує назву, ціну, стару ціну, наявність, продавця, рейтинг, відгуки",
                            "Підсвічує бейджі #1, F (Фулфілмент), РЕКЛАМА",
                            "Schema v1.0: нормалізація даних на клієнті",
                            "Персистентна черга з retry — дані не втрачаються на поганій мережі",
                            "Передає cf_clearance / User-Agent у бекенд",
                        ].map((line) => (
                            <li key={line} className="flex gap-2.5 items-start">
                                <CheckCircle2
                                    size={16}
                                    className="text-orange-500 mt-0.5 shrink-0"
                                    strokeWidth={2.5}
                                />
                                <span>{line}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </div>
    );
}
