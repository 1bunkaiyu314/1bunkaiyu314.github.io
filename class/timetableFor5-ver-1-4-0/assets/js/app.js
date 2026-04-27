import { fetchText, fetchJson } from "./modules/net.js";
import { escapeHtml } from "./modules/utils.js";
import { createModalManager } from "./modules/modal.js";
import { installSettingsMenuHandlers } from "./modules/settingsMenu.js";
import { storage } from "./modules/storage.js";

if (window.__timetable_app_loaded) {
    // Prevent double-initialization when legacy loaders also inject app.js
    warn("timetable app.js already loaded");
} else {
    window.__timetable_app_loaded = true;

document.addEventListener("DOMContentLoaded", async () => {
    const timetableMain = document.getElementById("timetable-main");
    const timetableSplit = document.getElementById("timetable-split");
    const dateCells = timetableMain ? timetableMain.querySelectorAll(".date-cell") : document.querySelectorAll(".date-cell");
    const subjectCells = timetableMain ? timetableMain.querySelectorAll("tbody td.subject") : document.querySelectorAll(".timetable tbody td.subject");
    const splitDateCells = timetableSplit ? timetableSplit.querySelectorAll(".date-cell") : [];
    const splitSubjectCells = timetableSplit ? timetableSplit.querySelectorAll("tbody td.subject") : [];
    const memoCell = document.getElementById("memo-cell");
    const monthSelect = document.getElementById("month-select");
    const daySelect = document.getElementById("day-select");
    const toolbarNowEl = document.getElementById("toolbar-now");
    const today = new Date();

    const { openModal: openModalRaw } = createModalManager({ document });
    
    let db;
    let currentColumnIndex = 0;
    let baseDate = new Date();
    let events = {};
    let holidays = {};
    let timetableData = {};
    let subjectMap = {};
    let currentDate = null;
    let movingData = [];
    let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isClassroomCode = false;

    const TERMS_MODAL_TITLE = "利用規約";
    const TERMS_VIEW_TITLE = "利用規約（再掲）";
    const SUBJECT_SETUP_TITLE = "選択科目の設定";
    const APP_VERSION = "2.0.0";

    const DEBUG =
        (() => {
            try {
                const params = new URLSearchParams(window.location.search);
                const byQuery = params.has("debug");
                const byStorage = storage.get("debug") === true || storage.get("debug") === "true";
                return Boolean(byQuery || byStorage);
            } catch {
                return false;
            }
        })();

    const log = (...args) => {
        if (DEBUG) console.log(...args);
    };
    const warn = (...args) => {
        if (DEBUG) console.warn(...args);
    };
    const logError = (...args) => console.error(...args);

    window.__timetable_debug = DEBUG;
    log("[timetable] init start", { APP_VERSION, isDark });

    function formatNowText(date) {
        const datePart = new Intl.DateTimeFormat("ja-JP", {
            month: "numeric",
            day: "numeric",
            weekday: "short",
        }).format(date);

        const timePart = new Intl.DateTimeFormat("ja-JP", DEBUG ? {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
        } : {
            hour: "numeric",
            minute: "2-digit",
        }).format(date);

        return `${datePart} ${timePart}`;
    }

    function startNowTicker() {
        if (!toolbarNowEl) return;

        const update = () => {
            const now = new Date();
            toolbarNowEl.textContent = formatNowText(now);
        };

        update();
        const intervalMs = DEBUG ? 1000 : 10_000;
        setInterval(update, intervalMs);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) update();
        });
    }

    startNowTicker();
    
    const SETTING_THEME = "theme";
    const SETTING_SUBJECT_CHOICES = "subjectChoices";
    const SETTING_AGREED_TERMS = "agreedTerms";
    const SETTING_CLASS_NUMBER = "classNumber";
    const SETTING_LAST_SEEN_VERSION = "lastSeenVersion";
    const SETTING_EXTRA_EVENTS = "extraEventsCache";
    const SETTING_TIMETABLE_CHANGES = "timetableChanges";

    let currentTheme = isDark ? "dark" : "light";
    let agreedTerms = false;
    let subjectChoices = null;
    let pendingAfterTerms = null;
    let classNumber = null;
    let subjectFilter = "";
    let hasShownWhatsNew = false;
    let extraEvents = getSetting(SETTING_EXTRA_EVENTS) || {};
    let timetableChanges = getSetting(SETTING_TIMETABLE_CHANGES) || {};

    log("[timetable] cache loaded", {
        extraEventsKeys: Object.keys(extraEvents || {}).length,
        timetableChangesKeys: Object.keys(timetableChanges || {}).length,
    });

    const SPLIT_MIN_VIEWPORT_HEIGHT = 830;
    const SPLIT_OFFSET = 4;

    function updateSplitLayout() {
        // Enough vertical space -> show 2-row timetable (first 4 days + next 4 days)
        const useSplit = window.innerHeight >= SPLIT_MIN_VIEWPORT_HEIGHT;
        document.body.classList.toggle("use-split", useSplit);
    }

    function getSelectedDateText() {
        const main =
            currentColumnIndex >= 0 && currentColumnIndex < dateCells.length
                ? dateCells[currentColumnIndex]?.textContent.trim()
                : "";
        if (main) return main;

        const localIndex = currentColumnIndex - SPLIT_OFFSET;
        if (localIndex >= 0 && localIndex < splitDateCells.length) {
            return splitDateCells[localIndex]?.textContent.trim() || "";
        }
        return "";
    }

    function getTimetableFileForClass(classNo) {
        return `./assets/json/timetable/timetable_class-${classNo}.json`;
    }

    const modalContent = {
        history: {
            title: "更新履歴",
            file: "./assets/html/history.html",
            type: "html"
        },
        help: {
            title: "ヘルプ",
            file: "./assets/html/help.html",
            type: "html"
        },
        setting: {
            title: "その他",
            file: "./assets/setting.html",
            type: "html"
        },
        source: {
            title: "ソース",
            file: "./assets/html/source.html",
            type: "html"
        },
        detail: {
            title: "詳細設定",
            file: "./assets/html/detail.html",
            type: "html"
        },
        issues: {
            title: "既知の問題",
            file: "./assets/html/issues.html",
            type: "html"
        }
    };

    const expansionMap = [
        ["A1","A2","E1","E2","G1","G2","J1","J2"],
        ["A1","A2","E1","E2","G1","G2","J1","J2"],
        ["A1","A2","E1","E2","G1","G2","K1","K2"],
        ["A1","A2","E1","E2","G1","G2","K1","K2"],
        ["A1","A2","E1","E2","H1","H2","K1","K2"],
        ["A1","A2","E1","E2","H1","H2","K1","K2"],
        ["C1","C2","F1","F2","H1","H2","K1","K2"]
    ];

    const class2homeRoom = {
        1: "B11",
        2: "B12",
        3: "B13",
        4: "B14",
        5: "C11",
        6: "C12",
        7: "C13",
        8: "C14",
        9: "C15",
    };

    const homeroom2class = Object.fromEntries(Object.entries(class2homeRoom).map(([k, v]) => [v, k + "組教室"]));

    fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vR1dN6poNIpBsmis-JO2N2Hjiu96bkMuqs2fDtf1V3FH6iBs3BuQZVskaDq8n-xhoKEMdGYD-P5LscW/pub?gid=0&single=true&output=csv")
        .then(res => res.text())
        .then(text => {
            Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim(),
            complete: (result) => {

                const extraEventsNew = result.data.reduce((acc, item) => {
                const datesinCSV = item.dates;

                if (!acc[datesinCSV]) {
                    acc[datesinCSV] = [];
                }

                acc[datesinCSV].push({
                    content: item.contents,
                    dark_color: item.dark_color,
                    light_color: item.light_color
                });

                return acc;
                }, {});

                extraEvents = extraEventsNew;
                setSetting(SETTING_EXTRA_EVENTS, extraEventsNew);
                log("[timetable] extraEvents updated", { keys: Object.keys(extraEventsNew || {}).length });

                const selected = getSelectedDateText();
                if (selected) {
                    updateEvent(selected);
                }
            }
            });
        })
        .catch((e) => warn("[timetable] extraEvents fetch failed", e));

    fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQiStJCsPKp1ndi958BLOajBqizE_aIcO2Z0f9hPgiyPV19rnWB3qVcrLuVEaeCeE5ddaIudtX7VkzE/pub?gid=1149682638&single=true&output=csv")
        .then(res => res.text())
        .then(text => {
            Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim(),
            complete: (result) => {

                const timetableChangesNew = result.data.reduce((acc, item) => {
                const datesinCSV = item.dates;
 
                if (!acc[datesinCSV]) {
                    acc[datesinCSV] = [];
                }

                acc[datesinCSV].push({
                    class: Number(item.classes),
                    period: Number(item.periods),
                    subject: item.subjects
                });
 
                return acc;
                }, {});

                timetableChanges = timetableChangesNew;
                setSetting(SETTING_TIMETABLE_CHANGES, timetableChangesNew);
                log("[timetable] timetableChanges updated", { keys: Object.keys(timetableChangesNew || {}).length });

                // If timetable has already been loaded, re-render so cached view upgrades to fresh data.
                if (typeof classNumber === "number") {
                    loadAndApplyTimetable()
                        .then(() => updateAllSubjects())
                        .catch((e) => warn("[timetable] re-render after timetableChanges failed", e));
                }
            }
            });
        })
        .catch((e) => warn("[timetable] timetableChanges fetch failed", e));

    function applyTheme(theme) {
        // Preserve other body classes like "use-split" / "blocked"
        document.documentElement.classList.toggle("theme-light", theme === "light");
        document.documentElement.classList.toggle("theme-dark", theme !== "light");
        document.body.classList.toggle("theme-light", theme === "light");
        document.body.classList.toggle("theme-dark", theme !== "light");
        document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
        currentTheme = theme;

        const btn = document.getElementById("theme-btn");
        isDark = theme !== "light";

        const selectedDate = getSelectedDateText();
        if (selectedDate) {
            updateEvent(selectedDate);
            updateMemo(selectedDate);
        }

        if (btn) {
            if (theme === "dark") {
                btn.innerHTML = '<img src="./assets/images/moon-dark.svg" alt="🌙" style="width: 24px; height: 24px;">';
            } else {
                btn.innerHTML = '<img src="./assets/images/sun-light.svg" alt="☀" style="width: 24px; height: 24px;">';
            }
        }
    }

    function getSubjectChoices() {
        return subjectChoices && typeof subjectChoices === "object" ? subjectChoices : {};
    }

    function findRoomFor(originCode) {
        if (!originCode) return "";

        const chosen = subjectChoices?.[originCode] || "";

        // 1. origin + electives が一致する行
        let item = movingData.find(d =>
            d.origin === originCode &&
            d.electives === chosen
        );

        // 2. electives が空欄の行（未選択時の fallback）
        if (!item && chosen === "") {
            item = movingData.find(d =>
                d.origin === originCode &&
                (!d.electives || d.electives.trim() === "")
            );
        }
        
        const hasSubject = Object.prototype.hasOwnProperty.call(subjectMap, originCode);
        let otherCaseRoom = "?";

        if (!hasSubject) {
            otherCaseRoom = isClassroomCode === true
                ? (class2homeRoom[classNumber] || "不明")
                : (homeroom2class[class2homeRoom[classNumber]] || "不明");
        }

        return isClassroomCode === true
            ? item?.rooms || otherCaseRoom
            : item?.name || otherCaseRoom
    }

    function applyMovingTimetable() {
        const mainRows = timetableMain ? timetableMain.querySelectorAll("tbody tr") : document.querySelectorAll("#timetable-main tbody tr");
        log("Applying moving timetable with choices:", getSubjectChoices(), "and class number:", classNumber);

        mainRows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll("td");

            cells.forEach((cell, colIndex) => {
                const dateText = dateCells[colIndex].textContent.trim();
                const schedule = getScheduleFor(dateText);

                const originCode = schedule[rowIndex]; // A1, K1, 数ⅡS/La など
                const room = findRoomFor(originCode, classNumber);

                cell.textContent = room || "";
            });
        });

        if (timetableSplit && splitDateCells.length > 0) {
            const splitRows = timetableSplit.querySelectorAll("tbody tr");
            splitRows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll("td");
                cells.forEach((cell, localColIndex) => {
                    const dateText = splitDateCells[localColIndex].textContent.trim();
                    const schedule = getScheduleFor(dateText);
                    const originCode = schedule[rowIndex];
                    const room = findRoomFor(originCode, classNumber);
                    cell.textContent = room || "";
                });
            });
        }
    }

    // fetchText / fetchJson are imported from ./modules/net.js

    async function loadMovingData() {
        try {
            movingData = await fetchJson("./assets/json/subjects_rooms_map.json"); // ←あなたの JSON ファイル名
        } catch (e) {
            logError("移動教室データの読み込みに失敗", e);
            movingData = [];
        }
    }

    function findUsedSubjectCodes() {
        const codes = new Set();
        Object.keys(timetableData).forEach(key => {
            const row = timetableData[key];
            if (!Array.isArray(row)) return;

            row.forEach(cell => {
                if (typeof cell === "string") {
                    if (subjectMap[cell]) {
                        codes.add(cell);
                    }
                }
            });
        });
        return Array.from(codes).sort();
    }

    function resolveSubjectCellText(text) {
        if (typeof text !== "string") {
            return text;
        }

        const choices = getSubjectChoices();
        const chosen = choices[text];

        if (typeof chosen === "string" && chosen.trim().length > 0) {
            return chosen === "__CODE__" ? text : chosen;
        }

        return text;
    }

    function listSubjectTokens() {
        const tokens = new Set();
        Object.keys(timetableData || {}).forEach(dayKey => {
            const row = timetableData[dayKey];
            if (!Array.isArray(row)) return;
            row.forEach(cell => {
                const txt = resolveSubjectCellText(cell);
                if (typeof txt !== "string") return;
                const token = txt;
                if (token) tokens.add(token);
            });
        });
        return Array.from(tokens).sort((a, b) => a.localeCompare(b, "ja"));
    }

    function clearFilterClasses() {
        const allCells = [
            ...(timetableMain ? Array.from(timetableMain.querySelectorAll("tbody td.subject")) : []),
            ...(timetableSplit ? Array.from(timetableSplit.querySelectorAll("tbody td.subject")) : []),
        ];
        allCells.forEach(td => td.classList.remove("filter-hit", "filter-dim"));
    }

    function applySubjectFilter() {
        clearFilterClasses();
        const token = String(subjectFilter || "").trim();
        if (!token) return;

        const useSplit = document.body.classList.contains("use-split") && splitDateCells.length > 0;
        const allCells = [
            ...(timetableMain ? Array.from(timetableMain.querySelectorAll("tbody td.subject")) : []),
            ...(useSplit && timetableSplit ? Array.from(timetableSplit.querySelectorAll("tbody td.subject")) : []),
        ];

        allCells.forEach(td => {
            const txt = String(td.textContent || "").trim();
            if (!txt) return;
            if (txt === token) {
                td.classList.add("filter-hit");
            } else {
                td.classList.add("filter-dim");
            }
        });
    }

    function openFilterModal() {
        const tokens = listSubjectTokens();
        const options = [
            `<option value="">なし</option>`,
            ...tokens.map(t => `<option value="${escapeHtml(t)}"${t === subjectFilter ? " selected" : ""}>${escapeHtml(t)}</option>`)
        ].join("");

        const content = `
<style>
  .filter-setup { text-align: left; }
  .filter-row { display: grid; grid-template-columns: 70px 1fr; gap: 10px; align-items: center; margin: 10px 0; }
  .filter-row label { font-weight: 700; }
  .filter-setup select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-2-color); color: var(--text-strong-color); }
  .filter-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
  .filter-actions button { padding: 8px 12px; background: var(--button-color); color: var(--text-strong-color); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; }
</style>
<div class="filter-setup">
  <div class="filter-row">
    <label for="filter-select">教科</label>
    <select id="filter-select">${options}</select>
  </div>
  <div class="filter-actions">
    <button type="button" id="filter-clear">解除</button>
    <button type="button" id="filter-save">適用</button>
  </div>
</div>`;

        const modal = openModal("フィルタ", content);
        if (!modal) return;
        const sel = modal.querySelector("#filter-select");
        modal.querySelector("#filter-clear")?.addEventListener("click", async () => {
            subjectFilter = "";
            applySubjectFilter();
            modal.querySelector(".close-modal")?.click();
        });
        modal.querySelector("#filter-save")?.addEventListener("click", async () => {
            subjectFilter = String(sel?.value || "");
            gtag('event', 'filter_subject', {
                subject: subjectFilter
            });
            applySubjectFilter();
            modal.querySelector(".close-modal")?.click();
        });
    }

    function openClassSetupModal({ blocking, onSave } = { blocking: false, onSave: null }) {
        const current = typeof classNumber === "number" ? String(classNumber) : "";

        const options = [
            `<option value="" disabled${current ? "" : " selected"}>未選択</option>`,
            ...Array.from({ length: 9 }, (_, i) => {
                const v = String(i + 1);
                return `<option value="${v}"${current === v ? " selected" : ""}>${v}組</option>`;
            })
        ].join("");

        const content = `
<style>
  .class-setup { text-align: left; }
  .class-row { display: grid; grid-template-columns: 70px 1fr; gap: 10px; align-items: center; margin: 10px 0; }
  .class-row label { font-weight: 700; }
  .class-setup select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-2-color); color: var(--text-strong-color); }
  .class-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
  .class-actions button { padding: 8px 12px; background: var(--surface-2-color); color: var(--text-strong-color); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; }
  .class-error { color: #ffb3b3; margin: 8px 0 0; }
  body.theme-light .class-error { color: #b00020; }
</style>
<div class="class-setup">
  <div class="class-row">
    <label for="class-select">クラス</label>
    <select id="class-select">${options}</select>
  </div>
  <p id="class-error" class="class-error" style="display:none"></p>
  <div class="class-actions">
    <button type="button" id="class-save">保存</button>
  </div>
</div>`;

        const modalElement = openModal("クラスの設定", content);
        if (!modalElement) {
            return;
        }

        const closeBtn = modalElement.querySelector(".close-modal");
        if (blocking && closeBtn) {
            closeBtn.style.display = "none";
            document.body.classList.add("blocked");
        }

        const select = modalElement.querySelector("#class-select");
        const saveBtn = modalElement.querySelector("#class-save");
        const cancelBtn = modalElement.querySelector("#class-cancel");
        const errorEl = modalElement.querySelector("#class-error");

        function close() {
            modalElement.classList.remove("show");
            setTimeout(() => modalElement.remove(), 250);
            document.body.classList.remove("blocked");
        }

        function setError(message) {
            if (!errorEl) {
                return;
            }
            if (!message) {
                errorEl.style.display = "none";
                errorEl.textContent = "";
                return;
            }
            errorEl.style.display = "block";
            errorEl.textContent = message;
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", close);
        }

        if (select) {
            select.addEventListener("change", () => setError(""));
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                const value = select ? String(select.value || "").trim() : "";
                if (!value) {
                    setError("クラスを選択してください。");
                    return;
                }

                const nextClass = Number(value);
                if (!Number.isFinite(nextClass) || nextClass < 1 || nextClass > 9) {
                    setError("クラスの値が不正です。");
                    return;
                }

                classNumber = nextClass;
                setSetting(SETTING_CLASS_NUMBER, nextClass);
                gtag('event', 'class', `${classNumber}組`);
                await loadAndApplyTimetable();

                if (typeof onSave === "function") {
                    onSave();
                }
                close();
            });
        }
    }

    function openSubjectSetupModal({ blocking, onSave } = { blocking: false, onSave: null }) {
        const usedCodes = findUsedSubjectCodes();
        const existing = getSubjectChoices();

        const rowsHtml = usedCodes
            .map(code => {
                const options = Array.isArray(subjectMap[code]) ? subjectMap[code] : [];
                const current = typeof existing[code] === "string" ? existing[code] : "";

                const optionHtml = [
                    `<option value="" disabled${current ? "" : " selected"}>未選択</option>`,
                    
                    ...options.map(name => {
                        const val = String(name);
                        const selected = current === val ? " selected" : "";
                        return `<option value="${escapeHtml(val)}"${selected}>${escapeHtml(val)}</option>`;
                    })
                ].join("");
                return `
<label class="subject-row">
  <span class="subject-code">${escapeHtml(code)}</span>
  <select data-subject-code="${escapeHtml(code)}">${optionHtml}</select>
</label>`;
            })
            .join("");
        const content = `
<style>
  .subject-setup { text-align: left; }
  .subject-row { display: grid; grid-template-columns: 64px 1fr; gap: 10px; align-items: center; margin: 10px 0; }
  .subject-code { font-weight: 700; }
  .subject-setup select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-2-color); color: var(--text-strong-color); }
  .subject-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
  .subject-actions button { padding: 8px 12px; background: var(--surface-2-color); color: var(--text-strong-color); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; }
  .subject-note { margin: 0 0 10px; opacity: 0.9; }
  code { background: rgba(255,255,255,0.06); padding: 0 4px; border-radius: 4px; }
  .subject-error { color: #ffb3b3; margin: 8px 0 0; }
  body.theme-light .subject-error { color: #b00020; }
  @media (max-width: 600px) { .subject-row { grid-template-columns: 56px 1fr; } }
</style>
<div class="subject-setup">
  <p id="subject-error" class="subject-error" style="display:none"></p>
  ${rowsHtml || "<p>時間割に選択科目コードが見つかりませんでした。</p>"}
  <div class="subject-actions">
    <button type="button" id="subject-save">保存</button>
  </div>
</div>`;

        const modalElement = openModal(SUBJECT_SETUP_TITLE, content);
        if (!modalElement) {
            return;
        }

        const closeBtn = modalElement.querySelector(".close-modal");
        if (blocking && closeBtn) {
            closeBtn.style.display = "none";
            document.body.classList.add("blocked");
        }

        const saveBtn = modalElement.querySelector("#subject-save");
        const cancelBtn = modalElement.querySelector("#subject-cancel");
        const errorEl = modalElement.querySelector("#subject-error");

        function close() {
            modalElement.classList.remove("show");
            setTimeout(() => modalElement.remove(), 250);
            document.body.classList.remove("blocked");
        }

        function setError(message) {
            if (!errorEl) {
                return;
            }
            if (!message) {
                errorEl.style.display = "none";
                errorEl.textContent = "";
                return;
            }
            errorEl.style.display = "block";
            errorEl.textContent = message;
        }

        function syncSaveState() {
            if (!saveBtn) {
                return;
            }
            // Allow partial save (unselected -> show code as-is)
            saveBtn.disabled = false;
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", close);
        }

        modalElement.addEventListener("change", () => {
            setError("");
            syncSaveState();
        });
        modalElement.querySelectorAll('select[data-subject-code]').forEach(sel => {
            sel.addEventListener("change", syncSaveState);
        });
        syncSaveState();

        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                const nextChoices = {};
                modalElement.querySelectorAll("select[data-subject-code]").forEach(el => {
                    const code = el.getAttribute("data-subject-code");
                    if (!code) {
                        return;
                    }
                    const value = String(el.value || "").trim();
                    if (value.length === 0) {
                        return;
                    }
                    nextChoices[code] = value;
                });

                subjectChoices = nextChoices;
                setSetting(SETTING_SUBJECT_CHOICES, nextChoices);
                updateAllSubjects();
                if (typeof onSave === "function") {
                    onSave();
                }
                close();
            });
        }
    }

    async function openModalById(id) {
        const meta = modalContent[id];
        if (!meta) {
            return;
        }

        const { title, file, type } = meta;
        let content = "";

        try {
            if (type === "json") {
                const json = await fetchJson(file);
                content = json.map(item => `<h3>ver. ${item.version}</h3><p>${item.detail}</p>`).join("");
            }

            if (type === "html") {
                content = await fetchText(file);
            }
        } catch (error) {
            logError("[timetable] loadAndApplyTimetable() failed", { file, classNumber, error });
            content = `<p style="text-align:left">読み込みに失敗しました。</p><p style="text-align:left"><code>${String(file)}</code></p><p style="text-align:left">${String(error)}</p>`;
        }

        openModal(title, content);
    }

    async function openTermsView() {
        try {
            const html = await fetchText("./assets/html/terms.html");
            openModal(TERMS_VIEW_TITLE, html);
        } catch (error) {
            openModal(
                TERMS_VIEW_TITLE,
                `<p style="text-align:left">読み込みに失敗しました。</p><p style="text-align:left"><code>./assets/html/terms.html</code></p><p style="text-align:left">${String(error)}</p>`
            );
        }
    }

    function extractLatestHistoryBlock(historyHtml) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(historyHtml, "text/html");
            const style = doc.querySelector("style");
            const firstH3 = doc.querySelector("h3");
            if (!firstH3) {
                return historyHtml;
            }

            const parts = [];
            if (style) {
                parts.push(style.outerHTML);
            }

            for (let n = firstH3; n; n = n.nextSibling) {
                if (n.nodeType === 1 && n.tagName === "H3" && n !== firstH3) {
                    break;
                }
                if (n.nodeType === 1) {
                    parts.push(n.outerHTML);
                }
            }

            return parts.join("\n");
        } catch {
            return historyHtml;
        }
    }

    async function showWhatsNewIfUpdated() {
        if (hasShownWhatsNew) return;

        const lastSeen = getSetting(SETTING_LAST_SEEN_VERSION);

        if (lastSeen && String(lastSeen) === APP_VERSION) {
            return;
        }

        let historyHtml = "";
        try {
            historyHtml = await fetchText("./assets/html/history.html");
        } catch (error) {
            return;
        }

        const latest = extractLatestHistoryBlock(historyHtml);
        const content = `${latest}`;

        const modal = openModal("更新情報", content);

        if (!modal) {
            return;
        }

        // ←ここで初めてセット
        hasShownWhatsNew = true;

        const closeBtn = modal.querySelector(".close-modal");
        let saved = false;

        const saveOnce = () => {
            if (saved) return;
            saved = true;
            setSetting(SETTING_LAST_SEEN_VERSION, APP_VERSION);
        };

        closeBtn?.addEventListener("click", saveOnce, { once: true });
    }

    function clearSelection() {
        document.querySelectorAll(".date-selected").forEach(cell => cell.classList.remove("date-selected"));
        document.querySelectorAll(".subject-selected").forEach(cell => cell.classList.remove("subject-selected"));
    }

    function selectColumn(index) {
        clearSelection();
        currentColumnIndex = index;

        // When split layout is active, columns 0-3 are in main table and 4-7 are in split table
        const useSplit = document.body.classList.contains("use-split") && splitDateCells.length > 0;
        if (useSplit) {
            if (index >= 0 && index < SPLIT_OFFSET) {
                if (dateCells[index]) {
                    dateCells[index].classList.add("date-selected");
                }
                timetableMain
                    ?.querySelectorAll(`tbody tr td:nth-child(${index + 2})`)
                    ?.forEach(cell => cell.classList.add("subject-selected"));
                return;
            }

            const localIndex = index - SPLIT_OFFSET;
            if (localIndex >= 0 && localIndex < splitDateCells.length) {
                splitDateCells[localIndex]?.classList.add("date-selected");
                timetableSplit
                    ?.querySelectorAll(`tbody tr td:nth-child(${localIndex + 2})`)
                    ?.forEach(cell => cell.classList.add("subject-selected"));
            }
            return;
        }

        // Main table highlight
        if (index >= 0 && index < dateCells.length && dateCells[index]) {
            dateCells[index].classList.add("date-selected");
            timetableMain
                ?.querySelectorAll(`tbody tr td:nth-child(${index + 2})`)
                ?.forEach(cell => cell.classList.add("subject-selected"));
            return;
        }

        // Split table highlight (shows days 5-8 as local 0-3)
        const localIndex = index - SPLIT_OFFSET;
        if (localIndex >= 0 && localIndex < splitDateCells.length && splitDateCells[localIndex]) {
            splitDateCells[localIndex].classList.add("date-selected");
            timetableSplit
                ?.querySelectorAll(`tbody tr td:nth-child(${localIndex + 2})`)
                ?.forEach(cell => cell.classList.add("subject-selected"));
        }
    }

    function formatCellDate(date) {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function formatDateText(dateText) {
        const parts = dateText.split("/");
        if (parts.length !== 2) return dateText;

        const month = Number(parts[0]);
        const day = Number(parts[1]);

        if (Number.isNaN(month) || Number.isNaN(day)) return dateText;

        return `${month}月${day}日`;
    }

    function formatTimetableKey(date) {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    function parseCellDate(dateText) {
        const [month, day] = dateText.split("/").map(Number);
        return new Date(today.getFullYear(), month - 1, day);
    }

    function getEventFor(dateText) {
        const date = parseCellDate(dateText);
        const eventKey = formatTimetableKey(date);

        let base = events[eventKey] || events[dateText] || "";
        

        const extra =
            extraEvents[eventKey]?.length
                ? 
                extraEvents[eventKey]
                    .map(e => {
                        const color = isDark ? e.dark_color : e.light_color;

                        return `<span style="color:${color || "inherit"}">${e.content}</span>`;
                    })
                    .join("<br>")
                : "";
        return [base, extra].filter(Boolean).join("<br>");
    }

    function getScheduleFor(dateText) {
        const date = parseCellDate(dateText);
        const timetableKey = formatTimetableKey(date);
        return timetableData[timetableKey] || timetableData[dateText] || [];
    }

    function generateDates() {
        const today0clock = new Date(today);
        today0clock.setHours(0, 0, 0, 0);

        function applyHeaderClasses(cell, date) {
            if (!cell) return;

            cell.classList.remove("today", "not-today", "saturday", "holiday");

            const cellDate = new Date(date);
            cellDate.setHours(0, 0, 0, 0);

            if (cellDate.getTime() === today0clock.getTime()) {
                cell.classList.add("today");
            } else {
                cell.classList.add("not-today");
            }

            const dow = cellDate.getDay(); // 0 Sun .. 6 Sat
            if (dow === 6) {
                cell.classList.add("saturday");
            }

            const eventKey = formatTimetableKey(cellDate);
            if (dow === 0 || Boolean(holidays?.[eventKey])) {
                cell.classList.add("holiday");
            }
        }

        for (let i = 0; i < dateCells.length; i++) {
            const date = new Date(baseDate);
            date.setDate(baseDate.getDate() + i);

            dateCells[i].textContent = formatCellDate(date);
            applyHeaderClasses(dateCells[i], date);
        }

        // Fill split table header with days 5-8 (baseDate+4..+7)
        if (splitDateCells.length > 0) {
            for (let i = 0; i < splitDateCells.length; i++) {
                const date = new Date(baseDate);
                date.setDate(baseDate.getDate() + 4 + i);
                splitDateCells[i].textContent = formatCellDate(date);
                applyHeaderClasses(splitDateCells[i], date);
            }
        }
    }
    
    function initDB() {
        return new Promise((resolve, reject) => {
            log("[timetable] initDB() open", { name: "TimetableDB", version: 2 });
            const request = indexedDB.open("TimetableDB", 2);

            request.onupgradeneeded = event => {
                db = event.target.result;
                if (!db.objectStoreNames.contains("memos")) {
                    db.createObjectStore("memos", { keyPath: "date" });
                }
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings", { keyPath: "key" });
                }
            };

            request.onsuccess = event => {
                db = event.target.result;
                log("[timetable] initDB() success");
                resolve();
                
            };

            request.onerror = () => {
                logError("[timetable] initDB() error", request.error);
                reject("IndexedDB の初期化に失敗しました");
            };
        });
    }

    let dbReadyPromise = null;
    function ensureDbReady() {
        if (db) return Promise.resolve();
        if (dbReadyPromise) return dbReadyPromise;

        dbReadyPromise = initDB().catch((e) => {
            dbReadyPromise = null;
            throw e;
        });
        return dbReadyPromise;
    }
     
    function saveMemo(date, text) {
        ensureDbReady().then(() => {
            if (text) {
                const tx = db.transaction("memos", "readwrite");
                const store = tx.objectStore("memos");
                store.put({ date, text });
            } else {
                const tx = db.transaction("memos", "readwrite");
                const store = tx.objectStore("memos");
                store.delete(currentDate);
            }
        }).catch((e) => warn("[timetable] saveMemo() skipped (db not ready)", e));
    }

    function loadMemo(date, callback) {
        ensureDbReady().then(() => {
            const tx = db.transaction("memos", "readonly");
            const store = tx.objectStore("memos");
            const req = store.get(date);

            req.onsuccess = () => {
                callback(req.result ? req.result.text : "");
            };
            req.onerror = () => {
                warn("[timetable] loadMemo() error", req.error);
                callback("");
            };
        }).catch((e) => {
            warn("[timetable] loadMemo() skipped (db not ready)", e);
            callback("");
        });
    }

    function getSetting(key) {
        return storage.get(key);
    }

    function getSettingfromDB(key) {
        return ensureDbReady().then(() => new Promise((resolve, reject) => {
            const tx = db.transaction("settings", "readonly");
            const store = tx.objectStore("settings");
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
            req.onerror = () => reject(req.error);
        }));
    }

    function setSetting(key, value) {
        storage.set(key, value)
    }

    async function setSettingToDB(key, value) {
        await ensureDbReady();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("settings", "readwrite");
            const store = tx.objectStore("settings");
            store.put({ key, value });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }

    function updateEvent(dateText) {
        const cell = document.querySelector("#event-cell");

        if (!cell) return;

        const html = getEventFor(dateText);

        cell.innerHTML = html.replace(/\n/g, "<br>");
    }

    function updateFromJSON(dateText) {
        const schedule = getScheduleFor(dateText).map(resolveSubjectCellText);
        if (currentColumnIndex >= 0 && currentColumnIndex < dateCells.length) {
            const mainRows = timetableMain ? timetableMain.querySelectorAll("tbody tr") : document.querySelectorAll("#timetable-main tbody tr");
            mainRows.forEach((row, rowIndex) => {
                const cell = row.querySelectorAll("td")[currentColumnIndex];
                if (cell) cell.textContent = schedule[rowIndex] || "";
            });
        } else if (timetableSplit && splitDateCells.length > 0 && currentColumnIndex >= SPLIT_OFFSET) {
            const localIndex = currentColumnIndex - SPLIT_OFFSET;
            const splitRows = timetableSplit.querySelectorAll("tbody tr");
            splitRows.forEach((row, rowIndex) => {
                const cell = row.querySelectorAll("td")[localIndex];
                if (cell) cell.textContent = schedule[rowIndex] || "";
            });
        }

        updateEvent(dateText);
    }

    function updateMemo(dateText) {
        currentDate = dateText;
        loadMemo(dateText, text => {
            memoCell.textContent = text;
        });
    }

    function highlightSubject(row, rowIndex, date, td) {
        const changeList = timetableChanges?.[formatDateText(date)];

        const isChanged = changeList?.some(i =>
            i.class === classNumber &&
            i.period === rowIndex + 1
        );

        td.classList.toggle("timetable-changed", !!isChanged);
    }

    function updateAllSubjects() {
        const mainRows = timetableMain ? timetableMain.querySelectorAll("tbody tr") : document.querySelectorAll("#timetable-main tbody tr");

        dateCells.forEach((cell, colIndex) => {
            const dateText = cell.textContent.trim();
            const schedule = getScheduleFor(dateText).map(resolveSubjectCellText);

            mainRows.forEach((row, rowIndex) => {
                const td = row.querySelectorAll("td")[colIndex];
                if (!td) return;
                
                highlightSubject(row, rowIndex, dateText, td);
                td.textContent = schedule[rowIndex] ?? "";
            });
        });
    
        if (timetableSplit && splitDateCells.length > 0) {
            const splitRows = timetableSplit.querySelectorAll("tbody tr");
            splitDateCells.forEach((cell, localColIndex) => {
                const dateText = cell.textContent.trim();
                
                const schedule = getScheduleFor(dateText).map(resolveSubjectCellText);
                splitRows.forEach((row, rowIndex) => {
                    const td = row.querySelectorAll("td")[localColIndex];
                    if (!td) return;

                    highlightSubject(row, rowIndex, dateText, td);
                    td.textContent = schedule[rowIndex] ?? "";
                });
            });
        }

        // メモ・行事の更新（2段目選択にも対応）
        const selectedDate = getSelectedDateText();

        if (selectedDate) {
            updateEvent(selectedDate);
            updateMemo(selectedDate);
        }
    }


    function updateDayOptions() {
        const month = Number(monthSelect.value);
        const year = today.getFullYear();
        const lastDay = new Date(year, month, 0).getDate();

        daySelect.innerHTML = "";

        for (let i = 1; i <= lastDay; i++) {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = `${i}日`;
            daySelect.appendChild(option);
        }
    }

    function showDate(date) {
        baseDate = new Date(date);
        generateDates();
        updateAllSubjects();

        const target = formatCellDate(date);
        dateCells.forEach((cell, index) => {
            if (cell.textContent.trim() === target) {
                selectColumn(index);
                updateFromJSON(target);
                updateMemo(target);
            }
        });
    }

    function initToday() {
        const todayKey = formatCellDate(today);
        const todaySchedule = getScheduleFor(todayKey);

        if (true) {
            showDate(today);
            return;
        }
    }

    function openModal(title, content) {
        if (title === TERMS_MODAL_TITLE) {
            return openModalRaw(title, content, {
                blocking: true,
                onAgree: () => {
                    document.body.classList.add("agreed-once");
                    agreedTerms = true;
                    setSetting(SETTING_AGREED_TERMS, true);
                    if (typeof pendingAfterTerms === "function") {
                        const fn = pendingAfterTerms;
                        pendingAfterTerms = null;
                        fn();
                    }
                }
            });
        }

        const modalElement = openModalRaw(title, content, { blocking: false });
        if (title === TERMS_VIEW_TITLE && modalElement) {
            const agreeArea = modalElement.querySelector(".agree-area");
            if (agreeArea) {
                agreeArea.style.display = "none";
            }
        }
        return modalElement;
    }

    // Settings modal buttons are loaded via fetch+innerHTML, so we use event delegation.
    installSettingsMenuHandlers({
        document,
        reportUrl: "https://forms.gle/KiiEAds2vtjAmsZ97",
        changeReportUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfTOKMLJz896qfq7OKSv7TRwxxJxX4VIqXT4npLcGmqWNyBkg/viewform?usp=preview",
        openModalById,
        openTermsView,
        openSubjectSetup: () => openSubjectSetupModal({ blocking: false }),
        openClassSetup: () => openClassSetupModal({ blocking: false, onSave: initToday }),
    });

    // Keep window API for backwards compatibility/debug
    window.timetableOpenModalById = openModalById;
    window.timetableOpenTermsView = openTermsView;
    window.timetableOpenSubjectSetup = () => openSubjectSetupModal({ blocking: false });
    window.timetableOpenClassSetup = () => openClassSetupModal({ blocking: false, onSave: initToday });

    // One-time migration from IndexedDB -> localStorage settings (prefers existing localStorage values)

    async function migrateIndexedDBToLocalStorage() {
        await ensureDbReady();
        log("[timetable] migrateIndexedDBToLocalStorage() start");
        let migratedCount = 0;
        const keys = [
            SETTING_THEME,
            SETTING_AGREED_TERMS,
            SETTING_SUBJECT_CHOICES,
            SETTING_CLASS_NUMBER,
            SETTING_LAST_SEEN_VERSION,
            SETTING_EXTRA_EVENTS,
            SETTING_TIMETABLE_CHANGES,
            "isClassroomCode",
        ];

        for (const key of keys) {
            const lsValue = storage.get(key);
            if (lsValue !== null) continue;

            const dbValue = await getSettingfromDB(key);
            if (dbValue === undefined || dbValue === null) continue;

            storage.set(key, dbValue);
            migratedCount++;
            log("[timetable] migrated setting", { key });

            await new Promise((resolve, reject) => {
                const tx = db.transaction("settings", "readwrite");
                const store = tx.objectStore("settings");
                store.delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        }

        log("[timetable] migrateIndexedDBToLocalStorage() done", { migratedCount });
    }

    function refreshCachedDataFromStorage() {
        extraEvents = getSetting(SETTING_EXTRA_EVENTS) || {};
        timetableChanges = getSetting(SETTING_TIMETABLE_CHANGES) || {};
        log("[timetable] cache refreshed", {
            extraEventsKeys: Object.keys(extraEvents || {}).length,
            timetableChangesKeys: Object.keys(timetableChanges || {}).length,
        });
    }

    let bootstrapFromIdbPromise = null;
    try {
        const probablyFirstRun = (typeof localStorage !== "undefined") && localStorage.length === 0;
        const missingCritical =
            getSetting(SETTING_AGREED_TERMS) === null ||
            getSetting(SETTING_CLASS_NUMBER) === null ||
            getSetting(SETTING_THEME) === null;

        if (!probablyFirstRun && missingCritical) {
            bootstrapFromIdbPromise = (async () => {
                try {
                    await migrateIndexedDBToLocalStorage();
                } catch (e) {
                    warn("[timetable] migrateIndexedDBToLocalStorage() failed", e);
                }
                refreshCachedDataFromStorage();
            })();
        } else {
            refreshCachedDataFromStorage();
        }
    } catch (e) {
        warn("[timetable] bootstrap check failed", e);
        refreshCachedDataFromStorage();
    }

    function deleteEmptyMemos() {
        ensureDbReady().then(() => {
            const tx = db.transaction("memos", "readwrite");
            const store = tx.objectStore("memos");

            const req = store.openCursor();

            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) return;

                const value = cursor.value?.text;

                if (!value || String(value).trim() === "") {
                    store.delete(cursor.key);
                }

                cursor.continue();
            };
        }).catch((e) => warn("[timetable] deleteEmptyMemos() skipped (db not ready)", e));
    }
    
    function loadSettingsFromStorage() {
        try {
            const storedTheme = getSetting(SETTING_THEME);

            function getSystemTheme() {
                return window.matchMedia &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
            }

            currentTheme =
                storedTheme === "dark" || storedTheme === "light"
                    ? storedTheme
                    : getSystemTheme();

            applyTheme(currentTheme);

            subjectChoices = getSetting(SETTING_SUBJECT_CHOICES) || null;

            agreedTerms = getSetting(SETTING_AGREED_TERMS) === true;

            const storedClass = Number(getSetting(SETTING_CLASS_NUMBER));
            classNumber =
                Number.isFinite(storedClass) && storedClass >= 1 && storedClass <= 9
                    ? storedClass
                    : null;
        } catch (error) {
            currentTheme = "light";
            subjectChoices = null;
            agreedTerms = false;
            classNumber = null;
            subjectFilter = "";
        }
    }

    loadSettingsFromStorage();

    monthSelect.value = today.getMonth() + 1;
    updateDayOptions();
    daySelect.value = today.getDate();

    // Always show dates + selection immediately
    generateDates();
    selectColumn(0);
    
    let value = getSetting("isClassroomCode");

    if (value === undefined) {
        value = false;
        setSetting("isClassroomCode", value);
    }

    isClassroomCode = value === true || value === "true";

    const updateDateDisplay = () => {
        const month = Number(monthSelect.value);
        const day = Number(daySelect.value);
        showDate(new Date(today.getFullYear(), month - 1, day));
        updateTable();
    };

    monthSelect.addEventListener("change", () => {
        const prevDay = Number(daySelect.value);
        updateDayOptions();

        if (!Number.isNaN(prevDay)) {
            const month = Number(monthSelect.value);
            const year = today.getFullYear();
            const lastDay = new Date(year, month, 0).getDate();
            daySelect.value = String(Math.min(prevDay, lastDay));
        }

        updateDateDisplay();
    });
    daySelect.addEventListener("change", updateDateDisplay);

    const themeBtn = document.getElementById("theme-btn");

    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const nextTheme = currentTheme === "dark" ? "light" : "dark";
            applyTheme(nextTheme);
            setSetting(SETTING_THEME, nextTheme);
            updateSplitLayout();
            updateTable();
        });
    }

    const filterBtn = document.getElementById("filter-btn");
    if (filterBtn) {
        filterBtn.addEventListener("click", () => {
            openFilterModal();
        });
    }

    async function loadAndApplyTimetable() {
        if (typeof classNumber !== "number") {
            return;
        }

        const file = getTimetableFileForClass(classNumber);
        try {
            log("[timetable] loadAndApplyTimetable() start", { file, classNumber });
            timetableData = await fetchJson(file);
            if (timetableChanges) {
                for (const date in timetableChanges) {
                    for (const change of timetableChanges[date]) {
                        if (change.class !== classNumber) continue;
                        if (timetableData[date]) {
                            timetableData[date][change.period - 1] = change.subject;
                            log("[timetable] timetable change", change);
                        }
                    }
                }
            }
            log("[timetable] loadAndApplyTimetable() done", { days: Object.keys(timetableData || {}).length });
        } catch (error) {
            openModal("時間割の読み込みに失敗", `<p style="text-align:left"><code>${escapeHtml(file)}</code></p><p style="text-align:left">${escapeHtml(String(error))}</p>`);
            timetableData = {};
            return;
        }
    }

    async function loadSubjectMapForClass(classNum) {
        try {
            // ベースの subject_map.json を読み込む
            const baseMap = await fetchJson("./assets/json/expansion_map.json");

            // クラスごとの有効なコードを取得
            const validCodes = expansionMap[classNum - 1] || [];

            // タイムテーブルに出てくるキー + validCodes だけに絞る（体育/数学なども含まれる）
            const usedKeys = new Set();
            Object.keys(timetableData || {}).forEach(dayKey => {
                const row = timetableData[dayKey];
                if (!Array.isArray(row)) return;
                row.forEach(cell => {
                    if (typeof cell === "string" && baseMap[cell]) {
                        usedKeys.add(cell);
                    }
                });
            });
            (Array.isArray(validCodes) ? validCodes : []).forEach(code => usedKeys.add(code));

            subjectMap = {};
            usedKeys.forEach(key => {
                if (baseMap[key]) subjectMap[key] = baseMap[key];
            });
        } catch (error) {
            logError("選択科目マップの読み込みに失敗しました", error);
            subjectMap = {};
        }
    }

    async function loadAppData() {
        try {
            log("[timetable] loadAppData() start");
            const [eventsData, holidaysData] = await Promise.all([
                fetchJson("./assets/json/events.json"),
                fetchJson("./assets/json/holidays.json")
            ]);

            events = eventsData;
            holidays = holidaysData || {};
            log("[timetable] events/holidays loaded", {
                eventsKeys: Object.keys(eventsData || {}).length,
                holidaysKeys: Object.keys(holidaysData || {}).length,
            });

            await loadAndApplyTimetable();
            await loadSubjectMapForClass(classNumber);
            log("[timetable] loadAppData() done");

        } catch (error) {
            logError("[timetable] loadAppData() failed", error);
        }
    }

    function continueAfterDataLoaded() {
            const usedCodes = findUsedSubjectCodes();
            const stored = getSubjectChoices() || {};
            const firstVisit =
                usedCodes.length > 0 &&
                (!subjectChoices || Object.keys(subjectChoices).length === 0);
            const missing = usedCodes.some(code => typeof stored[code] !== "string" || stored[code].trim().length === 0);

            if (firstVisit) {
                openSubjectSetupModal({
                    blocking: true,
                    onSave: () => {
                        initToday();
                        showWhatsNewIfUpdated();
                    }
                });
                return;
            }

            // Data has been loaded (timetable/events/holidays). Ensure we render actual subjects now.
            initToday();
            showWhatsNewIfUpdated();
            // initToday() -> showDate() already rendered subjects, so avoid a redundant full redraw here.
            updateTable({ renderSubjects: false });
        }

        async function startAfterRender() {
        await loadAppData(); // ここに重い処理を隔離
        continueAfterDataLoaded();
    }

    async function start() {
        updateSplitLayout();

        if (bootstrapFromIdbPromise) {
            log("[timetable] bootstrapping settings from IndexedDB...");
            await bootstrapFromIdbPromise;
            refreshCachedDataFromStorage();
            loadSettingsFromStorage();
        }

        if (!agreedTerms) {
            pendingAfterTerms = start;
            fetch("./assets/html/terms.html")
                .then(response => response.text())
                .then(html => {
                    openModal(TERMS_MODAL_TITLE, html);
                    document.body.classList.add("blocked");
                });
            return;
        }

        if (typeof classNumber !== "number") {
            openClassSetupModal({
                blocking: true,
                onSave: () => start()
            });
            return;
        }

        // ここで画面を一度出す（重要）
        generateDates();
        selectColumn(0);
        requestAnimationFrame(() => {
            applyTheme(currentTheme);
            updateSplitLayout();
            // Avoid doing a full subject render before data is loaded.
            updateTable({ renderSubjects: false });

            // Moving-room data isn't needed for the initial "日程" view, so load it in the background.
            loadMovingData().then(() => {
                if (isMovingMode) {
                    updateTable();
                }
            }).catch(() => {});
        });
        startAfterRender(); // 後処理へ

        gtag('event', 'page_view');
    }

    start();

    
    // Re-evaluate split layout on rotation/resize
    window.addEventListener("resize", () => {
        updateSplitLayout();
    });

    memoCell.addEventListener("input", () => {
        if (currentDate) {
            const text = memoCell.textContent.trim()
            saveMemo(currentDate, text);
        }
    });

    subjectCells.forEach(cell => {
        cell.addEventListener("click", () => {
            const colIndex = cell.cellIndex - 1;
            selectColumn(colIndex);

            const dateText = dateCells[colIndex].textContent.trim();
            updateFromJSON(dateText);
            updateMemo(dateText);
            updateTable();
        });
    });

    // Split timetable (days 5-8)
    splitSubjectCells.forEach(cell => {
        cell.addEventListener("click", () => {
            const localColIndex = cell.cellIndex - 1;
            const globalColIndex = SPLIT_OFFSET + localColIndex;
            selectColumn(globalColIndex);

            const dateText = splitDateCells[localColIndex].textContent.trim();
            updateFromJSON(dateText);
            updateMemo(dateText);
            updateTable();
        });
    });

    dateCells.forEach((cell, index) => {
        cell.addEventListener("click", () => {
            selectColumn(index);

            const dateText = cell.textContent.trim();
            updateFromJSON(dateText);
            updateMemo(dateText);
            updateTable();
        });
    });

    splitDateCells.forEach((cell, index) => {
        cell.addEventListener("click", () => {
            selectColumn(SPLIT_OFFSET + index);

            const dateText = cell.textContent.trim();
            updateFromJSON(dateText);
            updateMemo(dateText);
            updateTable();
        });
    });

    document.getElementById("today-btn").addEventListener("click", () => {
        const current = new Date();
        monthSelect.value = current.getMonth() + 1;
        updateDayOptions();
        daySelect.value = current.getDate();
        showDate(current);
        updateTable();
    });

    // 利用規約の表示は、設定読み込み後に判定して表示する

    document.getElementById("prev-btn").addEventListener("click", () => {      
        const prevDate = new Date(baseDate);
        prevDate.setDate(prevDate.getDate() - 1);
        showDate(prevDate);
        updateTable();
    });

    document.getElementById("next-btn").addEventListener("click", () => {        
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + 1);
        showDate(nextDate);
        updateTable();
    });

    let isMovingMode = false;

    const toggleHeader = document.querySelector(".toggle-header");
    
    function updateTable(options = {}) {
        const renderSubjects =
            options && typeof options === "object" ? options.renderSubjects !== false : true;

        if (isMovingMode) {
            applyMovingTimetable();
            toggleHeader.classList.add("active");
            toggleHeader.textContent = "教室";
        } else {
            if (renderSubjects) {
                updateAllSubjects();
            }
            toggleHeader.classList.remove("active");
            toggleHeader.textContent = "日程";
        }

        if (!isMovingMode) {
            applySubjectFilter();
        } else {
            clearFilterClasses();
        }
    };

    toggleHeader.addEventListener("click", () => {
        isMovingMode = !isMovingMode;
        gtag('event', 'toggle_mode', {
            mode: isMovingMode ? 'room' : 'schedule'
        });
        updateTable();
    });

    document.getElementById("isClassroomCode").addEventListener("change", event => {
        isClassroomCode = event.target.value === "true";
        setSetting("isClassroomCode", isClassroomCode);
        log("Classroom code mode:", isClassroomCode);
        updateTable();
    });
    // Note: history/help/report/terms/source buttons live inside the settings modal (fetched HTML).
    // Their click handling is implemented in setting.js via event delegation.
});
}
