from pathlib import Path
import re

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

s = s.replace('const NEWS_MAX_AGE_HOURS = 72;', 'const NEWS_MAX_AGE_HOURS = 168;')

replacement = '''async function getAutomaticRoundNews(kind) {
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

function roundWindows'''

pattern = re.compile(r'async function getAutomaticRoundNews\(kind\) \{[\s\S]*?\n\}\n\nfunction roundWindows')
new_s, count = pattern.subn(lambda m: replacement, s, count=1)
if count != 1:
    raise SystemExit(f'Could not replace getAutomaticRoundNews, replacements={count}')

p.write_text(new_s, encoding='utf-8')
