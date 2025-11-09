importScripts("https://www.gstatic.com/firebasejs/12.5.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.5.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBjTIGO-L5maVngXjvInXjFDwiWnPSmWHU",
  projectId: "active-recall-reminder",
  messagingSenderId: "518801850145",
  appId: "1:518801850145:web:9d9b0ae4edb7fdca6dc860",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("📬 Background message:", payload);
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/icons/icon-192x192.png'
  });
});