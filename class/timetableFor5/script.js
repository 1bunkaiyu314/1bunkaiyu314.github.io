document.addEventListener("DOMContentLoaded", async () => {

const dateCells = document.querySelectorAll('.date-cell');
const subjectCells = document.querySelectorAll('.timetable tbody td');
const memoCell = document.getElementById("memo-cell");
const monthSelect = document.getElementById("month-select");
const daySelect = document.getElementById("day-select");
const today = new Date();
let db;
let currentColumnIndex = 0;
let baseDate = new Date(); // 今日を基準にする
let events = {};
let hensoku = {};
let dayType = {};
let currentDate = null;

const scheduleA = {
    "Mon": ["英", "数", "化", "体", "国"],
    "Tue": ["国", "英", "物", "数", "体"],
    "Wed": ["英", "英", "数", "化", "体"],
    "Thu": ["化", "数", "英", "国", "社"],
    "Fri": ["数", "国", "英", "物", "化"],
};

const scheduleB = {
    "Mon": ["英", "数", "化", "体", "国"],
    "Tue": ["国", "英", "物", "数", "体"],
    "Wed": ["英", "英", "数", "化", "体"],
    "Thu": ["化", "数", "英", "国", "社"],
    "Fri": ["数", "国", "英", "物", "化"],
};

const scheduleC = {
    "Sat": ["数", "国", "英"]
}

const modalMap = {
    "history": "history-modal",
    "help": "help-modal",
    "setting": "setting-modal",
    "terms": "terms-modal"
};

const modalContent = {
    "history": {
        title: "更新履歴",
        file: "./assets/history.json",
        type: "json"
    },
    "help": {
        title: "ヘルプ",
        file: "./assets/help.html",
        type: "html"
    },
    "setting": {
        title: "設定",
        file: "./assets/setting.html",
        type: "html"
    },
    "source": {
        title: "ソース",
        file: "./assets/source.html",
        type: "html"
    }
};





// --------------------------function--------------------------
function clearSelection() {
    document.querySelectorAll('.date-selected').forEach(c => c.classList.remove('date-selected'));
    document.querySelectorAll('.subject-selected').forEach(c => c.classList.remove('subject-selected'));
}

function selectColumn(index) {
    clearSelection();
    currentColumnIndex = index;

    dateCells[index].classList.add('date-selected');

    document.querySelectorAll(`tbody tr td:nth-child(${index + 2})`)
        .forEach(cell => cell.classList.add('subject-selected'));
}

function generateDates() {
    const dateCells = document.querySelectorAll(".date-cell");

    for (let i = 0; i < dateCells.length; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);

        const month = d.getMonth() + 1;
        const day = d.getDate();

        dateCells[i].textContent = `${month}/${day}`;
    }
}

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("TimetableDB", 1);

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            db.createObjectStore("memos", { keyPath: "date" });
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            resolve();
        };

        request.onerror = function() {
            reject("IndexedDB の初期化に失敗しました");
        };
    });
}

function saveMemo(date, text) {
    const tx = db.transaction("memos", "readwrite");
    const store = tx.objectStore("memos");
    store.put({ date: date, text: text });
}

function loadMemo(date, callback) {
    const tx = db.transaction("memos", "readonly");
    const store = tx.objectStore("memos");
    const req = store.get(date);

    req.onsuccess = () => {
        callback(req.result ? req.result.text : "");
    };
}

function getWeekdayKey(dateStr) {
    const [month, day] = dateStr.split("/").map(Number);
    const d = new Date(new Date().getFullYear(), month - 1, day);
    const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return week[d.getDay()];
}

function getScheduleFor(date) {
    const type = dayType[date]; // "A" / "B" / "変"

    // 変則 → Hensoku.json を使う
    if (type === "変") {
        return hensoku[date] || [];
    }

    // A / B → 曜日で決定
    const weekday = getWeekdayKey(date);

    if (type === "A") {
        return scheduleA[weekday] || [];
    }
    if (type === "B") {
        return scheduleB[weekday] || [];
    }
    if (type === "C") {
        return scheduleC[weekday] || [];
    }

    return [];
}

function updateFromJSON(date) {
    const schedule = getScheduleFor(date);

    const rows = document.querySelectorAll(".timetable tbody tr");
    rows.forEach((row, i) => {
        const cell = row.querySelectorAll("td")[currentColumnIndex];
        cell.textContent = schedule[i] || "";
    });

    document.querySelector(".other-table thead td").textContent =
        events[date] || "";
}

function updateMemo(date) {
    currentDate = date;
    loadMemo(date, text => {
        memoCell.textContent = text;
    });
}

