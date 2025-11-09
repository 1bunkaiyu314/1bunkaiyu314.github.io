// Firebase SDK 読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjTIGO-L5maVngXjvInXjFDwiWnPSmWHU",
  authDomain: "active-recall-reminder.firebaseapp.com",
  projectId: "active-recall-reminder",
  storageBucket: "active-recall-reminder.firebasestorage.app",
  messagingSenderId: "518801850145",
  appId: "1:518801850145:web:9d9b0ae4edb7fdca6dc860"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 通知許可をリクエスト
Notification.requestPermission().then(async (permission) => {
  if (permission === "granted") {
    console.log("✅ 通知が許可されました");
    const token = await getToken(messaging, { vapidKey: "あなたのVAPIDキー" });
    console.log("🔑 Token:", token);
  } else {
    console.log("🚫 通知が拒否されました");
  }
});

// フォアグラウンドで通知を受け取る
onMessage(messaging, (payload) => {
  console.log("📩 フォアグラウンド通知:", payload);
  alert(payload.notification.title + "\n" + payload.notification.body);
});
