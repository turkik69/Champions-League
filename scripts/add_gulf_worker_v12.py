from pathlib import Path

p=Path('cloudflare-worker-v2.js')
s=p.read_text(encoding='utf-8')

s=s.replace('const SCHEDULE_URL = `${APP_URL}match-schedule.json`;','const SCHEDULE_URL = `${APP_URL}match-schedule.json`;\nconst GULF_SCHEDULE_URL = `${APP_URL}gulf-schedule.json`;')

old='''async function sendFCM(deviceToken, title, body, tag, accessToken, data = {}) {\n  const response = await fetch(\n    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,'''
new='''async function sendFCM(deviceToken, title, body, tag, accessToken, data = {}) {\n  const targetUrl = data?.url || APP_URL;\n  const response = await fetch(\n    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,'''
if old not in s: raise SystemExit('sendFCM start not found')
s=s.replace(old,new,1)
s=s.replace('''            url: APP_URL,\n            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),''','''            url: targetUrl,\n            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),''',1)
s=s.replace('''            fcm_options: { link: APP_URL },''','''            fcm_options: { link: targetUrl },''',1)

marker='''async function processAll(env) {\n  const accessToken = await getAccessToken(env);'''
if marker not in s: raise SystemExit('processAll marker not found')

addon=r'''
async function fetchGulfSchedule() {
  const response = await fetch(`${GULF_SCHEDULE_URL}?v=${Math.floor(Date.now() / 300000)}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Gulf schedule fetch failed: ${response.status}`);
  const schedule = await response.json();
  if (!Array.isArray(schedule.matches)) throw new Error("Gulf schedule is missing matches array");
  return schedule;
}

function gulfStageLabel(group) {
  const first = group.matches[0] || {};
  if (first.stage === "semifinal") return "نصف النهائي";
  if (first.stage === "final") return "النهائي";
  return `الجولة ${group.md}`;
}

function buildGulfEvents(group, config) {
  const ko = new Date(group.ko).getTime();
  const openMs = (config.predictionOpenMinutesBeforeKickoff || 1440) * 60_000;
  const reminderMs = (config.reminderMinutesBeforeKickoff || 60) * 60_000;
  const lockMs = (config.predictionLockMinutesBeforeKickoff || 30) * 60_000;
  const fixtureText = compactFixtureText(group);
  const stage = gulfStageLabel(group);
  return [
    { type:"open", at:ko-openMs, title:`🏆 خليجي 27 · فُتحت التوقعات`, body:`${stage}: ${fixtureText}. يمكنك التوقع الآن، ويُغلق الباب قبل المباراة بـ30 دقيقة.` },
    { type:"reminder", at:ko-reminderMs, title:`⏰ خليجي 27 · تذكير بالتوقع`, body:`تبقت ساعة على ${fixtureText}. بقيت 30 دقيقة فقط على إغلاق التوقع.` },
    { type:"lock", at:ko-lockMs, title:`🔒 خليجي 27 · أُغلق التوقع`, body:`أُغلق التوقع لـ ${fixtureText}. تنطلق المباراة بعد 30 دقيقة.` },
  ];
}

function gulfEventKey(group, type) {
  return `g27_md${group.md}_${group.ko.replace(/[^0-9]/g, "")}_${type}`;
}

async function processGulfPredictionAlerts(accessToken) {
  const schedule = await fetchGulfSchedule();
  const eligible = schedule.matches.filter(m => m.predictable !== false && m.home && m.away);
  const groups = groupSchedule(eligible);
  const now = Date.now();
  let state = (await firebaseGet("gulfCup27PushAlerts", accessToken)) || null;

  if (!state || !state._initialized) {
    const boot = { _initialized: { at: now, season: schedule.season || "2026" } };
    for (const group of groups) {
      for (const event of buildGulfEvents(group, schedule)) {
        if (event.at <= now) boot[gulfEventKey(group,event.type)] = { done:true, bootstrapped:true, eventAt:event.at, at:now };
      }
    }
    await firebasePut("gulfCup27PushAlerts", boot, accessToken);
    return { action:"gulf-alerts-initialized" };
  }

  const due=[];
  for (const group of groups) {
    for (const event of buildGulfEvents(group, schedule)) {
      const key=gulfEventKey(group,event.type);
      if (state[key]?.done) continue;
      if (event.at<=now) due.push({group,event,key});
    }
  }
  due.sort((a,b)=>a.event.at-b.event.at);
  if (!due.length) return { action:"gulf-alerts-idle" };
  const item=due[0];
  const maxLateMs=item.event.type==="open"?2*60*60_000:45*60_000;
  if (now-item.event.at>maxLateMs) {
    await firebasePut(`gulfCup27PushAlerts/${item.key}`,{done:true,skippedLate:true,eventAt:item.event.at,checkedAt:now},accessToken);
    return {action:"gulf-alert-skipped-late",key:item.key};
  }
  const result=await broadcast(item.event.title,item.event.body,item.key,accessToken,{
    type:`gulf-prediction-${item.event.type}`,
    matchday:item.group.md,
    kickoff:item.group.ko,
    competition:"Gulf Cup 27",
    url:`${APP_URL}#gulf27`,
  });
  await firebasePut(`gulfCup27PushAlerts/${item.key}`,{done:true,eventType:item.event.type,eventAt:item.event.at,kickoff:item.group.ko,matchday:item.group.md,sentAt:Date.now(),...result},accessToken);
  return {action:`gulf-prediction-${item.event.type}-sent`,key:item.key,...result};
}

function isGulfNews(item) {
  const title=cleanHeadline(item?.title||"");
  if (!title || title.length<10) return false;
  if (!isStrictlyFresh(item,NEWS_MAX_AGE_HOURS)) return false;
  const low=title.toLowerCase();
  return /خليجي\s*27|كأس الخليج|كاس الخليج|gulf cup|arabian gulf cup|منتخب عمان|منتخب عُمان|المنتخب السعودي|منتخب السعودية|منتخب العراق|منتخب الكويت|منتخب قطر|منتخب البحرين|منتخب الإمارات|منتخب اليمن/.test(low);
}

async function fetchGulfNewsItems() {
  const queries=[
    "خليجي 27 جدة كأس الخليج",
    "كأس الخليج 27 السعودية عمان العراق الكويت قطر الإمارات البحرين اليمن",
    "Gulf Cup 27 Jeddah 2026",
  ];
  const batches=await Promise.all(queries.map((q,i)=>fetchBingNews(q,i===2?"en":"ar").catch(()=>[])));
  const seen=new Set(), items=[];
  for (const raw of batches.flat()) {
    if (!isGulfNews(raw)) continue;
    const title=cleanHeadline(raw.title);
    const key=title.toLowerCase().replace(/\s+/g," ");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({...raw,title});
  }
  items.sort((a,b)=>(b.publishedAt||0)-(a.publishedAt||0));
  return items.slice(0,8);
}

async function processGulfNews(accessToken) {
  const items=await fetchGulfNewsItems();
  if (!items.length) return {action:"gulf-news-idle",count:0};
  await firebasePut("gulfCup27News/latest",items,accessToken);
  const state=(await firebaseGet("gulfCup27NewsState",accessToken))||{};
  const top=items[0];
  const fingerprint=base64Url(new TextEncoder().encode(top.title)).slice(0,28);
  if (state.lastFingerprint===fingerprint) return {action:"gulf-news-refreshed",count:items.length,notification:"unchanged"};
  const lastSent=Number(state.lastSentAt||0);
  if (Date.now()-lastSent<3*60*60_000) return {action:"gulf-news-refreshed",count:items.length,notification:"rate-limited"};
  const result=await broadcast("📰 أخبار خليجي 27",top.title.slice(0,480),`gulf-news-${fingerprint}`,accessToken,{
    type:"gulf-news",
    url:`${APP_URL}#gulf27`,
  });
  await firebasePut("gulfCup27NewsState",{lastFingerprint:fingerprint,lastSentAt:Date.now(),title:top.title,...result},accessToken);
  return {action:"gulf-news-sent",count:items.length,...result};
}

'''
s=s.replace(marker,addon+marker,1)

