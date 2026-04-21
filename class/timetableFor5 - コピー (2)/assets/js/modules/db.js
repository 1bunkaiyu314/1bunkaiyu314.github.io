function ensureStores(db) {
  // Create stores idempotently across upgrades
  if (!db.objectStoreNames.contains("memos")) {
    db.createObjectStore("memos", { keyPath: "date" });
  }
  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings", { keyPath: "key" });
  }
}

export function openTimetableDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TimetableDB", 3);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      ensureStores(db);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(createDbApi(db));
    };

    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

function createDbApi(db) {
  function saveMemo(date, text) {
    const tx = db.transaction("memos", "readwrite");
    tx.objectStore("memos").put({ date, text });
  }

  function loadMemo(date) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("memos", "readonly");
      const req = tx.objectStore("memos").get(date);
      req.onsuccess = () => resolve(req.result ? req.result.text : "");
      req.onerror = () => reject(req.error);
    });
  }

  function getSetting(key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readonly");
      const req = tx.objectStore("settings").get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  function setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return { db, saveMemo, loadMemo, getSetting, setSetting };
}
