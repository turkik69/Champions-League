from pathlib import Path
import re

# Keep the late final-opening notification recoverable.
p = Path('cloudflare-worker-v2.js')
s = p.read_text()
old_boot = '        if (event.at <= now) boot[gulfEventKey(group,event.type)] = { done:true, bootstrapped:true, eventAt:event.at, at:now };'
new_boot = '''        if (event.at <= now) {
          const isFinalOpen = event.type === "open" && group.matches.some(m => m.stage === "final");
          const lockAt = new Date(group.ko).getTime() - (schedule.predictionLockMinutesBeforeKickoff || 30) * 60_000;
          if (!(isFinalOpen && now < lockAt)) {
            boot[gulfEventKey(group,event.type)] = { done:true, bootstrapped:true, eventAt:event.at, at:now };
          }
        }'''
if old_boot in s:
    s = s.replace(old_boot, new_boot, 1)
old_done = '''      if (state[key]?.done) continue;
      if (event.at<=now) due.push({group,event,key});'''
new_done = '''      if (state[key]?.done) {
        const isFinalOpen = event.type === "open" && group.matches.some(m => m.stage === "final");
        const lockAt = new Date(group.ko).getTime() - (schedule.predictionLockMinutesBeforeKickoff || 30) * 60_000;
        const recoverSkippedFinalOpen = isFinalOpen && now < lockAt && !state[key]?.sentAt && (state[key]?.skippedLate || state[key]?.bootstrapped);
        if (!recoverSkippedFinalOpen) continue;
      }
      if (event.at<=now) due.push({group,event,key});'''
if old_done in s:
    s = s.replace(old_done, new_done, 1)
old_late = '''  const maxLateMs=item.event.type==="open"?2*60*60_000:45*60_000;
  if (now-item.event.at>maxLateMs) {'''
new_late = '''  const isFinalOpen = item.event.type === "open" && item.group.matches.some(m => m.stage === "final");
  const finalLockAt = new Date(item.group.ko).getTime() - (schedule.predictionLockMinutesBeforeKickoff || 30) * 60_000;
  const finalOpenStillValid = isFinalOpen && now < finalLockAt;
  const maxLateMs=item.event.type==="open"?2*60*60_000:45*60_000;
  if (!finalOpenStillValid && now-item.event.at>maxLateMs) {'''
if old_late in s:
    s = s.replace(old_late, new_late, 1)
for old in ['service: "UCL + Gulf Cup Push Notifications v19"','service: "UCL + Gulf Cup Push Notifications v19.1"']:
    s = s.replace(old, 'service: "UCL + Gulf Cup Push Notifications v20"')
p.write_text(s)

