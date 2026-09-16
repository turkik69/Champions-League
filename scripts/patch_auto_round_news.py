from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

const_anchor = 'const MAX_DEVICES_PER_RUN = 50;\n'
const_block = '''const MAX_DEVICES_PER_RUN = 50;
const NEWS_PRE_MINUTES = 6 * 60;
const NEWS_POST_MINUTES = 3 * 60;
const NEWS_MAX_AGE_HOURS = 72;
const NEWS_RETRY_MINUTES = 30;
'''
if 'const NEWS_PRE_MINUTES' not in s:
    if const_anchor not in s:
        raise SystemExit('constants anchor not found')
    s = s.replace(const_anchor, const_block, 1)

news_anchor = 'async function processRoundNewsQueue(accessToken) {'
news_block = r'''function decodeXmlText(value = "") {
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
  const generalQuery = kind === "pre"
    ? '"دوري أبطال أوروبا" الجولة القادمة when:3d'
    : '"دوري أبطال أوروبا" نتائج الجولة when:3d';
  const starsQuery = '"دوري أبطال أوروبا" نجوم هدافين إصابة غياب when:3d';

  const [general, stars] = await Promise.all([
    fetchGoogleNews(generalQuery).catch(() => []),
    fetchGoogleNews(starsQuery).catch(() => []),
  ]);

  const generalRecent = uniqueRecentNews(general);
  const starsRecent = uniqueRecentNews(stars);
  const selected = [];
  if (generalRecent[0]) selected.push(generalRecent[0]);
  if (generalRecent[1]) selected.push(generalRecent[1]);
  if (starsRecent[0] && !selected.some(x => x.title === starsRecent[0].title)) selected.push(starsRecent[0]);
  return uniqueRecentNews(selected).slice(0, 3);
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
  const prefix = kind === "pre"
    ? `أبرز أخبار الجولة ${md} قبل الانطلاق:`
    : `حصاد وأبرز أخبار الجولة ${md}:`;
  const body = items.map((item, i) => `${i + 1}) ${item.title}`).join(" • ");
  return {
    title: kind === "pre" ? `📰 قبل الجولة ${md} · دوري الأبطال` : `⭐ حصاد الجولة ${md} · دوري الأبطال`,
    body: `${prefix} ${body}`.slice(0, 500),
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
  const news = await getAutomaticRoundNews(item.event.kind);
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

'''

if 'async function processAutomaticRoundNews' not in s:
    if news_anchor not in s:
        raise SystemExit('round news anchor not found')
    s = s.replace(news_anchor, news_block + news_anchor, 1)

old_all = '''  results.push(await processPredictionAlerts(accessToken));
  results.push(await processRoundNewsQueue(accessToken));
  results.push(await processAnnouncements(accessToken));'''
new_all = '''  results.push(await processPredictionAlerts(accessToken));
  results.push(await processAutomaticRoundNews(accessToken));
  results.push(await processRoundNewsQueue(accessToken));
  results.push(await processAnnouncements(accessToken));'''
if 'results.push(await processAutomaticRoundNews(accessToken));' not in s:
    if old_all not in s:
        raise SystemExit('processAll anchor not found')
    s = s.replace(old_all, new_all, 1)

old_feature = '        "round news queue",\n'
new_feature = '        "automatic round news + star headlines",\n        "round news queue",\n'
if 'automatic round news + star headlines' not in s:
    if old_feature not in s:
        raise SystemExit('features anchor not found')
    s = s.replace(old_feature, new_feature, 1)

s = s.replace('service: "UCL Push Notifications v2"', 'service: "UCL Push Notifications v3"')
p.write_text(s, encoding='utf-8')
