importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// REPLACE WITH YOUR FIREBASE CONFIG
firebase.initializeApp({
  apiKey: "AIzaSyCP6xVzx2OxAS-Z2lFKyuosjocWEkBVmdc",
  authDomain: "gym-finance-app.firebaseapp.com",
  projectId: "gym-finance-app",
  storageBucket: "gym-finance-app.firebasestorage.app",
  messagingSenderId: "992657293811",
  appId: "1:992657293811:web:2fa9adbbe64d075917d286"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano.', payload);
  
  const notificationTitle = payload.notification.title || 'Alerta de Gym';
  const notificationOptions = {
    body: payload.notification.body,
    icon: './assets/logo.png', // Añade tu icono real aquí
    badge: './assets/badge.png', // Añade tu badge
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