# Add World-Cup-style knockout prediction flow to the Gulf Cup final.
jp = Path('gulf.js')
js = jp.read_text()
helper = r'''function finalPredictionForm(m,p,open,locked){
  const disabled=open?'':'disabled';
  const hasReg=p.h!==undefined&&p.a!==undefined;
  const showExtra=hasReg&&Number(p.h)===Number(p.a);
  const hasExtra=p.extraH!==undefined&&p.extraA!==undefined;
  const showPens=showExtra&&hasExtra&&Number(p.extraH)===Number(p.extraA);
  return `<div class="ko-predict"><div class="ko-title">توقع نتيجة النهائي</div><div class="ko-step"><span>بعد 90 دقيقة</span><div class="predict-row"><input class="score-input" id="h_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.home}" value="${p.h??''}" ${disabled} oninput="updateFinalPredictionFlow('${m.id}')"><input class="score-input" id="a_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.away}" value="${p.a??''}" ${disabled} oninput="updateFinalPredictionFlow('${m.id}')"></div></div><div class="ko-step" id="extra_${m.id}" style="display:${showExtra?'block':'none'}"><span>إذا انتهى الوقت الأصلي بالتعادل — النتيجة بعد الأشواط الإضافية</span><div class="predict-row"><input class="score-input" id="eh_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.home}" value="${p.extraH??''}" ${disabled} oninput="updateFinalPredictionFlow('${m.id}')"><input class="score-input" id="ea_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.away}" value="${p.extraA??''}" ${disabled} oninput="updateFinalPredictionFlow('${m.id}')"></div></div><div class="ko-step pens" id="pens_${m.id}" style="display:${showPens?'block':'none'}"><span>إذا استمر التعادل — ركلات الترجيح</span><div class="predict-row"><input class="score-input" id="ph_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.home}" value="${p.penH??''}" ${disabled}><input class="score-input" id="pa_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.away}" value="${p.penA??''}" ${disabled}></div></div><button class="save-pred ko-save" onclick="savePrediction('${m.id}')" ${disabled}>حفظ توقع النهائي</button><div class="pred-note">${open?'يمكن أن ينتهي الوقت الأصلي بالتعادل، ثم الأشواط الإضافية، ثم ركلات الترجيح عند استمرار التعادل':locked?'انتهت مهلة التوقع':'سيُفتح التوقع تلقائياً قبل المباراة بـ24 ساعة'}</div></div>`;
}
function updateFinalPredictionFlow(id){
  const h=Number(el(`h_${id}`)?.value),a=Number(el(`a_${id}`)?.value),extra=el(`extra_${id}`),pens=el(`pens_${id}`);
  const regValid=Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0;
  const tied=regValid&&h===a;
  if(extra)extra.style.display=tied?'block':'none';
  if(!tied){if(pens)pens.style.display='none';return}
  const eh=Number(el(`eh_${id}`)?.value),ea=Number(el(`ea_${id}`)?.value);
  const extraValid=Number.isInteger(eh)&&Number.isInteger(ea)&&eh>=0&&ea>=0;
  if(pens)pens.style.display=extraValid&&eh===ea?'block':'none';
}
'''
if 'function finalPredictionForm(' not in js:
    js = js.replace('function matchCard(m){', helper + '\nfunction matchCard(m){', 1)

new_match = r'''function matchCard(m){const p=myPreds[m.id]||{},open=isOpen(m),locked=isLocked(m),r=results[m.id];const placeholder=m.predictable===false;const state=r&&Number.isInteger(Number(r.h))?'انتهت':placeholder?'يتحدد لاحقاً':open?'التوقع مفتوح':locked?'مغلق':'يفتح قبل 24 ساعة';const resultHtml=r&&Number.isInteger(Number(r.h))?`<div class="final-score">${r.h} - ${r.a}</div>`:'<div class="vs">VS</div>';let form='';if(!placeholder){if(m.stage==='final'){form=finalPredictionForm(m,p,open,locked)}else{form=`<div class="predict-row"><input class="score-input" id="h_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.home}" value="${p.h??''}" ${open?'':'disabled'}><input class="score-input" id="a_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.away}" value="${p.a??''}" ${open?'':'disabled'}><button class="save-pred" onclick="savePrediction('${m.id}')" ${open?'':'disabled'}>حفظ</button></div><div class="pred-note">${open?'يمكنك تعديل توقعك حتى 30 دقيقة قبل البداية':locked?'انتهت مهلة التوقع':'سيُفتح التوقع تلقائياً قبل المباراة بـ24 ساعة'}</div>`}}return `<article class="match-card ${m.stage==='final'?'final-match-card':''}"><div class="match-top"><span>${stageName(m)}</span><span class="match-status">${state}</span></div><div class="match-teams"><div class="team-side"><div class="flag">${flag(m.home)}</div><strong>${m.home}</strong></div>${resultHtml}<div class="team-side"><div class="flag">${flag(m.away)}</div><strong>${m.away}</strong></div></div><div class="match-meta">${fmtDate(m.ko)} بتوقيت مسقط · ${m.venue}</div>${form}</article>`}
function renderMatches(){'''
js, n = re.subn(r'function matchCard\(m\)\{.*?\}\nfunction renderMatches\(\)\{', new_match, js, count=1, flags=re.S)
if n != 1:
    raise SystemExit('matchCard replacement failed')

