from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

s = s.replace(
'''async function fetchBingNews(query) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setlang=en`;
''',
'''async function fetchBingNews(query, language = "ar") {
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const market = language === "ar" ? "ar-SA" : "en-US";
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setlang=${encodeURIComponent(locale)}&cc=OM&mkt=${encodeURIComponent(market)}`;
'''
)

start = s.find('async function getAutomaticRoundNewsV4(kind) {')
end = s.find('\nfunction roundWindows(matches) {', start)
if start == -1 or end == -1:
    raise SystemExit('getAutomaticRoundNewsV4 block not found')

new_block = r'''function isArabicHeadline(title = "") {
  const arabic = (title.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (title.match(/[A-Za-z\u0600-\u06FF]/g) || []).length || 1;
  return arabic / letters >= 0.35;
}

function trustedNewsSource(item) {
  const haystack = `${item?.link || ""} ${item?.source || ""}`.toLowerCase();
  if (haystack.includes('uefa.com') || haystack.includes('uefa')) return 40;
  if (/bbc|reuters|apnews|espn|skysports|theathletic|nbcsports|goal\.com/.test(haystack)) return 25;
  return 5;
}

function newsRelevanceScore(item, kind) {
  const title = String(item?.title || "");
  const low = title.toLowerCase();
  let score = 0;
  if (isArabicHeadline(title)) score += 60;
  score += trustedNewsSource(item);

  if (/champions league|دوري أبطال أوروبا|دوري الابطال|uefa/.test(low)) score += 25;
  if (kind === 'post' && /result|highlight|recap|win|goal|scor|نتيج|ملخص|فوز|هدف|هداف|نجم/.test(low)) score += 15;
  if (kind === 'pre' && /preview|team news|injur|lineup|غياب|إصاب|اصاب|تشكيل|استعداد|قبل/.test(low)) score += 15;

  const age = item?.publishedAt ? Math.max(0, Date.now() - item.publishedAt) : 0;
  score += Math.max(0, 20 - Math.floor(age / (12 * 60 * 60_000)));
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
  for (const item of pool) {
    if (!item?.title) continue;
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
  unique.forEach(item => {
    if (picked.length < 3) add(item);
  });

  return picked.slice(0, 3);
}
'''

s = s[:start] + new_block + s[end:]

s = s.replace('service: "UCL Push Notifications v4"', 'service: "UCL Push Notifications v5"')
s = s.replace('"automatic round news + star headlines",', '"Arabic-first automatic round news + trusted-source ranking",')

p.write_text(s, encoding='utf-8')