oldall='''  results.push(await processPredictionAlerts(accessToken));\n  results.push(await processAutomaticRoundNews(accessToken));\n  results.push(await processRoundNewsQueue(accessToken));\n  results.push(await processAnnouncements(accessToken));'''
newall='''  results.push(await processPredictionAlerts(accessToken));\n  results.push(await processGulfPredictionAlerts(accessToken));\n  results.push(await processAutomaticRoundNews(accessToken));\n  results.push(await processGulfNews(accessToken));\n  results.push(await processRoundNewsQueue(accessToken));\n  results.push(await processAnnouncements(accessToken));'''
if oldall not in s: raise SystemExit('processAll body not found')
s=s.replace(oldall,newall,1)

s=s.replace('service: "UCL Push Notifications v11"','service: "UCL + Gulf Cup Push Notifications v12"',1)
s=s.replace('''        "protected manual test push endpoint",\n      ],''','''        "protected manual test push endpoint",\n        "Gulf Cup 27 prediction alerts",\n        "Gulf Cup 27 automatic news",\n      ],''',1)
s=s.replace('console.log("UCL worker result:"','console.log("UCL + Gulf worker result:"',1)
s=s.replace('console.error("UCL worker error:"','console.error("UCL + Gulf worker error:"',1)

p.write_text(s,encoding='utf-8')
print('patched cloudflare-worker-v2.js to v12 with Gulf Cup automation')

# retrigger workflow after workflow file was added
