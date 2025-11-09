// Firebase SDKをインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBjTIGO-L5maVngXjvInXjFDwiWnPSmWHU",
  authDomain: "active-recall-reminder.firebaseapp.com",
  projectId: "active-recall-reminder",
  storageBucket: "active-recall-reminder.firebasestorage.app",
  messagingSenderId: "518801850145",
  appId: "1:518801850145:web:9d9b0ae4edb7fdca6dc860",
  measurementId: "G-ZS7W4ENZKT"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 通知ボタン処理
const btn = document.getElementById("notifyBtn");
btn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("このブラウザは通知に対応していません。");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    new Notification("通知が有効になりました！");
  } else {
    alert("通知が拒否されました。");
  }
});

// Service Worker 登録
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      console.log("Service Worker 登録成功:", registration);
    } catch (err) {
      console.error("Service Worker 登録失敗:", err);
    }
  });
}