function getTodayKey() {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function initToday() {
    const today = getTodayKey();
    let found = false;

    dateCells.forEach((cell, index) => {
        if (cell.textContent.trim() === today) {
            found = true;
            selectColumn(index);
            updateFromJSON(today);
            updateMemo(today);
        }
    });

    if (!found) {
        const first = dateCells[0].textContent.trim();
        selectColumn(0);
        updateFromJSON(first);
        updateMemo(first);
    }
}

function updateAllSubjects() {
    const dateCells = document.querySelectorAll(".date-cell");
    const rows = document.querySelectorAll(".timetable tbody tr");

    dateCells.forEach((cell, colIndex) => {
        const date = cell.textContent.trim();
        const schedule = getScheduleFor(date);

        rows.forEach((row, rowIndex) => {
            const td = row.querySelectorAll("td")[colIndex];
            td.textContent = schedule[rowIndex] || "";
        });
    });

    // 行事
    const firstDate = dateCells[currentColumnIndex].textContent.trim();
    document.querySelector(".other-table thead td").textContent =
        events[firstDate] || "";

    // メモ
    updateMemo(firstDate);
}

function updateDayOptions() {
    const month = Number(monthSelect.value);
    const year = new Date().getFullYear();

    const lastDay = new Date(year, month, 0).getDate(); // その月の最終日

    daySelect.innerHTML = "";

    for (let i = 1; i <= lastDay; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i + "日";
        daySelect.appendChild(opt);
    }
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

    // ▼ 初回の利用規約（強制）
    if (title === "利用規約") {
        closeBtn.style.display = "none"; // 閉じる禁止
        document.body.classList.add("blocked");
    }

    // ▼ 2回目以降（読み物として表示）
    if (title === "利用規約（再表示）") {
        closeBtn.style.display = "block"; // 閉じるOK
        const agreeArea = modalElement.querySelector(".agree-area");
        if (agreeArea) agreeArea.style.display = "none"; // 同意エリアを非表示
    }

    // ▼ 閉じるボタン（再表示のときだけ動く）
    closeBtn.addEventListener("click", () => {
        if (title === "利用規約") return; // 初回は閉じられない
        modalElement.classList.remove("show");
        setTimeout(() => modalElement.remove(), 250);
        document.body.classList.remove("blocked");
    });

    // ▼ 初回の同意処理
    modalElement.addEventListener("click", (e) => {
        if (e.target.id === "agree-btn") {
            document.body.classList.add("agreed-once");
            localStorage.setItem("agreedTerms", "true");

            modalElement.classList.remove("show");
            setTimeout(() => modalElement.remove(), 250);

            document.body.classList.remove("blocked");
        }
    });

    // ▼ チェックボックスでボタン有効化
    modalElement.addEventListener("change", (e) => {
        if (e.target.id === "agree-check") {
            const btn = modalElement.querySelector("#agree-btn");
            btn.disabled = !e.target.checked;
        }
    });
}






// --------------------------main--------------------------




await initDB();

// まず月・日セレクトの初期化
monthSelect.value = today.getMonth() + 1;
updateDayOptions();                    // ← この順番が大事
daySelect.value = today.getDate();

// JSON 読み込み
Promise.all([
    fetch("./assets/events.json").then(r => r.json()),
    fetch("./assets/Hensoku.json").then(r => r.json()),
    fetch("./assets/AorBorHen.json").then(r => r.json())
]).then(([eventsData, hensokuData, typeData]) => {
    events = eventsData;
    hensoku = hensokuData;
    dayType = typeData;

    generateDates();
    initToday();

    document.getElementById("go-btn").addEventListener("click", () => {
        const month = Number(monthSelect.value);
        const day = Number(daySelect.value);

        // 選択された日付を Date に変換
        const targetDate = new Date(today.getFullYear(), month - 1, day);

        // baseDate をその日付に変更
        baseDate = new Date(targetDate);

        // 日付列を再生成
        generateDates();
        updateAllSubjects();

        const target = `${month}/${day}`;

        // 再生成された日付列から探す
        dateCells.forEach((cell, index) => {
            if (cell.textContent.trim() === target) {
                selectColumn(index);
                updateFromJSON(target);
                updateMemo(target);
            }
        });
    });
});



// 入力があったら保存
memoCell.addEventListener("input", () => {
    if (currentDate) {
        saveMemo(currentDate, memoCell.textContent.trim());
    }
});

subjectCells.forEach(cell => {
    cell.addEventListener('click', () => {
        const colIndex = cell.cellIndex - 1;
        selectColumn(colIndex);

        const date = dateCells[colIndex].textContent.trim();
        updateFromJSON(date);
        updateMemo(date);
    });
});

// 日付セルクリック
dateCells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        selectColumn(index);

        const date = cell.textContent.trim();
        updateFromJSON(date);
        updateMemo(date);
    });
});

monthSelect.addEventListener("change", () => {
    updateDayOptions();
});

document.getElementById("today-btn").addEventListener("click", () => {
    const d = new Date();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    // セレクトを今日に合わせる
    monthSelect.value = month;
    updateDayOptions();
    daySelect.value = day;

    // baseDate を今日に戻す
    baseDate = new Date();

    // 日付列を再生成
    generateDates();
    updateAllSubjects();

    // 今日の列を選択
    const todayKey = `${month}/${day}`;
    dateCells.forEach((cell, index) => {
        if (cell.textContent.trim() === todayKey) {
            selectColumn(index);
            updateFromJSON(todayKey);
            updateMemo(todayKey);
        }
    });
});

if (!localStorage.getItem("agreedTerms")) {
    fetch("./assets/terms.html")
        .then(r => r.text())
        .then(html => {
            openModal("利用規約", html);
            document.body.classList.add("blocked");
        });
}

document.getElementById("prev-btn").addEventListener("click", () => {
    baseDate.setDate(baseDate.getDate() - 1);
    generateDates();
    updateAllSubjects();
});

document.getElementById("next-btn").addEventListener("click", () => {
    baseDate.setDate(baseDate.getDate() + 1);
    generateDates();
    updateAllSubjects();
});



// 開く処理
Object.keys(modalContent).forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const { title, file, type } = modalContent[id];

        let content = "";

        if (type === "json") {
            const res = await fetch(file);
            const json = await res.json();

            // JSON → HTML に変換
            content = json.map(item => `
                <h3>ver. ${item.version}</h3>
                <p>${item.detail}</p>
            `).join("");
        }

        if (type === "html") {
            const res = await fetch(file);
            content = await res.text();
        }

        openModal(title, content);
    });
});

document.getElementById("report").addEventListener("click", () => {
    window.open("https://forms.gle/KiiEAds2vtjAmsZ97", "_blank");
});

document.getElementById("terms").addEventListener("click", () => {
    fetch("./assets/terms.html")
        .then(r => r.text())
        .then(html => {
            openModal("利用規約（再表示）", html);
        });
});


});