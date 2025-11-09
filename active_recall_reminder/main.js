// Firebase SDKをインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-messaging.js";

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


// Firebase初期化済みなので、ここでMessagingを取得
const messaging = getMessaging(app);

// 公開鍵（VAPID key）を設定してトークンを取得
getToken(messaging, {
  vapidKey: "BJVXLbi4GLmDawhkkmo1LVH7pqKxeGZ9yPRmF5rIBuLghrjdsUHPknFBIj0k7DZMbvj8tRyhczwO9wudzy9V-Mw" // 後でFirebaseコンソールから取得
}).then((currentToken) => {
  if (currentToken) {
    console.log("✅ 通知トークン:", currentToken);
    alert("通知トークンが取得できました！\n" + currentToken);
  } else {
    console.log("⚠️ トークンが取得できませんでした（許可がないかも）");
  }
}).catch((err) => {
  console.error("❌ トークン取得中にエラー:", err);
});

// フォアグラウンド（ページ表示中）の通知を受け取る
onMessage(messaging, (payload) => {
  console.log("📩 フォアグラウンドで通知を受信:", payload);
  alert(`通知: ${payload.notification.title}\n${payload.notification.body}`);
});