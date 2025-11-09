// Firebase MessagingのService Worker

// Firebase SDKを読み込み
importScripts("https://www.gstatic.com/firebasejs/12.5.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.5.0/firebase-messaging-compat.js");

// Firebase設定（main.jsと同じものを使う）
firebase.initializeApp({
  apiKey: "AIzaSyBjTIGO-L5maVngXjvInXjFDwiWnPSmWHU",
  authDomain: "active-recall-reminder.firebaseapp.com",
  projectId: "active-recall-reminder",
  storageBucket: "active-recall-reminder.firebasestorage.app",
  messagingSenderId: "518801850145",
  appId: "1:518801850145:web:9d9b0ae4edb7fdca6dc860",
  measurementId: "G-ZS7W4ENZKT"
});

// Firebase Messagingを初期化
const messaging = firebase.messaging();

// バックグラウンドメッセージの受信
messaging.onBackgroundMessage((payload) => {
  console.log("バックグラウンドでメッセージを受信:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon.png" // 任意のアイコン
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
