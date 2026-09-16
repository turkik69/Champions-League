from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')

old = '''    if (url.searchParams.get("testPush") === "1") {
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
'''

new = '''    if (url.searchParams.get("testPush") === "1") {
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
'''

if old not in s:
    raise SystemExit('testPush block not found')

s = s.replace(old, new, 1)
s = s.replace('service: "UCL Push Notifications v10"', 'service: "UCL Push Notifications v11"')
s = s.replace('"temporary manual test push endpoint",', '"protected manual test push endpoint",')
p.write_text(s, encoding='utf-8')
