const PROJECT_ID = "world-cup-2026-d3091";
const DATABASE_URL = "https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app";
const APP_URL = "https://turkik69.github.io/Champions-League/";
const APP_ICON = `${APP_URL}assets/app-icon-192.png`;
const SCHEDULE_URL = `${APP_URL}match-schedule.json`;
const GULF_SCHEDULE_URL = `${APP_URL}gulf-schedule.json`;
const MAX_DEVICES_PER_RUN = 50;
const NEWS_PRE_MINUTES = 6 * 60;
const NEWS_POST_MINUTES = 3 * 60;
const NEWS_MAX_AGE_HOURS = 72;
const NEWS_RETRY_MINUTES = 30;

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
  const targetUrl = data?.url || APP_URL;
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
            url: targetUrl,
            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          },
          webpush: {
            notification: {
              icon: APP_ICON,
              badge: APP_ICON,
              tag: String(tag),
              renotify: true,
            },
            fcm_options: { link: targetUrl },
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

function decodeXmlText(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXmlText(match[1]) : "";
}

function parseGoogleNewsRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = re.exec(xml))) {
    const title = xmlTag(match[1], "title");
    const link = xmlTag(match[1], "link");
    const pubDate = xmlTag(match[1], "pubDate");
    if (!title) continue;
    items.push({
      title: title.replace(/\s+-\s+[^-]{2,60}$/, "").trim(),
      link,
      pubDate,
      publishedAt: Date.parse(pubDate) || 0,
    });
  }
  return items;
}

async function fetchGoogleNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=OM&ceid=OM:ar`;
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 UCL-Azba-News/1.0" },
  });
  if (!response.ok) throw new Error(`Google News RSS failed: ${response.status}`);
  return parseGoogleNewsRss(await response.text());
}

function uniqueRecentNews(items, now = Date.now()) {
  const seen = new Set();
  const maxAge = NEWS_MAX_AGE_HOURS * 60 * 60_000;
  return items
    .filter(item => item && item.title && (!item.publishedAt || now - item.publishedAt <= maxAge))
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .filter(item => {
      const key = item.title.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function getAutomaticRoundNews(kind) {
  const generalQueries = kind === "pre"
    ? [
        'دوري أبطال أوروبا',
        'UEFA Champions League',
        'دوري أبطال أوروبا الجولة القادمة',
        'Champions League preview',
      ]
    : [
        'دوري أبطال أوروبا نتائج',
        'UEFA Champions League results',
        'دوري أبطال أوروبا الجولة',
        'Champions League highlights',
      ];

  const starQueries = [
    'دوري أبطال أوروبا نجوم هدافين إصابات غيابات',
    'UEFA Champions League stars injuries top scorers',
    'دوري أبطال أوروبا لاعب الجولة',
    'Champions League player of the match',
  ];

  const fetchMany = async (queries) => {
    const batches = await Promise.all(
      queries.map(q => fetchGoogleNews(q).catch(() => []))
    );
    return batches.flat();
  };

  const [general, stars] = await Promise.all([
    fetchMany(generalQueries),
    fetchMany(starQueries),
  ]);

  const generalRecent = uniqueRecentNews(general);
  const starsRecent = uniqueRecentNews(stars);
  const selected = [];

  for (const item of generalRecent.slice(0, 4)) {
    if (!selected.some(x => x.title === item.title)) selected.push(item);
    if (selected.length >= 2) break;
  }

  for (const item of starsRecent.slice(0, 4)) {
    if (!selected.some(x => x.title === item.title)) selected.push(item);
    if (selected.length >= 3) break;
  }

  if (!selected.length) {
    const fallback = [...general, ...stars]
      .filter(x => x && x.title)
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    for (const item of fallback) {
      if (!selected.some(x => x.title === item.title)) selected.push(item);
      if (selected.length >= 3) break;
    }
  }

  return selected.slice(0, 3);
}


function stripNewsHtml(value = "") {
  return decodeXmlText(value)
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBingNews(query, language = "ar") {
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const market = language === "ar" ? "ar-SA" : "en-US";
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setlang=${encodeURIComponent(locale)}&cc=OM&mkt=${encodeURIComponent(market)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 UCL-Azba-News/1.0",
      "accept": "application/rss+xml,application/xml,text/xml,*/*",
    },
  });
  if (!response.ok) throw new Error(`Bing News RSS failed: ${response.status}`);
  return parseGoogleNewsRss(await response.text()).map(x => ({ ...x, source: "Bing News" }));
}

function extractUefaNewsFromHtml(html) {
  const items = [];
  const seen = new Set();
  const push = (title, link = "https://www.uefa.com/uefachampionsleague/") => {
    title = stripNewsHtml(title);
    if (!title || title.length < 12 || title.length > 180) return;
    const low = title.toLowerCase();
    if (seen.has(low)) return;
    if (/^(news|latest news|view all|highlights|matches|table|teams)$/i.test(title)) return;
    seen.add(low);
    items.push({ title, link, publishedAt: Date.now(), source: "UEFA" });
  };

  const linkRe = /<a[^>]+href=["']([^"']*\/uefachampionsleague\/(?:news\/)?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const href = m[1].startsWith('http') ? m[1] : `https://www.uefa.com${m[1]}`;
    push(m[2], href);
    if (items.length >= 20) break;
  }

  if (items.length < 3) {
    const titleRe = /"(?:headline|title|name)"\s*:\s*"([^"\\]{12,180})"/g;
    while ((m = titleRe.exec(html))) {
      const title = m[1]
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\\//g, "/");
      if (/champions|matchday|goal|scorer|player|round|highlight|league|ucl|final|arsenal|barcelona|madrid|bayern|paris|liverpool|city|united/i.test(title)) {
        push(title);
      }
      if (items.length >= 20) break;
    }
  }

  return items;
}

async function fetchUefaNews() {
  const urls = [
    "https://www.uefa.com/uefachampionsleague/",
    "https://www.uefa.com/uefachampionsleague/news/",
  ];
  const batches = await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 UCL-Azba-News/1.0",
          "accept-language": "en-GB,en;q=0.9",
        },
      });
      if (!response.ok) return [];
      return extractUefaNewsFromHtml(await response.text());
    } catch {
      return [];
    }
  }));
  return batches.flat();
}

