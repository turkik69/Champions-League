from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

old = '''function buildRoundNewsText(md, kind, items) {
  const prefix = kind === "pre"
    ? `أبرز أخبار الجولة ${md} قبل الانطلاق:`
    : `حصاد وأبرز أخبار الجولة ${md}:`;
  const cleaned = items.map(item => cleanHeadline(item.title)).filter(Boolean);
  const body = cleaned.map((title, i) => `${i + 1}) ${title}`).join(" • ");
  return {
    title: kind === "pre" ? `📰 أبرز أخبار الجولة ${md}` : `⭐ حصاد الجولة ${md}`,
    body: `${prefix} ${body}`.slice(0, 420),
  };
}
'''

new = '''function buildRoundNewsText(md, kind, items) {
  const cleaned = items.map(item => cleanHeadline(item.title)).filter(Boolean);
  const fullBody = cleaned.join(" • ");
  return {
    title: kind === "pre" ? `أخبار الجولة ${md}` : `حصاد الجولة ${md}`,
    body: fullBody.slice(0, 500),
  };
}
'''

if old not in s:
    raise SystemExit('buildRoundNewsText block not found')

s = s.replace(old, new)
s = s.replace('service: "UCL Push Notifications v8"', 'service: "UCL Push Notifications v9"')
p.write_text(s, encoding='utf-8')
