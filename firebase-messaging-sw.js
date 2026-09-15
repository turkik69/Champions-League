/* Firebase Cloud Messaging service worker for GitHub Pages PWA */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyBsnryD1ZtvjzumatCCVN-QpRAMR4_IG7M',
  authDomain: 'world-cup-2026-d3091.firebaseapp.com',
  databaseURL: 'https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'world-cup-2026-d3091',
  storageBucket: 'world-cup-2026-d3091.firebasestorage.app',
  messagingSenderId: '830204361101',
  appId: '1:830204361101:web:f3a23c0fa41bb809d365c4',
  measurementId: 'G-4Y1R6PW3SL'
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload=>{
  if(payload && payload.notification) return;
  const title = payload?.data?.title || 'توقعاتي';
  const body = payload?.data?.body || 'لديك إشعار جديد';
  self.registration.showNotification(title, {
    body,
    icon:'./assets/app-icon-192.png',
    badge:'./assets/app-icon-192.png',
    data:{url:payload?.data?.url || self.registration.scope},
    tag:payload?.data?.messageId || 'ucl-admin-message',
    renotify:true
  });
});

self.addEventListener('install', ()=>self.skipWaiting());
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  const target = event.notification?.data?.url || self.registration.scope;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('focus' in client){ client.navigate?.(target); return client.focus(); }
    }
    return clients.openWindow ? clients.openWindow(target) : null;
  }));
});
