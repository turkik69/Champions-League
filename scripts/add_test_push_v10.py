from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text(encoding='utf-8')
needle = '''    if (url.searchParams.get("newsTest") === "1") {\n'''
block = '''    if (url.searchParams.get("testPush") === "1") {\n      try {\n        const accessToken = await getAccessToken(env);\n        const result = await broadcast(\n          "🔔 إشعار تجريبي",\n          "تم تشغيل الإشعارات بنجاح. هذا اختبار مباشر من نظام إشعارات دوري أبطال أوروبا.",\n          `manual-test-${Date.now()}`,\n          accessToken,\n          { type: "manual-test" }\n        );\n        return json({ ok: true, testPush: true, sent: true, ...result });\n      } catch (error) {\n        return json({ ok: false, testPush: true, error: error?.message || String(error) }, 500);\n      }\n    }\n\n'''
if block in s:
    raise SystemExit('test push already added')
if needle not in s:
    raise SystemExit('fetch insertion point not found')
s = s.replace(needle, block + needle, 1)
s = s.replace('service: "UCL Push Notifications v9"', 'service: "UCL Push Notifications v10"')
s = s.replace('"round news queue",', '"round news queue",\n        "temporary manual test push endpoint",')
p.write_text(s, encoding='utf-8')
