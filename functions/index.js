const {onValueCreated} = require('firebase-functions/v2/database');
const {initializeApp} = require('firebase-admin/app');
const {getDatabase} = require('firebase-admin/database');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();

const APP_URL = 'https://turkik69.github.io/Champions-League/';
const APP_ICON = APP_URL + 'assets/app-icon-192.png';

exports.broadcastAdminAnnouncement = onValueCreated({
  ref: '/announcements/{messageId}',
  region: 'europe-west1'
}, async (event) => {
  const msg = event.data.val();
  if (!msg || !msg.body) return;

  const db = getDatabase();
  const snap = await db.ref('/uclPushTokens').once('value');
  const rows = snap.val() || {};
  const entries = Object.entries(rows).filter(([,v]) => v && v.enabled !== false && v.token);
  if (!entries.length) return;

  const title = String(msg.title || 'رسالة من الإدارة').slice(0, 120);
  const body = String(msg.body || '').slice(0, 500);
  const messaging = getMessaging();
  const invalidKeys = [];

  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);
    const tokens = batch.map(([,v]) => v.token);
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {title, body},
      data: {
        title,
        body,
        messageId: String(event.params.messageId),
        url: APP_URL
      },
      webpush: {
        notification: {
          icon: APP_ICON,
          badge: APP_ICON,
          tag: String(event.params.messageId),
          renotify: true
        },
        fcmOptions: {link: APP_URL}
      }
    });

    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidKeys.push(batch[idx][0]);
        }
      }
    });
  }

  if (invalidKeys.length) {
    const updates = {};
    invalidKeys.forEach(k => { updates[`/uclPushTokens/${k}`] = null; });
    await db.ref().update(updates);
  }
});
