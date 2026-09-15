/* Firebase Cloud Messaging service worker for GitHub Pages PWA */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const DB_URL = 'https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app';
const PUBLIC_CONFIG_PATH = 'pushPublicConfig';
let messagingReady = false;

async function startMessaging(){
  if(messagingReady) return;
  try{
    const r = await fetch(`${DB_URL}/${PUBLIC_CONFIG_PATH}.json`, {cache:'no-store'});
    if(!r.ok) return;
    const cfg = await r.json();
    if(!cfg || !cfg.apiKey || !cfg.projectId || !cfg.messagingSenderId || !cfg.appId) return;
    if(!firebase.apps.length) firebase.initializeApp(Object.assign({databaseURL:DB_URL}, cfg));
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(payload=>{
      // Notification payloads are displayed automatically by FCM.
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
    messagingReady = true;
  }catch(e){}
}

self.addEventListener('install', event=>{
  self.skipWaiting();
  event.waitUntil(startMessaging());
});
self.addEventListener('activate', event=>{
  event.waitUntil(Promise.all([clients.claim(), startMessaging()]));
});
self.addEventListener('push', ()=>{ startMessaging(); });
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

startMessaging();
