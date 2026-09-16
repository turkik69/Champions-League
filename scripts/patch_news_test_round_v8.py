from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')
old = '''        const current = rounds.find(r => r.first <= now && now <= r.last + 24 * 60 * 60_000)
          || rounds.find(r => r.first > now)
          || rounds[rounds.length - 1];
        const context = { matchday: current?.md || 0 };
        const headlines = await getAutomaticRoundNewsV4(kind, context);
        return json({ ok: true, newsTest: true, kind, matchday: context.matchday, headlineCount: headlines.length, headlines });
'''
new = '''        const requestedMd = Number(url.searchParams.get("matchday") || 0);
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
'''
if old not in s:
    raise SystemExit('newsTest selection block not found')
s = s.replace(old, new, 1)
s = s.replace('service: "UCL Push Notifications v7"', 'service: "UCL Push Notifications v8"')
p.write_text(s, encoding='utf-8')