function isArabicHeadline(title = "") {
  const arabic = (title.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (title.match(/[A-Za-z\u0600-\u06FF]/g) || []).length || 1;
  return arabic / letters >= 0.35;
}

function trustedNewsSource(item) {
  const haystack = `${item?.link || ""} ${item?.source || ""}`.toLowerCase();
  if (haystack.includes('uefa.com') || haystack.includes('uefa')) return 50;
  if (/reuters|apnews|bbc|espn|skysports|theathletic|nbcsports|goal\.com|bein|kooora|yallakora/.test(haystack)) return 25;
  return 5;
}

function cleanHeadline(title = "") {
  return String(title)
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, "")
    .replace(/^فيديو\s*[:|\-–—]*\s*/i, "")
    .replace(/^شاهد\s*[:|\-–—]*\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFreshNews(item, kind) {
  if (!item?.publishedAt) return item?.source === 'UEFA';
  const age = Date.now() - Number(item.publishedAt);
  if (age < -6 * 60 * 60_000) return false;
  const maxAge = (kind === 'post' ? 96 : 120) * 60 * 60_000;
  return age <= maxAge;
}

function isRelevantRoundNews(item, kind) {
  const title = cleanHeadline(item?.title || "");
  const low = title.toLowerCase();
  if (!title) return false;

  const obviousNoise = /تذاكر|أسعار التذاكر|شراء التذاكر|جدول ترتيب|ترتيب الدوري|موعد القرعة|القنوات الناقلة|بث مباشر|كيفية المشاهدة|ticket price|tickets?\b|standings|table after|how to watch|live stream/i;
  if (obviousNoise.test(low)) return false;

  const ucl = /champions league|uefa|دوري أبطال أوروبا|دوري الابطال|دوري الأبطال/i.test(low);
  const postSignal = /نتيج|ملخص|فوز|خسار|تعادل|هدف|هداف|نجم|تألق|لاعب الجولة|رجل المباراة|result|highlight|recap|win|goal|scor|player of the match/i.test(low);
  const preSignal = /غياب|إصاب|تشكيل|استعداد|قبل المباراة|قبل الجولة|مواجهة|قائمة|preview|team news|injur|lineup|squad/i.test(low);

  return ucl || (kind === 'post' ? postSignal : preSignal);
}

function newsRelevanceScore(item, kind) {
  const title = cleanHeadline(item?.title || "");
  const low = title.toLowerCase();
  let score = 0;

  if (isArabicHeadline(title)) score += 70;
  score += trustedNewsSource(item);
  if (/champions league|uefa|دوري أبطال أوروبا|دوري الابطال|دوري الأبطال/.test(low)) score += 25;

  if (kind === 'post' && /نتيج|ملخص|فوز|خسار|تعادل|هدف|هداف|نجم|تألق|لاعب الجولة|رجل المباراة|result|highlight|recap|win|goal|scor|player of the match/.test(low)) score += 30;
  if (kind === 'pre' && /غياب|إصاب|تشكيل|استعداد|قبل المباراة|قبل الجولة|مواجهة|قائمة|preview|team news|injur|lineup|squad/.test(low)) score += 30;

  if (item?.publishedAt) {
    const ageHours = Math.max(0, Date.now() - Number(item.publishedAt)) / 3600000;
    score += Math.max(0, 30 - Math.floor(ageHours / 4));
  }

  return score;
}

function normalizeNewsTitle(title = "") {
  return String(title)
    .replace(/^فيديو\s*[|:\-–—]?\s*/i, "")
    .replace(/^شاهد\s*[|:\-–—]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWrongStage(title = "", context = null) {
  const low = String(title).toLowerCase();
  const md = Number(context?.matchday || 0);
  // League phase rounds are MD1–MD8. Reject knockout-stage recycled clips/articles.
  if (md >= 1 && md <= 8) {
    return /\bqf\b|quarter[- ]?final|ربع النهائي|ربع نهائي|\bsf\b|semi[- ]?final|نصف النهائي|نصف نهائي|round of 16|دور الـ?16|دور 16|2nd leg|second leg|الإياب|اياب/.test(low);
  }
  return false;
}

function isStrictlyFresh(item, maxHours = 72) {
  if (!item?.publishedAt) return false;
  const age = Date.now() - Number(item.publishedAt);
  return age >= -6 * 60 * 60_000 && age <= maxHours * 60 * 60_000;
}

function isUsefulRoundHeadline(item, kind, context = null) {
  if (!item?.title) return false;
  const title = normalizeNewsTitle(item.title);
  const low = title.toLowerCase();
  if (!title || title.length < 12) return false;
  if (!isStrictlyFresh(item, NEWS_MAX_AGE_HOURS)) return false;
  if (hasWrongStage(title, context)) return false;

  if (/ticket|tickets|price|prices|how to watch|where to watch|live stream|جدول الترتيب|ترتيب دوري|تذاكر|أسعار التذاكر|اسعار التذاكر|موعد بيع|البث المباشر|القنوات الناقلة/.test(low)) return false;

  const competition = /champions league|دوري أبطال أوروبا|دوري الابطال|دوري الأبطال|uefa/.test(low);
  if (!competition) return false;

  if (kind === 'post') {
    return /result|highlight|recap|win|wins|goal|goals|scor|player of the match|نتيج|ملخص|فوز|انتصار|هدف|أهداف|اهداف|هداف|نجم|تألق|لاعب المباراة/.test(low);
  }
  return /preview|team news|injur|lineup|squad|غياب|إصاب|اصاب|تشكيل|استعداد|جاهزية|قبل الجولة|قبل المباراة|أخبار الجولة|اخبار الجولة/.test(low);
}

async function getAutomaticRoundNewsV4(kind, context = null) {
  const google = await getAutomaticRoundNews(kind).catch(() => []);

  const roundHint = context?.matchday ? ` الجولة ${context.matchday}` : "";
  const arabicQueries = kind === "pre"
    ? [
        `دوري أبطال أوروبا${roundHint} أخبار الجولة القادمة`,
        `دوري أبطال أوروبا${roundHint} الغيابات الإصابات التشكيل`,
        `دوري أبطال أوروبا${roundHint} أبرز النجوم قبل الجولة`,
      ]
    : [
        `دوري أبطال أوروبا${roundHint} نتائج الجولة`,
        `دوري أبطال أوروبا${roundHint} ملخص الجولة أبرز النجوم`,
        `دوري أبطال أوروبا${roundHint} الهدافين لاعب الجولة`,
      ];

  const englishQueries = kind === "pre"
    ? ["UEFA Champions League league phase preview", "Champions League team news injuries league phase"]
    : ["UEFA Champions League league phase results highlights", "Champions League player of the match top scorers league phase"];

  const [arabicBing, englishBing, uefa] = await Promise.all([
    Promise.all(arabicQueries.map(q => fetchBingNews(q, "ar").catch(() => []))),
    Promise.all(englishQueries.map(q => fetchBingNews(q, "en").catch(() => []))),
    fetchUefaNews().catch(() => []),
  ]);

  const pool = [...google, ...arabicBing.flat(), ...uefa, ...englishBing.flat()];
  const seen = new Set();
  const unique = [];

  for (const raw of pool) {
    if (!raw?.title) continue;
    const item = { ...raw, title: normalizeNewsTitle(raw.title) };
    if (!isUsefulRoundHeadline(item, kind, context)) continue;
    const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    const inferredSource = /uefa\.com/i.test(item.link || "") ? "UEFA" : (item.source || "News");
    unique.push({ ...item, source: inferredSource });
  }

  unique.sort((a, b) => newsRelevanceScore(b, kind) - newsRelevanceScore(a, kind));

  const arabic = unique.filter(x => isArabicHeadline(x.title));
  const trusted = unique.filter(x => trustedNewsSource(x) >= 25);
  const picked = [];
  const add = item => {
    if (!item || picked.some(x => x.title === item.title)) return;
    picked.push(item);
  };

  arabic.slice(0, 2).forEach(add);
  trusted.slice(0, 2).forEach(add);
  unique.forEach(item => { if (picked.length < 3) add(item); });
  return picked.slice(0, 3);
}

function roundWindows(matches) {
  const rounds = new Map();
  for (const m of matches) {
    const t = new Date(m.ko).getTime();
    if (!Number.isFinite(t)) continue;
    if (!rounds.has(m.md)) rounds.set(m.md, { md: m.md, first: t, last: t });
    const r = rounds.get(m.md);
    r.first = Math.min(r.first, t);
    r.last = Math.max(r.last, t);
  }
  return [...rounds.values()].sort((a, b) => a.md - b.md);
}

function roundNewsKey(md, kind) {
  return `md${md}_${kind}`;
}

function buildRoundNewsText(md, kind, items) {
  const cleaned = items.map(item => cleanHeadline(item.title)).filter(Boolean);
  const fullBody = cleaned.join(" • ");
  return {
    title: kind === "pre" ? `أخبار الجولة ${md}` : `حصاد الجولة ${md}`,
    body: fullBody.slice(0, 500),
  };
}

async function processAutomaticRoundNews(accessToken) {
  const schedule = await fetchSchedule();
  const rounds = roundWindows(schedule.matches);
  const now = Date.now();
  let state = (await firebaseGet("uclAutoRoundNews", accessToken)) || {};

  if (!state._initialized) {
    const boot = { _initialized: { at: now, season: schedule.season || "2026/27" } };
    for (const round of rounds) {
      if (round.last + NEWS_POST_MINUTES * 60_000 < now) {
        boot[roundNewsKey(round.md, "pre")] = { done: true, bootstrapped: true, at: now };
        boot[roundNewsKey(round.md, "post")] = { done: true, bootstrapped: true, at: now };
      }
    }
    await firebasePatch("uclAutoRoundNews", boot, accessToken);
    state = { ...state, ...boot };
  }

  const due = [];
  for (const round of rounds) {
    const events = [
      { kind: "pre", at: round.first - NEWS_PRE_MINUTES * 60_000, deadline: round.first },
      { kind: "post", at: round.last + NEWS_POST_MINUTES * 60_000, deadline: round.last + 12 * 60 * 60_000 },
    ];
    for (const event of events) {
      const key = roundNewsKey(round.md, event.kind);
      const saved = state[key];
      if (saved?.done) continue;
      if (saved?.lastAttemptAt && now - saved.lastAttemptAt < NEWS_RETRY_MINUTES * 60_000) continue;
      if (event.at <= now && now <= event.deadline) due.push({ round, event, key });
      if (now > event.deadline && !saved?.done) {
        await firebasePut(`uclAutoRoundNews/${key}`, {
          done: true,
          skippedLate: true,
          eventAt: event.at,
          checkedAt: now,
        }, accessToken);
      }
    }
  }

  due.sort((a, b) => a.event.at - b.event.at);
  if (!due.length) return { action: "auto-round-news-idle" };

  const item = due[0];
  await firebasePatch(`uclAutoRoundNews/${item.key}`, { lastAttemptAt: now }, accessToken);
  const news = await getAutomaticRoundNewsV4(item.event.kind, { matchday: item.round.md });
  if (!news.length) return { action: "auto-round-news-no-headlines", key: item.key };

  const text = buildRoundNewsText(item.round.md, item.event.kind, news);
  const result = await broadcast(
    text.title,
    text.body,
    `auto-news-${item.key}`,
    accessToken,
    { type: `auto-round-news-${item.event.kind}`, matchday: item.round.md }
  );

  const archive = {
    kind: item.event.kind,
    matchday: item.round.md,
    title: text.title,
    body: text.body,
    headlines: news.map(n => ({ title: n.title, link: n.link, publishedAt: n.publishedAt })),
    sentAt: Date.now(),
    sendResult: result,
  };
  await firebasePut(`uclRoundNewsArchive/${item.key}`, archive, accessToken);
  await firebasePut(`uclAutoRoundNews/${item.key}`, {
    done: true,
    eventAt: item.event.at,
    sentAt: Date.now(),
    headlineCount: news.length,
    ...result,
  }, accessToken);

  return { action: `auto-round-news-${item.event.kind}-sent`, key: item.key, headlineCount: news.length, ...result };
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


async function fetchGulfSchedule() {
  const response = await fetch(`${GULF_SCHEDULE_URL}?v=${Math.floor(Date.now() / 300000)}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Gulf schedule fetch failed: ${response.status}`);
  const schedule = await response.json();
  if (!Array.isArray(schedule.matches)) throw new Error("Gulf schedule is missing matches array");
  return schedule;
}

function gulfStageLabel(group) {
  const first = group.matches[0] || {};
  if (first.stage === "semifinal") return "نصف النهائي";
  if (first.stage === "final") return "النهائي";
  return `الجولة ${group.md}`;
}

function buildGulfEvents(group, config) {
  const ko = new Date(group.ko).getTime();
  const openMs = (config.predictionOpenMinutesBeforeKickoff || 1440) * 60_000;
  const reminderMs = (config.reminderMinutesBeforeKickoff || 60) * 60_000;
  const lockMs = (config.predictionLockMinutesBeforeKickoff || 30) * 60_000;
  const fixtureText = compactFixtureText(group);
  const stage = gulfStageLabel(group);
  return [
    { type:"open", at:ko-openMs, title:`🏆 خليجي 27 · فُتحت التوقعات`, body:`${stage}: ${fixtureText}. يمكنك التوقع الآن، ويُغلق الباب قبل المباراة بـ30 دقيقة.` },
    { type:"reminder", at:ko-reminderMs, title:`⏰ خليجي 27 · تذكير بالتوقع`, body:`تبقت ساعة على ${fixtureText}. بقيت 30 دقيقة فقط على إغلاق التوقع.` },
    { type:"lock", at:ko-lockMs, title:`🔒 خليجي 27 · أُغلق التوقع`, body:`أُغلق التوقع لـ ${fixtureText}. تنطلق المباراة بعد 30 دقيقة.` },
  ];
}

function gulfEventKey(group, type) {
  return `g27_md${group.md}_${group.ko.replace(/[^0-9]/g, "")}_${type}`;
}

async function processGulfPredictionAlerts(accessToken) {
  const schedule = await fetchGulfSchedule();
  const eligible = schedule.matches.filter(m => m.predictable !== false && m.home && m.away);
  const groups = groupSchedule(eligible);
  const now = Date.now();
  let state = (await firebaseGet("gulfCup27PushAlerts", accessToken)) || null;

  if (!state || !state._initialized) {
    const boot = { _initialized: { at: now, season: schedule.season || "2026" } };
    for (const group of groups) {
      for (const event of buildGulfEvents(group, schedule)) {
        if (event.at <= now) boot[gulfEventKey(group,event.type)] = { done:true, bootstrapped:true, eventAt:event.at, at:now };
      }
    }
    await firebasePut("gulfCup27PushAlerts", boot, accessToken);
    return { action:"gulf-alerts-initialized" };
  }

  const due=[];
  for (const group of groups) {
    for (const event of buildGulfEvents(group, schedule)) {
      const key=gulfEventKey(group,event.type);
      if (state[key]?.done) continue;
      if (event.at<=now) due.push({group,event,key});
    }
  }
  due.sort((a,b)=>a.event.at-b.event.at);
  if (!due.length) return { action:"gulf-alerts-idle" };
  const item=due[0];
  const maxLateMs=item.event.type==="open"?2*60*60_000:45*60_000;
  if (now-item.event.at>maxLateMs) {
    await firebasePut(`gulfCup27PushAlerts/${item.key}`,{done:true,skippedLate:true,eventAt:item.event.at,checkedAt:now},accessToken);
    return {action:"gulf-alert-skipped-late",key:item.key};
  }
  // Idempotency guard: claim the alert BEFORE sending so a later error cannot resend it every minute.
  await firebasePut(`gulfCup27PushAlerts/${item.key}`,{
    done:true,
    claimed:true,
    eventType:item.event.type,
    eventAt:item.event.at,
    kickoff:item.group.ko,
    matchday:item.group.md,
    claimedAt:Date.now()
  },accessToken);

  const result=await broadcast(item.event.title,item.event.body,item.key,accessToken,{
    type:`gulf-prediction-${item.event.type}`,
    matchday:item.group.md,
    kickoff:item.group.ko,
    competition:"Gulf Cup 27",
    url:`${APP_URL}#gulf27`,
  });

  await firebasePatch(`gulfCup27PushAlerts/${item.key}`,{
    sentAt:Date.now(),
    successful:result.successful||0,
    failed:result.failed||0,
    totalDevices:result.totalDevices||0
  },accessToken).catch(()=>{});

  return {action:`gulf-prediction-${item.event.type}-sent`,key:item.key,...result};
}

function isGulfNews(item) {
  const title=cleanHeadline(item?.title||"");
  if (!title || title.length<10) return false;
  if (!isStrictlyFresh(item,NEWS_MAX_AGE_HOURS)) return false;
  const low=title.toLowerCase();
  return /خليجي\s*27|كأس الخليج|كاس الخليج|gulf cup|arabian gulf cup|منتخب عمان|منتخب عُمان|المنتخب السعودي|منتخب السعودية|منتخب العراق|منتخب الكويت|منتخب قطر|منتخب البحرين|منتخب الإمارات|منتخب اليمن/.test(low);
}

async function fetchGulfNewsItems() {
  const queries=[
    "خليجي 27 جدة كأس الخليج",
    "كأس الخليج 27 السعودية عمان العراق الكويت قطر الإمارات البحرين اليمن",
    "Gulf Cup 27 Jeddah 2026",
  ];
  const batches=await Promise.all(queries.map((q,i)=>fetchBingNews(q,i===2?"en":"ar").catch(()=>[])));
  const seen=new Set(), items=[];
  for (const raw of batches.flat()) {
    if (!isGulfNews(raw)) continue;
    const title=cleanHeadline(raw.title);
    const key=title.toLowerCase().replace(/\s+/g," ");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({...raw,title});
  }
  items.sort((a,b)=>(b.publishedAt||0)-(a.publishedAt||0));
  return items.slice(0,8);
}

function isOmanTeamNews(item) {
  const title=cleanHeadline(item?.title||"");
  return /منتخب\s*(عُمان|عمان)|المنتخب\s*العُماني|المنتخب\s*العماني|\bOman\b/i.test(title);
}

async function processGulfNews(accessToken) {
  const items=await fetchGulfNewsItems();
  if (!items.length) return {action:"gulf-news-idle",count:0};

  // Keep the Gulf Cup news page rich, but restrict push notifications to Oman team news only.
  await firebasePut("gulfCup27News/latest",items,accessToken);

  const omanItems=items.filter(isOmanTeamNews);
  if (!omanItems.length) {
    return {action:"gulf-news-refreshed",count:items.length,omanCount:0,notification:"oman-only-no-match"};
  }

  const state=(await firebaseGet("gulfCup27NewsState",accessToken))||{};
  const top=omanItems[0];
  const fingerprint=base64Url(new TextEncoder().encode(top.title)).slice(0,28);
  if (state.lastFingerprint===fingerprint) {
    return {action:"gulf-news-refreshed",count:items.length,omanCount:omanItems.length,notification:"unchanged"};
  }

  // Reduce noise: at most one Gulf Cup news notification every 12 hours.
  const lastSent=Number(state.lastSentAt||0);
  if (Date.now()-lastSent<12*60*60_000) {
    return {action:"gulf-news-refreshed",count:items.length,omanCount:omanItems.length,notification:"rate-limited-12h"};
  }

  // Reserve the headline BEFORE sending. This prevents duplicate notifications if any later step fails.
  const reservedAt=Date.now();
  await firebasePut("gulfCup27NewsState",{
    lastFingerprint:fingerprint,
    lastSentAt:reservedAt,
    title:top.title,
    scope:"oman-only",
    claimed:true
  },accessToken);

  const result=await broadcast("🇴🇲 أخبار منتخب عُمان",top.title.slice(0,480),`gulf-oman-news-${fingerprint}`,accessToken,{
    type:"gulf-oman-news",
    competition:"Gulf Cup 27",
    url:`${APP_URL}#gulf27`,
  });

  await firebasePatch("gulfCup27NewsState",{
    sentAt:Date.now(),
    successful:result.successful||0,
    failed:result.failed||0,
    totalDevices:result.totalDevices||0
  },accessToken).catch(()=>{});

  return {action:"gulf-oman-news-sent",count:items.length,omanCount:omanItems.length,...result};
}


// Automatically import confirmed Gulf Cup full-time results; never infer scores from a clock.
function gulfTeamCode(name) {
  const n=String(name||"").toLowerCase().normalize("NFKD").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[^a-z\u0621-\u064a ]/g," ").replace(/\s+/g," ").trim();
  const names=[
    ["IRQ",/\biraq\b|العراق/],
    ["OMA",/\boman\b|عمان/],
    ["KSA",/saudi|السعود/],
    ["KUW",/kuwait|الكويت/],
    ["UAE",/emirates|الامارات/],
    ["QAT",/\bqatar\b|قطر/],
    ["BHR",/bahrain|البحرين/],
    ["YEM",/yemen|اليمن/],
  ];
  return names.find(([,re])=>re.test(n))?.[0]||null;
}

function gulfResultMatch(fixture, home, away, date) {
  if (gulfTeamCode(fixture.home)!==gulfTeamCode(home) ||
      gulfTeamCode(fixture.away)!==gulfTeamCode(away)) return false;
  const actual=Date.parse(fixture.ko||"");
  const expected=Date.parse(date||"");
  return Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<3*60*60_000;
}

async function gulfJson(url) {
  const r=await fetch(url,{headers:{"accept":"application/json","user-agent":"Mozilla/5.0 GulfCupScoreSync/1.0"},signal:AbortSignal.timeout(7500)});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return await r.json();
}

async function gulfESPNFinals(dates) {
  const out=[];
  for(const date of dates) {
    try {
      const json=await gulfJson("https://site.api.espn.com/apis/site/v2/sports/soccer/global.gulf_cup/scoreboard?dates="+date);
      for(const e of json.events||[]) {
        const comp=e.competitions?.[0];
        const status=e.status?.type||comp?.status?.type||{};
        if(status.completed!==true && !/STATUS_FINAL|STATUS_FULL_TIME|FINAL/i.test(status.name||"")) continue;
        const home=comp?.competitors?.find(x=>x.homeAway==="home");
        const away=comp?.competitors?.find(x=>x.homeAway==="away");
        if(!home||!away||home.score==null||away.score==null) continue;
        const h=Number(home.score),a=Number(away.score);
        if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0) continue;
        out.push({
          home:home.team?.displayName||home.team?.name,
          away:away.team?.displayName||away.team?.name,
          ko:e.date||comp.date,h,a,source:"ESPN"
        });
      }
    } catch(error) {console.log("Gulf ESPN unavailable:",String(error));}
  }
  return out;
}

async function gulfSofascoreFinals() {
  try {
    // Season IDs are obtained dynamically so the importer cannot accidentally use 2024 results.
    const sofaBase=await (async()=>{
      for(const base of ["https://www.sofascore.com/api/v1","https://api.sofascore.com/api/v1"]){
        try {return {base,seasons:await gulfJson(base+"/unique-tournament/622/seasons")};}
        catch(e){console.log("Sofascore host unavailable:",base,String(e));}
      }
      throw new Error("Both Sofascore hosts unavailable");
    })();
    const seasons=sofaBase.seasons;
    const season=(seasons.seasons||[]).find(s=>String(s.year||s.name||"").includes("2026"));
    if(!season?.id) return [];
    const pages=await Promise.allSettled([0,1].map(page=>
      gulfJson(sofaBase.base+"/unique-tournament/622/season/"+season.id+"/events/last/"+page)));
    const out=[];
    for(const page of pages) {
      if(page.status!=="fulfilled") continue;
      for(const e of page.value.events||[]) {
        if(e.tournament?.uniqueTournament?.id && Number(e.tournament.uniqueTournament.id)!==622) continue;
        if(e.status?.type!=="finished" && e.status?.code!==100) continue;
        const h=e.homeScore?.current,a=e.awayScore?.current;
        if(!Number.isInteger(h)||!Number.isInteger(a)) continue;
        out.push({
          home:e.homeTeam?.name,away:e.awayTeam?.name,
          ko:new Date(e.startTimestamp*1000).toISOString(),h,a,source:"Sofascore"
        });
      }
    }
    return out;
  }catch(error) {
    console.log("Gulf Sofascore unavailable:",String(error));
    return [];
  }
}

async function processGulfResults(accessToken) {
  const now=Date.now();
  const existing=(await firebaseGet("gulfCup27Results",accessToken))||{};

  // Verified historical fallback for the opening match, published on 23 Sep 2026:
  // https://timesofoman.com/article/177302-al-rawahi-nets-equaliser-as-oman-hold-iraq-in-gulf-cup-opener
  // This is NOT an estimate from elapsed time. Preserve any already-recorded score.
  if(!existing.g27_a1 && now>Date.parse("2026-09-23T19:30:00+04:00")){
    const opening={h:1,a:1,source:"Times of Oman",
      sourceUrl:"https://timesofoman.com/article/177302-al-rawahi-nets-equaliser-as-oman-hold-iraq-in-gulf-cup-opener",
      verifiedFinal:true,updatedAt:now};
    await firebasePut("gulfCup27Results/g27_a1",opening,accessToken);
    return {action:"gulf-results-updated",pending:1,
      saved:[{id:"g27_a1",h:1,a:1,source:"Times of Oman"}]};
  }

  const sync=(await firebaseGet("gulfCup27ResultsSync",accessToken))||{};
  if(now-Number(sync.lastCheckAt||0)<5*60_000) {
    return {action:"gulf-results-rate-limited",
      nextCheckAt:Number(sync.lastCheckAt)+5*60_000,
      lastAction:sync.action||null,
      lastSaved:sync.saved||[],
      previousSources:{espnFinals:sync.espnFinals??null,sofaFinals:sync.sofaFinals??null}};
  }

  const schedule=await fetchGulfSchedule();
  const pending=schedule.matches.filter(m=>{
    const ko=Date.parse(m.ko||"");
    return !existing[m.id] && m.predictable!==false &&
      Number.isFinite(ko) && now>=ko+90*60_000 && now-ko<4*24*60*60_000;
  });
  if(!pending.length) return {action:"gulf-results-idle",pending:0};

  // Mark the attempt early: an upstream outage should not trigger a fresh API scrape every minute.
  await firebasePut("gulfCup27ResultsSync",{
    lastCheckAt:now,pending:pending.map(m=>m.id),action:"checking"
  },accessToken);

  const dates=[...new Set(pending.map(m=>new Date(m.ko).toISOString().slice(0,10).replace(/-/g,"")))];
  const [espn,sofa]=await Promise.all([gulfESPNFinals(dates),gulfSofascoreFinals()]);
  const finals=[...espn,...sofa];
  const saved=[];
  for(const m of pending) {
    const fixture=finals.find(x=>gulfResultMatch(x,m.home,m.away,m.ko));
    if(!fixture) continue;
    const result={h:fixture.h,a:fixture.a,source:fixture.source,verifiedFinal:true,updatedAt:now};
    await firebasePut("gulfCup27Results/"+m.id,result,accessToken);
    saved.push({id:m.id,h:result.h,a:result.a,source:result.source});
  }
  await firebasePut("gulfCup27ResultsSync",{
    lastCheckAt:now,
    checkedAt:now,
    pending:pending.map(m=>m.id),
    espnFinals:espn.length,
    sofaFinals:sofa.length,
    saved,
    action:saved.length?"updated":"awaiting-confirmed-final"
  },accessToken);
  return {action:saved.length?"gulf-results-updated":"gulf-results-awaiting-confirmation",
    pending:pending.length,espnFinals:espn.length,sofaFinals:sofa.length,saved};
}


const UCL_TEAM_SLUGS={
  "أ.إي.ك أثينا": "aek-athens",
  "لاسك لينز": "lask",
  "كلوب بروج": "club-brugge",
  "أستون فيلا": "aston-villa",
  "بوروسيا دورتموند": "borussia-dortmund",
  "فياريال": "villarreal",
  "بورتو": "porto",
  "مانشستر سيتي": "manchester-city",
  "ليل": "lille",
  "ريال بيتيس": "real-betis",
  "ريال مدريد": "real-madrid",
  "إنتر ميلان": "inter",
  "برشلونة": "barcelona",
  "فينورد": "feyenoord",
  "شتوتغارت": "stuttgart",
  "فايكينغ": "viking-fk",
  "ليفربول": "liverpool",
  "أتلتيكو مدريد": "atletico-madrid",
  "باريس سان جيرمان": "paris-saint-germain",
  "سلوفان براتيسلافا": "slovan-bratislava",
  "سبورتينغ لشبونة": "sporting-cp",
  "غلطة سراي": "galatasaray",
  "نابولي": "napoli",
  "أرسنال": "arsenal",
  "فنربخشة": "fenerbahce",
  "روما": "roma",
  "بي إس في آيندهوفن": "psv-eindhoven",
  "شاختار دونيتسك": "shakhtar-donetsk",
  "كومو": "como-1907",
  "لايبزيغ": "rb-leipzig",
  "بايرن ميونخ": "bayern-munich",
  "بودو غليمت": "bodo-glimt",
  "مانشستر يونايتد": "manchester-united",
  "سابح": "kf-sabail",
  "سلافيا براغ": "slavia-prague",
  "لانس": "rc-lens"
};
const UCL_ALIASES={
  "aek-athens":["aek-athens","aek-athina","aek-athens-fc","aek"],
  "lask":["lask","lask-linz"],
  "club-brugge":["club-brugge","club-brugge-kv","brugge"],
  "aston-villa":["aston-villa","aston-villa-fc"],
  "borussia-dortmund":["borussia-dortmund","dortmund"],
  "villarreal":["villarreal","villarreal-cf"],
  "porto":["porto","fc-porto"],
  "manchester-city":["manchester-city","man-city"],
  "lille":["lille","lille-osc"],
  "real-betis":["real-betis","real-betis-balompie","betis"],
  "real-madrid":["real-madrid","real-madrid-cf"],
  "inter":["inter","inter-milan","internazionale","fc-internazionale-milano"],
  "barcelona":["barcelona","fc-barcelona"],
  "feyenoord":["feyenoord","feyenoord-rotterdam"],
  "stuttgart":["stuttgart","vfb-stuttgart"],
  "viking-fk":["viking-fk","viking"],
  "liverpool":["liverpool","liverpool-fc"],
  "atletico-madrid":["atletico-madrid","atletico-de-madrid","atletico"],
  "paris-saint-germain":["paris-saint-germain","paris-sg","psg"],
  "slovan-bratislava":["slovan-bratislava","sk-slovan-bratislava"],
  "sporting-cp":["sporting-cp","sporting-lisbon","sporting-clube-de-portugal"],
  "galatasaray":["galatasaray","galatasaray-sk"],
  "napoli":["napoli","ssc-napoli"],
  "arsenal":["arsenal","arsenal-fc"],
  "fenerbahce":["fenerbahce","fenerbahce-sk"],
  "roma":["roma","as-roma"],
  "psv-eindhoven":["psv-eindhoven","psv"],
  "shakhtar-donetsk":["shakhtar-donetsk","shakhtar"],
  "como-1907":["como-1907","como"],
  "rb-leipzig":["rb-leipzig","rasenballsport-leipzig","leipzig"],
  "bayern-munich":["bayern-munich","bayern-munchen","fc-bayern-munchen","bayern"],
  "bodo-glimt":["bodo-glimt","fk-bodo-glimt"],
  "manchester-united":["manchester-united","man-united","man-utd"],
  "kf-sabail":["kf-sabail","sabail"],
  "slavia-prague":["slavia-prague","slavia-praha","sk-slavia-prague"],
  "rc-lens":["rc-lens","lens"]
};
function uclSlug(value){
  return String(value||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")
    .replace(/^fc-|^cf-/g,"").replace(/-fc$|-cf$/g,"");
}
function uclTeamMatches(arabicName,providerName){
  const slug=UCL_TEAM_SLUGS[arabicName];
  const provider=uclSlug(providerName);
  if(!slug||!provider) return false;
  const aliases=UCL_ALIASES[slug]||[slug];
  return aliases.some(alias=>uclSlug(alias)===provider);
}
function uclFixtureMatches(match,final){
  if(!uclTeamMatches(match.home,final.home)||!uclTeamMatches(match.away,final.away))return false;
  const expected=Date.parse(match.ko||""),actual=Date.parse(final.ko||"");
  return Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(expected-actual)<=4*3600_000;
}
async function fetchUclEspnFinals(dates){
  const out=[];
  for(const date of dates){
    try{
      const data=await gulfJson("https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates="+date);
      for(const event of data.events||[]){
        const comp=event.competitions?.[0],status=event.status?.type||comp?.status?.type||{};
        if(status.completed!==true&&!/STATUS_FINAL|STATUS_FULL_TIME/i.test(status.name||""))continue;
        const home=comp?.competitors?.find(t=>t.homeAway==="home"),away=comp?.competitors?.find(t=>t.homeAway==="away");
        if(!home||!away)continue;
        const h=Number(home.score),a=Number(away.score);
        if(home.score==null||away.score==null||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0)continue;
        out.push({home:home.team?.displayName||home.team?.name,
          away:away.team?.displayName||away.team?.name,
          ko:event.date||comp.date,h,a,source:"ESPN"});
      }
    }catch(error){console.log("UCL ESPN score source unavailable:",String(error));}
  }
  return out;
}
async function fetchUclSofaFinals(){
  try{
    const tournamentId=7;
    let base,seasons;
    for(const host of ["https://www.sofascore.com/api/v1","https://api.sofascore.com/api/v1"]){
      try{seasons=await gulfJson(host+"/unique-tournament/"+tournamentId+"/seasons");base=host;break;}
      catch(error){console.log("UCL Sofascore host unavailable:",String(error));}
    }
    if(!base)return [];
    const season=(seasons.seasons||[]).find(s=>String(s.year||s.name||"").includes("2026"));
    if(!season?.id)return [];
    const pages=await Promise.allSettled([0,1,2].map(i=>
      gulfJson(base+"/unique-tournament/"+tournamentId+"/season/"+season.id+"/events/last/"+i)));
    const out=[];
    for(const page of pages){
      if(page.status!=="fulfilled")continue;
      for(const e of page.value.events||[]){
        if(e.tournament?.uniqueTournament?.id&&Number(e.tournament.uniqueTournament.id)!==tournamentId)continue;
        if(e.status?.type!=="finished"&&e.status?.code!==100)continue;
        const h=e.homeScore?.current,a=e.awayScore?.current;
        if(!Number.isInteger(h)||!Number.isInteger(a)||!Number.isFinite(e.startTimestamp))continue;
        out.push({home:e.homeTeam?.name,away:e.awayTeam?.name,
          ko:new Date(e.startTimestamp*1000).toISOString(),h,a,source:"Sofascore"});
      }
    }
    return out;
  }catch(error){console.log("UCL Sofascore score source unavailable:",String(error));return [];}
}
async function processUclResults(accessToken){
  const now=Date.now();
  const sync=(await firebaseGet("uclResultsSync",accessToken))||{};
  if(now-Number(sync.lastCheckAt||0)<5*60_000){
    return {action:"ucl-results-rate-limited",nextCheckAt:Number(sync.lastCheckAt)+5*60_000,
      lastAction:sync.action||null,lastSaved:sync.saved||[],lastSources:sync.sources||null};
  }
  const schedule=await fetchSchedule();
  const existing=(await firebaseGet("uclResults",accessToken))||{};
  // Do not replace administrator results. Only import verifiable, completed and correctly matched fixtures.
  const pending=schedule.matches.filter(m=>{
    const ko=Date.parse(m.ko||"");
    return !existing[m.id]&&Number.isFinite(ko)&&now>=ko+105*60_000
      &&now-ko<5*24*60*60_000;
  });
  if(!pending.length)return {action:"ucl-results-idle",pending:0};
  await firebasePut("uclResultsSync",{lastCheckAt:now,action:"checking",pending:pending.map(m=>m.id)},accessToken);

  const dates=[...new Set(pending.flatMap(m=>{
    const t=Date.parse(m.ko);
    return [-1,0,1].map(offset=>new Date(t+offset*86400_000).toISOString().slice(0,10).replace(/-/g,""));
  }))];
  const [espn,sofa]=await Promise.all([fetchUclEspnFinals(dates),fetchUclSofaFinals()]);
  const finals=[...espn,...sofa],saved=[];
  for(const match of pending){
    const fixture=finals.find(f=>uclFixtureMatches(match,f));
    if(!fixture)continue;
    const result={h:fixture.h,a:fixture.a,source:fixture.source,
      verifiedFinal:true,updatedAt:Date.now()};
    await firebasePut("uclResults/"+match.id,result,accessToken);
    saved.push({id:match.id,home:match.home,away:match.away,h:result.h,a:result.a,source:fixture.source});
  }
  const state={lastCheckAt:now,action:saved.length?"updated":"awaiting-confirmed-final",
    pending:pending.map(m=>m.id),sources:{espnFinals:espn.length,sofaFinals:sofa.length},saved};
  await firebasePut("uclResultsSync",state,accessToken);
  return {action:saved.length?"ucl-results-updated":"ucl-results-awaiting-confirmation",
    pending:pending.length,sources:state.sources,saved};
}

async function safeStep(name, fn) {
  try {
    return await fn();
  } catch (error) {
    return { action:`${name}-error`, error:error?.message || String(error) };
  }
}

async function processAll(env) {
  const accessToken = await getAccessToken(env);
  const results = [];
  results.push(await safeStep("ucl-prediction-alerts",()=>processPredictionAlerts(accessToken)));
  results.push(await safeStep("ucl-results-sync",()=>processUclResults(accessToken)));
  results.push(await safeStep("gulf-prediction-alerts",()=>processGulfPredictionAlerts(accessToken)));
  results.push(await safeStep("gulf-results-sync",()=>processGulfResults(accessToken)));
  results.push(await safeStep("ucl-auto-round-news",()=>processAutomaticRoundNews(accessToken)));
  results.push(await safeStep("gulf-oman-news",()=>processGulfNews(accessToken)));
  results.push(await safeStep("ucl-round-news-queue",()=>processRoundNewsQueue(accessToken)));
  results.push(await safeStep("announcements",()=>processAnnouncements(accessToken)));
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("testPush") === "1") {
      const suppliedKey = url.searchParams.get("key") || "";
      const expectedKey = env.TEST_PUSH_KEY || "";

      if (!expectedKey) {
        return json({
          ok: false,
          testPush: true,
          error: "TEST_PUSH_KEY secret is not configured in Cloudflare.",
        }, 503);
      }

      if (!suppliedKey || suppliedKey !== expectedKey) {
        return json({
          ok: false,
          testPush: true,
          error: "Unauthorized test push request.",
        }, 401);
      }

      try {
        const accessToken = await getAccessToken(env);
        const result = await broadcast(
          "🔔 إشعار تجريبي",
          "تم تشغيل الإشعارات بنجاح. هذا اختبار مباشر من نظام إشعارات دوري أبطال أوروبا.",
          `manual-test-${Date.now()}`,
          accessToken,
          { type: "manual-test" }
        );
        return json({ ok: true, testPush: true, sent: true, ...result });
      } catch (error) {
        return json({ ok: false, testPush: true, error: error?.message || String(error) }, 500);
      }
    }

    if (url.searchParams.get("newsTest") === "1") {
      try {
        const kind = url.searchParams.get("kind") === "post" ? "post" : "pre";
        const schedule = await fetchSchedule();
        const rounds = roundWindows(schedule.matches);
        const now = Date.now();
        const requestedMd = Number(url.searchParams.get("matchday") || 0);
        let current = requestedMd ? rounds.find(r => Number(r.md) === requestedMd) : null;

        if (!current) {
          if (kind === "post") {
            // For post-round tests, use the most recently completed round.
            current = [...rounds].reverse().find(r => r.last <= now) || rounds[0];
          } else {
            // For pre-round tests, use a currently active round or the next upcoming round.
            current = rounds.find(r => r.first <= now && now <= r.last)
              || rounds.find(r => r.first > now)
              || rounds[rounds.length - 1];
          }
        }

        const context = { matchday: current?.md || 0 };
        const headlines = await getAutomaticRoundNewsV4(kind, context);
        const hoursSinceRoundEnd = current?.last ? Math.round((now - current.last) / 3600000) : null;
        return json({
          ok: true,
          newsTest: true,
          kind,
          matchday: context.matchday,
          hoursSinceRoundEnd,
          freshnessWindowHours: NEWS_MAX_AGE_HOURS,
          note: kind === "post" && hoursSinceRoundEnd > NEWS_MAX_AGE_HOURS
            ? "The selected round ended outside the production freshness window; zero headlines can be normal during a late manual test."
            : "Production filtering active.",
          headlineCount: headlines.length,
          headlines,
        });
      } catch (error) {
        return json({ ok: false, newsTest: true, error: error?.message || String(error) }, 500);
      }
    }

    if (url.searchParams.get("run") === "1") {
      try {
        return json({ ok: true, debug: true, results: await processAll(env) });
      } catch (error) {
        return json({ ok: false, debug: true, error: error?.message || String(error) }, 500);
      }
    }

    return json({
      ok: true,
      service: "UCL + Gulf Cup Push Notifications v17",
      project: PROJECT_ID,
      status: "online",
      schedule: SCHEDULE_URL,
      features: [
        "admin announcements",
        "prediction opening alerts (24h)",
        "prediction reminders (1h)",
        "prediction lock alerts (30m)",
        "fresh Arabic-first round news with relevance filters",
        "round news queue",
        "protected manual test push endpoint",
        "Gulf Cup 27 prediction alerts",
        "Gulf Cup 27 automatic verified final results",
        "UEFA Champions League automatic verified final results",
        "Gulf Cup 27 Oman-team news only",
      ],
      debugUrl: "/?run=1",
      time: new Date().toISOString(),
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      processAll(env)
        .then(result => console.log("UCL + Gulf worker result:", JSON.stringify(result)))
        .catch(error => console.error("UCL + Gulf worker error:", error?.message || String(error)))
    );
  },
};