new_save = r'''async function savePrediction(id){if(!currentUserId){el('loginGate')?.classList.remove('hidden');return}const m=MATCHES.find(x=>x.id===id);if(!m||!isOpen(m)){toast('التوقع غير متاح الآن');return}const h=Number(el(`h_${id}`).value),a=Number(el(`a_${id}`).value);if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0){toast('أدخل نتيجة صحيحة للوقت الأصلي');return}let val={h,a,updatedAt:Date.now(),matchday:m.md,home:m.home,away:m.away};if(m.stage==='final'){val.knockout=true;if(h===a){const eh=Number(el(`eh_${id}`)?.value),ea=Number(el(`ea_${id}`)?.value);if(!Number.isInteger(eh)||!Number.isInteger(ea)||eh<h||ea<a){toast('أدخل النتيجة بعد الأشواط الإضافية');return}val.extraH=eh;val.extraA=ea;if(eh===ea){const ph=Number(el(`ph_${id}`)?.value),pa=Number(el(`pa_${id}`)?.value);if(!Number.isInteger(ph)||!Number.isInteger(pa)||ph<0||pa<0||ph===pa){toast('أدخل نتيجة صحيحة لركلات الترجيح بدون تعادل');return}val.penH=ph;val.penA=pa;val.decidedBy='penalties';val.winner=ph>pa?m.home:m.away}else{val.decidedBy='extra-time';val.winner=eh>ea?m.home:m.away}}else{val.decidedBy='regular';val.winner=h>a?m.home:m.away}}const ok=await fbPut(`gulfCup27Predictions/${currentUserId}/${id}`,val);if(ok){myPreds[id]=val;allPreds[currentUserId]=myPreds;renderMatches();renderRanking();toast(m.stage==='final'?'تم حفظ توقع النهائي ✅':'تم حفظ توقعك ✅')}else toast('تعذر حفظ التوقع')}
function renderRanking(){'''
js, n = re.subn(r'async function savePrediction\(id\)\{.*?\}\nfunction renderRanking\(\)\{', new_save, js, count=1, flags=re.S)
if n != 1:
    raise SystemExit('savePrediction replacement failed')

if 'window.updateFinalPredictionFlow=updateFinalPredictionFlow;' not in js:
    js = js.replace('window.savePrediction=savePrediction;', 'window.savePrediction=savePrediction;window.updateFinalPredictionFlow=updateFinalPredictionFlow;', 1)
jp.write_text(js)

cp = Path('gulf.css')
css = cp.read_text()
extra_css = '''\n/* Gulf Cup final knockout prediction flow */\n.final-match-card{border:1px solid rgba(214,178,94,.48);box-shadow:0 18px 46px rgba(11,107,79,.14)}\n.ko-predict{margin-top:14px;padding:14px;border-radius:18px;background:linear-gradient(180deg,#f6fbf8,#fffaf0);border:1px solid rgba(11,107,79,.12)}\n.ko-title{text-align:center;font-weight:900;color:var(--green);margin-bottom:10px}.ko-step{margin-top:10px;padding:10px;border-radius:14px;background:rgba(255,255,255,.75);border:1px solid var(--line)}\n.ko-step>span{display:block;text-align:center;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:8px}.ko-step.pens{background:#fff8e8;border-color:rgba(214,178,94,.3)}\n.ko-save{width:100%;margin-top:12px}.ko-predict .predict-row{grid-template-columns:1fr 1fr}\n'''
if 'Gulf Cup final knockout prediction flow' not in css:
    css += extra_css
cp.write_text(css)

hp = Path('gulf.html')
html = hp.read_text()
html = re.sub(r'gulf\.js\?v=\d+', 'gulf.js?v=8', html)
html = re.sub(r'gulf\.css\?v=\d+', 'gulf.css?v=4', html)
html = html.replace('3 نقاط للنتيجة الدقيقة، ونقطة واحدة لتوقع الفائز أو التعادل. يُفتح التوقع قبل المباراة بـ24 ساعة ويُغلق قبل الانطلاق بـ30 دقيقة.','في النهائي يمكنك توقع التعادل بعد 90 دقيقة، ثم نتيجة الأشواط الإضافية، وإذا استمر التعادل تنتقل توقعاتك إلى ركلات الترجيح. يُغلق التوقع قبل المباراة بـ30 دقيقة.')
hp.write_text(html)
