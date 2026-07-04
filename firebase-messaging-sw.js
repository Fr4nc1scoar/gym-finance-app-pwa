importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// REPLACE WITH YOUR FIREBASE CONFIG
firebase.initializeApp({
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
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
