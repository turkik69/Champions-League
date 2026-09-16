from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

start = s.find('function isArabicHeadline(title = "") {')
end = s.find('\nfunction roundWindows(matches) {', start)
if start == -1 or end == -1:
    raise SystemExit('news quality block not found')

new_block = r'''function isArabicHeadline(title = "") {
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

async function getAutomaticRoundNewsV4(kind) {
  const google = await getAutomaticRoundNews(kind).catch(() => []);

  const arabicQueries = kind === "pre"
    ? [
        "دوري أبطال أوروبا أخبار الجولة القادمة",
        "دوري أبطال أوروبا الغيابات الإصابات التشكيل",
        "دوري أبطال أوروبا أبرز النجوم قبل الجولة",
      ]
    : [
        "دوري أبطال أوروبا نتائج الجولة",
        "دوري أبطال أوروبا ملخص الجولة أبرز النجوم",
        "دوري أبطال أوروبا الهدافين لاعب الجولة",
      ];

  const englishQueries = kind === "pre"
    ? ["UEFA Champions League preview", "Champions League team news injuries"]
    : ["UEFA Champions League results highlights", "Champions League player of the match top scorers"];

  const [arabicBing, englishBing, uefa] = await Promise.all([
    Promise.all(arabicQueries.map(q => fetchBingNews(q, "ar").catch(() => []))),
    Promise.all(englishQueries.map(q => fetchBingNews(q, "en").catch(() => []))),
    fetchUefaNews().catch(() => []),
  ]);

  const pool = [
    ...google,
    ...arabicBing.flat(),
    ...uefa,
    ...englishBing.flat(),
  ];

  const seen = new Set();
  const unique = [];
  for (const raw of pool) {
    if (!raw?.title) continue;
    const item = {
      ...raw,
      title: cleanHeadline(raw.title),
      source: /uefa\.com/i.test(raw.link || "") ? "UEFA" : (raw.source || "News"),
    };
    if (!isFreshNews(item, kind) || !isRelevantRoundNews(item, kind)) continue;
    const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  unique.sort((a, b) => newsRelevanceScore(b, kind) - newsRelevanceScore(a, kind));

  const picked = [];
  const add = item => {
    if (!item || picked.some(x => x.title === item.title)) return;
    picked.push(item);
  };

  unique.filter(x => x.source === 'UEFA').slice(0, 1).forEach(add);
  unique.filter(x => isArabicHeadline(x.title)).slice(0, 3).forEach(add);
  unique.forEach(item => {
    if (picked.length < 3) add(item);
  });

  return picked.slice(0, 3);
}
'''

s = s[:start] + new_block + s[end:]

old_build = '''  const body = items.map((item, i) => `${i + 1}) ${item.title}`).join(" • ");\n  return {\n    title: kind === "pre" ? `📰 قبل الجولة ${md} · دوري الأبطال` : `⭐ حصاد الجولة ${md} · دوري الأبطال`,\n    body: `${prefix} ${body}`.slice(0, 500),\n  };'''
new_build = '''  const cleaned = items.map(item => cleanHeadline(item.title)).filter(Boolean);\n  const body = cleaned.map((title, i) => `${i + 1}) ${title}`).join(" • ");\n  return {\n    title: kind === "pre" ? `📰 أبرز أخبار الجولة ${md}` : `⭐ حصاد الجولة ${md}`,\n    body: `${prefix} ${body}`.slice(0, 420),\n  };'''
if old_build in s:
    s = s.replace(old_build, new_build, 1)

s = s.replace('service: "UCL Push Notifications v5"', 'service: "UCL Push Notifications v6"')
s = s.replace('"Arabic-first automatic round news + trusted-source ranking",', '"fresh Arabic-first round news with relevance filters",')

p.write_text(s, encoding='utf-8')
