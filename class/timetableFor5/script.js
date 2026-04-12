document.addEventListener("DOMContentLoaded", async () => {
    const dateCells = document.querySelectorAll(".date-cell");
    const subjectCells = document.querySelectorAll(".timetable tbody td");
    const memoCell = document.getElementById("memo-cell");
    const monthSelect = document.getElementById("month-select");
    const daySelect = document.getElementById("day-select");
    const today = new Date();

    let db;
    let currentColumnIndex = 0;
    let baseDate = new Date();
    let events = {};
    let timetableData = {};
    let subjectMap = {};
    let currentDate = null;
    let movingData = [];

    const TERMS_MODAL_TITLE = "利用規約";
    const TERMS_VIEW_TITLE = "利用規約（再掲）";
    const SUBJECT_SETUP_TITLE = "選択科目の設定";
    const SETTING_THEME = "theme";
    const SETTING_SUBJECT_CHOICES = "subjectChoices";
    const SETTING_AGREED_TERMS = "agreedTerms";
    const SETTING_CLASS_NUMBER = "classNumber";

    let currentTheme = "dark";
    let agreedTerms = false;
    let subjectChoices = null;
    let pendingAfterTerms = null;
    let classNumber = null;

    function getTimetableFileForClass(classNo) {
        return `./assets/timetable/timetable_class-${classNo}.json`;
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
            title: "設定",
            file: "./assets/setting.html",
            type: "html"
        },
        source: {
            title: "ソース",
            file: "./assets/html/source.html",
            type: "html"
        }
    };

    function applyTheme(theme) {
        document.body.classList.toggle("theme-light", theme === "light");
        currentTheme = theme;

        const btn = document.getElementById("theme-btn");
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
        if (!originCode) return "-";

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

        // 3. どれにも一致しない → "-"
        return item?.rooms || "HR教室";
    }





    function applyMovingTimetable() {
        const rows = document.querySelectorAll(".timetable tbody tr");

        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll("td");

            cells.forEach((cell, colIndex) => {
                const dateText = dateCells[colIndex].textContent.trim();
                const schedule = getScheduleFor(dateText);

                const originCode = schedule[rowIndex]; // A1, K1, 数ⅡS/La など
                const room = findRoomFor(originCode, classNumber);

                cell.textContent = room || "";
            });
        });
    }

    async function fetchText(file) {
        const res = await fetch(file, { cache: "no-store" });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return await res.text();
    }

    async function fetchJson(file) {
        const res = await fetch(file, { cache: "no-store" });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return await res.json();
    }

    async function loadMovingData() {
        try {
            movingData = await fetchJson("./assets/subjects_rooms_map.json"); // ←あなたの JSON ファイル名
        } catch (e) {
            console.error("移動教室データの読み込みに失敗", e);
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
                    // A1, A2, E1… だけでなく 数Ⅱ S/La なども対象にする
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
        if (!/^[A-Z][0-9]+$/.test(text)) {
            return text;
        }

        const choices = getSubjectChoices();
        const chosen = choices[text];
        if (typeof chosen === "string" && chosen.trim().length > 0) {
            // "__CODE__" means "show the code as-is"
            return chosen === "__CODE__" ? text : chosen;
        }

        return text;
    }

    function escapeHtml(str) {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
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
  <p>クラスを選んでください。</p>
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
                updatePageTitle();
                await setSetting(SETTING_CLASS_NUMBER, nextClass);
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
                await setSetting(SETTING_SUBJECT_CHOICES, nextChoices);
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

    function clearSelection() {
        document.querySelectorAll(".date-selected").forEach(cell => cell.classList.remove("date-selected"));
        document.querySelectorAll(".subject-selected").forEach(cell => cell.classList.remove("subject-selected"));
    }

    function selectColumn(index) {
        clearSelection();
        currentColumnIndex = index;

        if (dateCells[index]) {
            dateCells[index].classList.add("date-selected");
        }

        document
            .querySelectorAll(`tbody tr td:nth-child(${index + 2})`)
            .forEach(cell => cell.classList.add("subject-selected"));
    }

    function formatCellDate(date) {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function formatTimetableKey(date) {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    function parseCellDate(dateText) {
        const [month, day] = dateText.split("/").map(Number);
        return new Date(today.getFullYear(), month - 1, day);
    }

    function parseTimetableKey(key) {
        const match = key.match(/^(\d+)月(\d+)日$/);
        if (!match) {
            return null;
        }

        return new Date(today.getFullYear(), Number(match[1]) - 1, Number(match[2]));
    }

    function getFirstTimetableDate() {
        const dates = Object.keys(timetableData)
            .map(parseTimetableKey)
            .filter(date => date instanceof Date && !Number.isNaN(date.getTime()))
            .sort((a, b) => a - b);

        return dates[0] || null;
    }

    function getEventFor(dateText) {
        const date = parseCellDate(dateText);
        const eventKey = formatTimetableKey(date);
        return events[eventKey] || events[dateText] || "";
    }

    function getScheduleFor(dateText) {
        const date = parseCellDate(dateText);
        const timetableKey = formatTimetableKey(date);
        return timetableData[timetableKey] || timetableData[dateText] || [];
    }

    function generateDates() {
        for (let i = 0; i < dateCells.length; i++) {
            const date = new Date(baseDate);
            date.setDate(baseDate.getDate() + i);
            dateCells[i].textContent = formatCellDate(date);
        }
    }

    function initDB() {
        return new Promise((resolve, reject) => {
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
                resolve();
            };

            request.onerror = () => {
                reject("IndexedDB の初期化に失敗しました");
            };
        });
    }

    function saveMemo(date, text) {
        const tx = db.transaction("memos", "readwrite");
        const store = tx.objectStore("memos");
        store.put({ date, text });
    }

    function loadMemo(date, callback) {
        const tx = db.transaction("memos", "readonly");
        const store = tx.objectStore("memos");
        const req = store.get(date);

        req.onsuccess = () => {
            callback(req.result ? req.result.text : "");
        };
    }

    function getSetting(key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction("settings", "readonly");
            const store = tx.objectStore("settings");
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
            req.onerror = () => reject(req.error);
        });
    }

    function setSetting(key, value) {
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
        document.querySelector(".other-table thead td").innerHTML =
            getEventFor(dateText).replace(/\n/g, "<br>");
    }

    function updateFromJSON(dateText) {
        const schedule = getScheduleFor(dateText).map(resolveSubjectCellText);
        const rows = document.querySelectorAll(".timetable tbody tr");

        rows.forEach((row, rowIndex) => {
            const cell = row.querySelectorAll("td")[currentColumnIndex];
            cell.textContent = schedule[rowIndex] || "";
        });

        updateEvent(dateText);
    }

    function updateMemo(dateText) {
        currentDate = dateText;
        loadMemo(dateText, text => {
            memoCell.textContent = text;
        });
    }

function updateAllSubjects() {
    const rows = document.querySelectorAll(".timetable tbody tr");

    // 各日付列ごとに処理
    dateCells.forEach((cell, colIndex) => {
        const dateText = cell.textContent.trim();
        const schedule = getScheduleFor(dateText).map(resolveSubjectCellText);

        rows.forEach((row, rowIndex) => {
            const td = row.querySelectorAll("td")[colIndex];
            if (!td) return; // ← 存在しない列はスキップ（スマホ幅対策）

            // 未選択の科目は ""（空欄）にする
            td.textContent = schedule[rowIndex] ?? "";
        });
    });

    // メモ・行事の更新
    const selectedDate = dateCells[currentColumnIndex]?.textContent.trim();
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

        if (todaySchedule.length > 0) {
            showDate(today);
            return;
        }

        const firstTimetableDate = getFirstTimetableDate();
        if (firstTimetableDate) {
            showDate(firstTimetableDate);
            monthSelect.value = firstTimetableDate.getMonth() + 1;
            updateDayOptions();
            daySelect.value = firstTimetableDate.getDate();
            return;
        }

        generateDates();
        selectColumn(0);
        const firstDate = dateCells[0].textContent.trim();
        updateFromJSON(firstDate);
        updateMemo(firstDate);
    }

    function openModal(title, content) {
        const template = document.getElementById("modal-template");
        const modal = template.content.cloneNode(true);

        const modalElement = modal.querySelector(".modal");
        modalElement.querySelector(".modal-title").textContent = title;
        modalElement.querySelector(".modal-body").innerHTML = content;

        document.body.appendChild(modalElement);
        requestAnimationFrame(() => modalElement.classList.add("show"));

        const closeBtn = modalElement.querySelector(".close-modal");

        if (title === TERMS_MODAL_TITLE) {
            closeBtn.style.display = "none";
            document.body.classList.add("blocked");
        }

        if (title === TERMS_VIEW_TITLE) {
            closeBtn.style.display = "block";
            const agreeArea = modalElement.querySelector(".agree-area");
            if (agreeArea) {
                agreeArea.style.display = "none";
            }
        }

        closeBtn.addEventListener("click", () => {
            if (title === TERMS_MODAL_TITLE) {
                return;
            }

            modalElement.classList.remove("show");
            setTimeout(() => modalElement.remove(), 250);
            document.body.classList.remove("blocked");
        });

        modalElement.addEventListener("click", event => {
            if (event.target.id === "agree-btn") {
                document.body.classList.add("agreed-once");
                agreedTerms = true;
                setSetting(SETTING_AGREED_TERMS, true).catch(() => {});

                modalElement.classList.remove("show");
                setTimeout(() => modalElement.remove(), 250);
                document.body.classList.remove("blocked");

                if (typeof pendingAfterTerms === "function") {
                    const fn = pendingAfterTerms;
                    pendingAfterTerms = null;
                    fn();
                }
            }
        });

        modalElement.addEventListener("change", event => {
            if (event.target.id === "agree-check") {
                const button = modalElement.querySelector("#agree-btn");
                button.disabled = !event.target.checked;
            }
        });

        return modalElement;
    }

    // Expose functions for setting.js (buttons are inside modal HTML fetched via innerHTML)
    window.timetableOpenModalById = openModalById;
    window.timetableOpenTermsView = openTermsView;
    window.timetableOpenSubjectSetup = () => openSubjectSetupModal({ blocking: false });
    window.timetableOpenClassSetup = () => openClassSetupModal({ blocking: false, onSave: initToday });

    await initDB();

    // One-time migration from localStorage -> IndexedDB settings (then delete localStorage keys)
    try {
        if (typeof localStorage !== "undefined") {
            const lsTheme = localStorage.getItem(SETTING_THEME);
            if (lsTheme === "light" || lsTheme === "dark") {
                await setSetting(SETTING_THEME, lsTheme);
                localStorage.removeItem(SETTING_THEME);
            }

            const lsAgreed = localStorage.getItem("agreedTerms");
            if (lsAgreed === "true") {
                await setSetting(SETTING_AGREED_TERMS, true);
                localStorage.removeItem("agreedTerms");
            }

            const lsChoices = localStorage.getItem("subjectChoices");
            if (lsChoices) {
                try {
                    const parsed = JSON.parse(lsChoices);
                    if (parsed && typeof parsed === "object") {
                        await setSetting(SETTING_SUBJECT_CHOICES, parsed);
                    }
                } catch {
                    // ignore
                }
                localStorage.removeItem("subjectChoices");
            }

            const lsClass = localStorage.getItem(SETTING_CLASS_NUMBER);
            if (lsClass) {
                const parsed = Number(lsClass);
                if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 9) {
                    await setSetting(SETTING_CLASS_NUMBER, parsed);
                }
                localStorage.removeItem(SETTING_CLASS_NUMBER);
            }
        }
    } catch (error) {
        console.error("localStorage からの移行に失敗しました", error);
    }

    // Load app settings from IndexedDB (no localStorage)
    try {
        const storedTheme = await getSetting(SETTING_THEME);
        currentTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
        applyTheme(currentTheme);

        const storedChoices = await getSetting(SETTING_SUBJECT_CHOICES);
        subjectChoices = storedChoices && typeof storedChoices === "object" ? storedChoices : null;

        agreedTerms = Boolean(await getSetting(SETTING_AGREED_TERMS));

        const storedClass = await getSetting(SETTING_CLASS_NUMBER);
        classNumber =
            typeof storedClass === "number" && Number.isFinite(storedClass) && storedClass >= 1 && storedClass <= 9
                ? storedClass
                : null;
    } catch (error) {
        console.error("設定の読み込みに失敗しました", error);
        currentTheme = "dark";
        applyTheme(currentTheme);
        subjectChoices = null;
        agreedTerms = false;
        classNumber = null;
    }

    monthSelect.value = today.getMonth() + 1;
    updateDayOptions();
    daySelect.value = today.getDate();

    // Always show dates + selection immediately
    generateDates();
    selectColumn(0);

    const updateDateDisplay = () => {
        const month = Number(monthSelect.value);
        const day = Number(daySelect.value);
        showDate(new Date(today.getFullYear(), month - 1, day));
    };

    monthSelect.addEventListener("change", updateDateDisplay);
    daySelect.addEventListener("change", updateDateDisplay);

    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const nextTheme = currentTheme === "dark" ? "light" : "dark";
            applyTheme(nextTheme);
            setSetting(SETTING_THEME, nextTheme).catch(() => {});
        });
        applyTheme(currentTheme);
    }

    function updatePageTitle() {
        if (typeof classNumber !== "number") {
            return;
        }
        const titleText = `3年${classNumber}組 時間割表`;
        const titleEl = document.getElementById("title");
        if (titleEl) {
            titleEl.textContent = titleText;
        }
        document.title = titleText;
    }

    async function loadAndApplyTimetable() {
        if (typeof classNumber !== "number") {
            return;
        }

        const file = getTimetableFileForClass(classNumber);
        try {
            timetableData = await fetchJson(file);
            updatePageTitle();
        } catch (error) {
            openModal("時間割の読み込みに失敗", `<p style="text-align:left"><code>${escapeHtml(file)}</code></p><p style="text-align:left">${escapeHtml(String(error))}</p>`);
            timetableData = {};
            return;
        }
    }

    async function loadSubjectMapForClass(classNum) {
        try {
            // ベースの subject_map.json を読み込む
            const baseResponse = await fetch("./assets/expansion_map.json");
            const baseMap = baseResponse.ok ? await baseResponse.json() : {};

            // クラスごとの有効なコードを取得
            const validCodes = expansionMap[classNum - 1] || [];

            // 有効なコードのみにフィルタリング
            subjectMap = {};
            for (const code of validCodes) {
                if (baseMap[code]) {
                    subjectMap[code] = baseMap[code];
                }
            }
        } catch (error) {
            console.error("選択科目マップの読み込みに失敗しました", error);
            subjectMap = {};
        }
    }

    async function loadAppData() {
        try {
            const [eventsData, expansionMapData] = await Promise.all([
                fetchJson("./assets/events.json"),
                fetchJson("./assets/class_expansion_map.json")
            ]);
            events = eventsData;
            expansionMap = expansionMapData || [];
            subjectMap = await fetchJson("./assets/expansion_map.json");
            console.log("subjectMap loaded:", subjectMap);
            await loadAndApplyTimetable();
        } catch (error) {
            console.error("データの読み込みに失敗しました", error);
        }
    }

    function continueAfterDataLoaded() {
        updatePageTitle();
        const usedCodes = findUsedSubjectCodes();
        const stored = getSubjectChoices();
        const firstVisit = usedCodes.length > 0 && subjectChoices === null;
        const missing = usedCodes.some(code => typeof stored[code] !== "string" || stored[code].trim().length === 0);

        if (firstVisit) {
            openSubjectSetupModal({ blocking: true, onSave: initToday });
            return;
        }
        // if (missing) {
        //     openSubjectSetupModal({ blocking: false });
        // }
        initToday();
    }

    async function start() {
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

        await loadMovingData();
        await loadAppData();
        continueAfterDataLoaded();
    }

    start();

    memoCell.addEventListener("input", () => {
        if (currentDate) {
            saveMemo(currentDate, memoCell.textContent.trim());
        }
    });

    subjectCells.forEach(cell => {
        cell.addEventListener("click", () => {
            const colIndex = cell.cellIndex - 1;
            selectColumn(colIndex);

            const dateText = dateCells[colIndex].textContent.trim();
            updateFromJSON(dateText);
            updateMemo(dateText);
        });
    });

    dateCells.forEach((cell, index) => {
        cell.addEventListener("click", () => {
            selectColumn(index);

            const dateText = cell.textContent.trim();
            updateFromJSON(dateText);
            updateMemo(dateText);
        });
    });

    monthSelect.addEventListener("change", () => {
        updateDayOptions();
        updateDateDisplay();
    });

    document.getElementById("today-btn").addEventListener("click", () => {
        const current = new Date();
        monthSelect.value = current.getMonth() + 1;
        updateDayOptions();
        daySelect.value = current.getDate();
        showDate(current);
    });

    // 利用規約の表示は、設定読み込み後に判定して表示する

    document.getElementById("prev-btn").addEventListener("click", () => {
        const prevDate = new Date(baseDate);
        prevDate.setDate(prevDate.getDate() - 1);
        showDate(prevDate);
    });

    document.getElementById("next-btn").addEventListener("click", () => {
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + 1);
        showDate(nextDate);
    });

    let isMovingMode = false;

    const toggleHeader = document.getElementById("toggle-header");

    toggleHeader.addEventListener("click", () => {
        isMovingMode = !isMovingMode;

        if (isMovingMode) {
            applyMovingTimetable();
            toggleHeader.classList.add("active");
            toggleHeader.textContent = "教室";
        } else {
            updateAllSubjects();
            toggleHeader.classList.remove("active");
            toggleHeader.textContent = "日程";
        }
    });


    // Note: history/help/report/terms/source buttons live inside the settings modal (fetched HTML).
    // Their click handling is implemented in setting.js via event delegation.
});
