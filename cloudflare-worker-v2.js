const PROJECT_ID = "world-cup-2026-d3091";
const DATABASE_URL = "https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app";
const APP_URL = "https://turkik69.github.io/Champions-League/";
const APP_ICON = `${APP_URL}assets/app-icon-192.png`;
const SCHEDULE_URL = `${APP_URL}match-schedule.json`;
const MAX_DEVICES_PER_RUN = 50;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function base64Url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON secret is missing");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Service account JSON is missing client_email or private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope:
      "https://www.googleapis.com/auth/firebase.database " +
      "https://www.googleapis.com/auth/userinfo.email " +
      "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(`Google OAuth error: ${JSON.stringify(result)}`);
  return result.access_token;
}

async function firebaseGet(path, token) {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Firebase GET ${path} failed: ${response.status} ${await response.text()}`);
  return await response.json();
}

async function firebasePut(path, value, token) {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Firebase PUT ${path} failed: ${response.status} ${await response.text()}`);
  return true;
}

async function firebasePatch(path, value, token) {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Firebase PATCH ${path} failed: ${response.status} ${await response.text()}`);
  return true;
}

async function sendFCM(deviceToken, title, body, tag, accessToken, data = {}) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          data: {
            title,
            body,
            tag: String(tag),
            url: APP_URL,
            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          },
          webpush: {
            notification: {
              icon: APP_ICON,
              badge: APP_ICON,
              tag: String(tag),
              renotify: true,
            },
            fcm_options: { link: APP_URL },
          },
        },
      }),
    }
  );

  let result = null;
  try { result = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, data: result };
}

async function getEnabledDevices(accessToken) {
  const pushTokens = (await firebaseGet("uclPushTokens", accessToken)) || {};
  return Object.entries(pushTokens)
    .filter(([, device]) => device && device.token && device.enabled !== false)
    .slice(0, MAX_DEVICES_PER_RUN);
}

async function broadcast(title, body, tag, accessToken, data = {}) {
  const devices = await getEnabledDevices(accessToken);
  let successful = 0;
  let failed = 0;
  const errors = [];

  for (const [deviceKey, device] of devices) {
    try {
      const r = await sendFCM(device.token, title, body, tag, accessToken, data);
      if (r.ok) successful++;
      else {
        failed++;
        errors.push({ deviceKey, status: r.status, error: r.data });
      }
    } catch (error) {
      failed++;
      errors.push({ deviceKey, error: error?.message || String(error) });
    }
  }
  return { totalDevices: devices.length, successful, failed, errors: errors.slice(0, 5) };
}

async function processAnnouncements(accessToken) {
  const announcements = (await firebaseGet("announcements", accessToken)) || {};
  let dispatch = (await firebaseGet("uclPushDispatch", accessToken)) || null;

  if (!dispatch || !dispatch._initialized) {
    const initial = { _initialized: { at: Date.now() } };
    for (const id of Object.keys(announcements)) {
      initial[id] = { done: true, bootstrapped: true, at: Date.now() };
    }
    await firebasePut("uclPushDispatch", initial, accessToken);
    return { action: "announcements-initialized", oldMessagesSkipped: Object.keys(announcements).length };
  }

  const pending = Object.entries(announcements)
    .filter(([id, m]) => m && m.body && !dispatch[id]?.done)
    .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

  if (!pending.length) return { action: "announcements-idle" };

  const [messageId, announcement] = pending[0];
  const result = await broadcast(
    String(announcement.title || "رسالة من الإدارة").slice(0, 120),
    String(announcement.body).slice(0, 500),
    `admin-${messageId}`,
    accessToken,
    { type: "admin", messageId }
  );

  await firebasePut(`uclPushDispatch/${messageId}`, {
    done: true,
    sentAt: Date.now(),
    ...result,
  }, accessToken);

  return { action: "announcement-sent", messageId, ...result };
}

function groupSchedule(matches) {
  const groups = new Map();
  for (const m of matches) {
    const key = `${m.md}|${m.ko}`;
    if (!groups.has(key)) groups.set(key, { md: m.md, ko: m.ko, matches: [] });
    groups.get(key).matches.push(m);
  }
  return [...groups.values()].sort((a, b) => new Date(a.ko) - new Date(b.ko));
}

function compactFixtureText(group) {
  if (group.matches.length === 1) {
    const m = group.matches[0];
    return `${m.home} × ${m.away}`;
  }
  if (group.matches.length === 2) {
    return group.matches.map(m => `${m.home} × ${m.away}`).join("، ");
  }
  return `${group.matches.length} مباريات في نفس التوقيت`;
}

function eventKey(group, type) {
  return `md${group.md}_${group.ko.replace(/[^0-9]/g, "")}_${type}`;
}

function buildEvents(group, config) {
  const ko = new Date(group.ko).getTime();
  const openMs = (config.predictionOpenMinutesBeforeKickoff || 1440) * 60_000;
  const reminderMs = (config.reminderMinutesBeforeKickoff || 60) * 60_000;
  const lockMs = (config.predictionLockMinutesBeforeKickoff || 30) * 60_000;
  const fixtureText = compactFixtureText(group);

  return [
    {
      type: "open",
      at: ko - openMs,
      title: `🔓 فُتح باب التوقعات · الجولة ${group.md}`,
      body: group.matches.length === 1
        ? `يمكنك الآن توقع نتيجة ${fixtureText}. سيُغلق باب التوقع قبل المباراة بـ30 دقيقة.`
        : `فُتحت توقعات ${fixtureText}. سيُغلق باب التوقع قبل انطلاق المباريات بـ30 دقيقة.`,
    },
    {
      type: "reminder",
      at: ko - reminderMs,
      title: `⏰ تذكير بالتوقعات · الجولة ${group.md}`,
      body: group.matches.length === 1
        ? `تبقت ساعة على ${fixtureText}، وباقي 30 دقيقة فقط على إغلاق التوقع.`
        : `تبقت ساعة على انطلاق ${group.matches.length} مباريات، وباقي 30 دقيقة فقط على إغلاق التوقعات.`,
    },
    {
      type: "lock",
      at: ko - lockMs,
      title: `🔒 أُغلق باب التوقعات · الجولة ${group.md}`,
      body: group.matches.length === 1
        ? `أُغلق التوقع لمباراة ${fixtureText}. تنطلق المباراة بعد 30 دقيقة.`
        : `أُغلق باب التوقعات لـ${group.matches.length} مباريات. تنطلق المباريات بعد 30 دقيقة.`,
    },
  ];
}

async function fetchSchedule() {
  const response = await fetch(`${SCHEDULE_URL}?v=${Math.floor(Date.now() / 300000)}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Schedule fetch failed: ${response.status}`);
  const schedule = await response.json();
  if (!Array.isArray(schedule.matches)) throw new Error("Schedule is missing matches array");
  return schedule;
}

async function processPredictionAlerts(accessToken) {
  const schedule = await fetchSchedule();
  const groups = groupSchedule(schedule.matches);
  const now = Date.now();
  let state = (await firebaseGet("uclPredictionAlerts", accessToken)) || null;

  if (!state || !state._initialized) {
    const boot = { _initialized: { at: now, scheduleVersion: schedule.season || "2026/27" } };
    for (const group of groups) {
      for (const event of buildEvents(group, schedule)) {
        if (event.at <= now) {
          boot[eventKey(group, event.type)] = { done: true, bootstrapped: true, eventAt: event.at, at: now };
        }
      }
    }
    await firebasePut("uclPredictionAlerts", boot, accessToken);
    return { action: "prediction-alerts-initialized" };
  }

  const due = [];
  for (const group of groups) {
    for (const event of buildEvents(group, schedule)) {
      const key = eventKey(group, event.type);
      if (state[key]?.done) continue;
      if (event.at <= now) due.push({ group, event, key });
    }
  }

  due.sort((a, b) => a.event.at - b.event.at);
  if (!due.length) return { action: "prediction-alerts-idle" };

  const item = due[0];
  const maxLateMs = item.event.type === "open" ? 2 * 60 * 60_000 : 45 * 60_000;
  if (now - item.event.at > maxLateMs) {
    await firebasePut(`uclPredictionAlerts/${item.key}`, {
      done: true,
      skippedLate: true,
      eventAt: item.event.at,
      checkedAt: now,
    }, accessToken);
    return { action: "prediction-alert-skipped-late", key: item.key };
  }

  const result = await broadcast(
    item.event.title,
    item.event.body,
    item.key,
    accessToken,
    {
      type: `prediction-${item.event.type}`,
      matchday: item.group.md,
      kickoff: item.group.ko,
    }
  );

  await firebasePut(`uclPredictionAlerts/${item.key}`, {
    done: true,
    eventType: item.event.type,
    eventAt: item.event.at,
    kickoff: item.group.ko,
    matchday: item.group.md,
    sentAt: Date.now(),
    ...result,
  }, accessToken);

  return { action: `prediction-${item.event.type}-sent`, key: item.key, ...result };
}

async function processRoundNewsQueue(accessToken) {
  const queue = (await firebaseGet("uclRoundNewsQueue", accessToken)) || {};
  const now = Date.now();
  const pending = Object.entries(queue)
    .filter(([, item]) => item && item.enabled !== false && !item.sent && item.title && item.body && Number(item.publishAt || 0) <= now)
    .sort((a, b) => Number(a[1].publishAt || 0) - Number(b[1].publishAt || 0));

  if (!pending.length) return { action: "round-news-idle" };

  const [id, item] = pending[0];
  const result = await broadcast(
    String(item.title).slice(0, 120),
    String(item.body).slice(0, 500),
    `news-${id}`,
    accessToken,
    { type: "round-news", newsId: id, matchday: item.matchday || "" }
  );

  await firebasePatch(`uclRoundNewsQueue/${id}`, {
    sent: true,
    sentAt: Date.now(),
    sendResult: result,
  }, accessToken);

  return { action: "round-news-sent", id, ...result };
}

async function processAll(env) {
  const accessToken = await getAccessToken(env);
  const results = [];
  results.push(await processPredictionAlerts(accessToken));
  results.push(await processRoundNewsQueue(accessToken));
  results.push(await processAnnouncements(accessToken));
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("run") === "1") {
      try {
        return json({ ok: true, debug: true, results: await processAll(env) });
      } catch (error) {
        return json({ ok: false, debug: true, error: error?.message || String(error) }, 500);
      }
    }

    return json({
      ok: true,
      service: "UCL Push Notifications v2",
      project: PROJECT_ID,
      status: "online",
      schedule: SCHEDULE_URL,
      features: [
        "admin announcements",
        "prediction opening alerts (24h)",
        "prediction reminders (1h)",
        "prediction lock alerts (30m)",
        "round news queue",
      ],
      debugUrl: "/?run=1",
      time: new Date().toISOString(),
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      processAll(env)
        .then(result => console.log("UCL worker result:", JSON.stringify(result)))
        .catch(error => console.error("UCL worker error:", error?.message || String(error)))
    );
  },
};
