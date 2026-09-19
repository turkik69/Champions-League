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


/* =========================================================
   MUEEN — personal notification channel
   Data namespace is isolated under /mueen/users/{uid}
   ========================================================= */
const MUEEN_URL = 'https://turkik69.github.io/mueen/';
const MUEEN_ICON = MUEEN_URL + 'icon.svg';

exports.mueenPushDispatch = onValueCreated({
  ref: '/mueen/users/{uid}/pushQueue/{messageId}',
  region: 'europe-west1'
}, async (event) => {
  const uid = String(event.params.uid || '');
  const messageId = String(event.params.messageId || '');
  const msg = event.data.val();

  if (!uid || !messageId || !msg || !msg.body) return;

  const db = getDatabase();
  const tokensSnap = await db.ref('/mueen/users/' + uid + '/pushTokens').once('value');
  const rows = tokensSnap.val() || {};
  const entries = Object.entries(rows).filter(([, value]) => value && value.token);

  if (!entries.length) {
    await event.data.ref.update({
      status: 'no-devices',
      processedAt: Date.now()
    });
    return;
  }

  const title = String(msg.title || 'مُعين').slice(0, 120);
  const body = String(msg.body || '').slice(0, 500);
  const messaging = getMessaging();
  const invalidKeys = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);
    const tokens = batch.map(([, value]) => value.token);

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {title, body},
      data: {
        title,
        body,
        messageId,
        type: String(msg.type || 'reminder'),
        itemId: String(msg.itemId || ''),
        url: MUEEN_URL
      },
      webpush: {
        notification: {
          icon: MUEEN_ICON,
          badge: MUEEN_ICON,
          tag: 'mueen-' + messageId,
          renotify: true
        },
        fcmOptions: {link: MUEEN_URL}
      }
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, idx) => {
      if (!result.success) {
        const code = result.error && result.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidKeys.push(batch[idx][0]);
        }
      }
    });
  }

  const updates = {};
  invalidKeys.forEach((key) => {
    updates['/mueen/users/' + uid + '/pushTokens/' + key] = null;
  });
  updates['/mueen/users/' + uid + '/pushQueue/' + messageId + '/status'] =
    successCount > 0 ? 'sent' : 'failed';
  updates['/mueen/users/' + uid + '/pushQueue/' + messageId + '/processedAt'] = Date.now();
  updates['/mueen/users/' + uid + '/pushQueue/' + messageId + '/successCount'] = successCount;
  updates['/mueen/users/' + uid + '/pushQueue/' + messageId + '/failureCount'] = failureCount;

  await db.ref().update(updates);
});
