// Guru popup logic
const $ = (s) => document.querySelector(s);

function detectSource(url) {
    if (!url) return null;
    if (url.includes("rozetka.com.ua")) return "rozetka";
    if (url.includes("epicentrk.ua")) return "epicentr";
    return null;
}

function setStatus(state, text) {
    const el = $("#status");
    el.dataset.state = state;
    $("#status-text").textContent = text;
}

function showError(message) {
    if (!message) {
        $("#error-box").hidden = true;
        return;
    }
    $("#error-box").hidden = false;
    $("#error-text").textContent = message;
}

async function init() {
    const cfgResp = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
    const cfg = cfgResp.config || {};
    $("#backend-url").value = cfg.backendUrl || "";
    $("#api-key").value = cfg.apiKey || "";
    $("#enabled").checked = cfg.enabled !== false;
    $("#captured-today").textContent = cfg.capturedToday || 0;
    $("#captured-total").textContent = cfg.capturedTotal || 0;
    const qSize = cfg.queue_size || 0;
    $("#queue-size").textContent = qSize;
    $("#flush-btn").hidden = qSize === 0;
    $("#dashboard-link").href = `${cfg.backendUrl}/`;

    // current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const source = detectSource(tab?.url);
    if (source) {
        $("#site-tag").textContent = source;
        $("#site-tag").dataset.source = source;
        $("#page-title").textContent = tab.title || "Сторінка маркетплейсу";
        $("#page-meta").textContent = new URL(tab.url).pathname;
        $("#capture-btn").disabled = false;
        $("#capture-btn").style.opacity = "";
        $("#capture-btn").style.cursor = "";
    } else {
        $("#site-tag").textContent = "—";
        $("#page-title").textContent =
            "Відкрийте Rozetka або Epicentr — Guru автоматично знайде картки.";
        $("#page-meta").textContent = "";
        $("#capture-btn").disabled = true;
        $("#capture-btn").style.opacity = "0.5";
        $("#capture-btn").style.cursor = "not-allowed";
    }

    // backend health
    const ping = await chrome.runtime.sendMessage({ type: "PING_BACKEND" });
    if (ping.ok) {
        setStatus("ok", "Online");
    } else {
        setStatus("err", "Offline");
        showError(ping.error || `HTTP ${ping.status || "?"}`);
    }

    // last error from background, if any
    if (cfg.lastError) {
        showError(`${cfg.lastError.message} · ${new Date(cfg.lastError.at).toLocaleTimeString("uk-UA")}`);
    } else if (ping.ok) {
        showError(null);
    }
}

$("#save-btn").addEventListener("click", async () => {
    const r = await chrome.runtime.sendMessage({
        type: "SAVE_CONFIG",
        backendUrl: $("#backend-url").value.trim().replace(/\/$/, ""),
        apiKey: $("#api-key").value.trim(),
        enabled: $("#enabled").checked,
    });
    setStatus(r.ok ? "ok" : "err", r.ok ? "Saved" : "Error");
    if (r.ok) {
        showError(null);
        // re-ping
        setTimeout(init, 200);
    }
});

$("#capture-btn").addEventListener("click", async () => {
    setStatus("idle", "Збираю…");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        setStatus("err", "No tab");
        return;
    }
    try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: "GURU_CAPTURE" });
        if (resp?.ok) {
            setStatus("ok", "Готово");
            showError(null);
            setTimeout(init, 800);
        } else {
            setStatus("err", "Error");
            showError(resp?.error || "Content script did not respond");
        }
    } catch (e) {
        setStatus("err", "Error");
        showError(
            "Content script не завантажився. Оновіть сторінку Rozetka/Epicentr та спробуйте ще раз.",
        );
    }
});

$("#test-btn").addEventListener("click", async () => {
    setStatus("idle", "Тест…");
    const r = await chrome.runtime.sendMessage({ type: "TEST_INGEST" });
    if (r?.ok) {
        setStatus("ok", "Backend OK");
        showError(`Тест успішний · додано в чергу ${r.added ?? 0}`);
        setTimeout(init, 600);
    } else {
        setStatus("err", "Backend FAIL");
        showError(r?.error || "Unknown error");
    }
});

$("#flush-btn").addEventListener("click", async () => {
    setStatus("idle", "Надсилаю…");
    const r = await chrome.runtime.sendMessage({ type: "FLUSH_QUEUE" });
    if (r?.ok) {
        setStatus("ok", "Готово");
        showError(`Залишилось у черзі: ${r.queue_size ?? 0}`);
        setTimeout(init, 400);
    } else {
        setStatus("err", "Помилка");
        showError(r?.error || "Не вдалось надіслати");
    }
});

document.addEventListener("DOMContentLoaded", init);
