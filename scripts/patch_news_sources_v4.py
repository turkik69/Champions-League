from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

if 'async function getAutomaticRoundNewsV4' not in s:
    anchor = 'function roundWindows(matches) {'
    if anchor not in s:
        raise SystemExit('roundWindows anchor not found')
    block = r'''
function stripNewsHtml(value = "") {
  return decodeXmlText(value)
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBingNews(query) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setlang=en`;
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

async function getAutomaticRoundNewsV4(kind) {
  const google = await getAutomaticRoundNews(kind).catch(() => []);
  if (google.length >= 3) return google.slice(0, 3);

  const queries = kind === "pre"
    ? ["UEFA Champions League preview", "Champions League team news injuries"]
    : ["UEFA Champions League results highlights", "Champions League player of the match top scorers"];

  const [bingBatches, uefa] = await Promise.all([
    Promise.all(queries.map(q => fetchBingNews(q).catch(() => []))),
    fetchUefaNews().catch(() => []),
  ]);

  const pool = [...google, ...bingBatches.flat(), ...uefa];
  const seen = new Set();
  const picked = [];
  for (const item of pool) {
    if (!item?.title) continue;
    const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
    if (picked.length >= 3) break;
  }
  return picked;
}

'''
    s = s.replace(anchor, block + anchor, 1)

s = s.replace('const news = await getAutomaticRoundNews(item.event.kind);', 'const news = await getAutomaticRoundNewsV4(item.event.kind);')
s = s.replace('const headlines = await getAutomaticRoundNews(kind);', 'const headlines = await getAutomaticRoundNewsV4(kind);')
s = s.replace('service: "UCL Push Notifications v3"', 'service: "UCL Push Notifications v4"')

p.write_text(s, encoding='utf-8')
