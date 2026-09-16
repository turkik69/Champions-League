from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

s = s.replace('const NEWS_MAX_AGE_HOURS = 168;', 'const NEWS_MAX_AGE_HOURS = 72;')

start = s.find('async function getAutomaticRoundNewsV4(kind) {')
end = s.find('\nfunction roundWindows(matches) {', start)
if start == -1 or end == -1:
    raise SystemExit('news function block not found')

new_block = r'''function normalizeNewsTitle(title = "") {
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
'''

s = s[:start] + new_block + s[end:]

s = s.replace(
    'const news = await getAutomaticRoundNewsV4(item.event.kind);',
    'const news = await getAutomaticRoundNewsV4(item.event.kind, { matchday: item.round.md });'
)

old_test = '''        const kind = url.searchParams.get("kind") === "post" ? "post" : "pre";\n        const headlines = await getAutomaticRoundNewsV4(kind);\n        return json({ ok: true, newsTest: true, kind, headlineCount: headlines.length, headlines });'''
new_test = '''        const kind = url.searchParams.get("kind") === "post" ? "post" : "pre";\n        const schedule = await fetchSchedule();\n        const rounds = roundWindows(schedule.matches);\n        const now = Date.now();\n        const current = rounds.find(r => r.first <= now && now <= r.last + 24 * 60 * 60_000)\n          || rounds.find(r => r.first > now)\n          || rounds[rounds.length - 1];\n        const context = { matchday: current?.md || 0 };\n        const headlines = await getAutomaticRoundNewsV4(kind, context);\n        return json({ ok: true, newsTest: true, kind, matchday: context.matchday, headlineCount: headlines.length, headlines });'''
if old_test not in s:
    raise SystemExit('newsTest block not found')
s = s.replace(old_test, new_test, 1)

s = s.replace('service: "UCL Push Notifications v5"', 'service: "UCL Push Notifications v7"')
s = s.replace('service: "UCL Push Notifications v6"', 'service: "UCL Push Notifications v7"')

p.write_text(s, encoding='utf-8')
