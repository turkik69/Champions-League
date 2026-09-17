const FB_URL='https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app';
const USER_KEY='ucl_azba_user';
const TEAMS={
  'السعودية':{flag:'🇸🇦',group:'A'},'العراق':{flag:'🇮🇶',group:'A'},'عُمان':{flag:'🇴🇲',group:'A'},'الكويت':{flag:'🇰🇼',group:'A'},
  'الإمارات':{flag:'🇦🇪',group:'B'},'قطر':{flag:'🇶🇦',group:'B'},'البحرين':{flag:'🇧🇭',group:'B'},'اليمن':{flag:'🇾🇪',group:'B'}
};
const GROUPS={A:['السعودية','العراق','عُمان','الكويت'],B:['الإمارات','قطر','البحرين','اليمن']};
// المواجهات المنشورة رسمياً للمنتخب السعودي حتى الآن. التوقيت محلي جدة (UTC+3).
const MATCHES=[
 {id:'g27_sa_kw',round:1,date:'2026-09-23T21:00:00+03:00',home:'السعودية',away:'الكويت',venue:'ملعب الإنماء — جدة',confirmed:true},
 {id:'g27_om_sa',round:2,date:'2026-09-26T21:00:00+03:00',home:'عُمان',away:'السعودية',venue:'ملعب الإنماء — جدة',confirmed:true},
 {id:'g27_sa_iq',round:3,date:'2026-09-29T20:30:00+03:00',home:'السعودية',away:'العراق',venue:'ملعب الإنماء — جدة',confirmed:true}
];
let currentUserId=localStorage.getItem(USER_KEY)||'';
let myPreds={};
function el(id){return document.getElementById(id)}
async function fbGet(path){try{const r=await fetch(`${FB_URL}/${path}.json`);return r.ok?await r.json():null}catch{return null}}
async function fbPut(path,val){try{const r=await fetch(`${FB_URL}/${path}.json`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(val)});return r.ok}catch{return false}}
function fmtDate(iso){return new Intl.DateTimeFormat('ar-OM',{weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Riyadh'}).format(new Date(iso))}
function flag(name){return TEAMS[name]?.flag||'🏳️'}
function isOpen(m){const now=Date.now(),ko=new Date(m.date).getTime();return now>=ko-24*60*60*1000&&now<ko-30*60*1000}
function isLocked(m){return Date.now()>=new Date(m.date).getTime()-30*60*1000}
function toast(t){const x=el('toast');x.textContent=t;x.classList.add('show');clearTimeout(window.__gToast);window.__gToast=setTimeout(()=>x.classList.remove('show'),2200)}
function renderGroups(){el('groupsGrid').innerHTML=Object.entries(GROUPS).map(([g,arr])=>`<div class="group-card"><h3>المجموعة ${g==='A'?'الأولى':'الثانية'}</h3>${arr.map(n=>`<div class="group-team"><span class="mini-flag">${flag(n)}</span><span>${n}</span></div>`).join('')}</div>`).join('')}
function renderTeams(){el('teamsGrid').innerHTML=Object.entries(TEAMS).map(([n,m])=>`<div class="team-card"><div class="flag">${m.flag}</div><div><strong>${n}</strong><small>المجموعة ${m.group}</small></div></div>`).join('')}
function matchCard(m){const p=myPreds[m.id]||{},open=isOpen(m),locked=isLocked(m);const state=open?'التوقع مفتوح':locked?'مغلق':'يفتح قبل 24 ساعة';return `<article class="match-card"><div class="match-top"><span>الجولة ${m.round}</span><span class="match-status">${state}</span></div><div class="match-teams"><div class="team-side"><div class="flag">${flag(m.home)}</div><strong>${m.home}</strong></div><div class="vs">VS</div><div class="team-side"><div class="flag">${flag(m.away)}</div><strong>${m.away}</strong></div></div><div class="match-meta">${fmtDate(m.date)} · ${m.venue}</div><div class="predict-row"><input class="score-input" id="h_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.home}" value="${p.h??''}" ${open?'':'disabled'}><input class="score-input" id="a_${m.id}" type="number" min="0" max="20" inputmode="numeric" placeholder="${m.away}" value="${p.a??''}" ${open?'':'disabled'}><button class="save-pred" onclick="savePrediction('${m.id}')" ${open?'':'disabled'}>حفظ</button></div><div class="pred-note">${open?'يمكنك تعديل توقعك حتى 30 دقيقة قبل البداية':locked?'انتهت مهلة التوقع':'سيُفتح التوقع تلقائياً قبل المباراة بـ24 ساعة'}</div></article>`}
function renderMatches(){el('matchesList').innerHTML=MATCHES.map(matchCard).join('');el('openPredictions').textContent=MATCHES.filter(isOpen).length;el('myPredictions').textContent=Object.keys(myPreds).length}
async function savePrediction(id){if(!currentUserId){el('loginGate').classList.remove('hidden');return}const m=MATCHES.find(x=>x.id===id);if(!m||!isOpen(m)){toast('التوقع غير متاح الآن');return}const h=Number(el(`h_${id}`).value),a=Number(el(`a_${id}`).value);if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0){toast('أدخل نتيجة صحيحة');return}const val={h,a,updatedAt:Date.now(),matchday:m.round,home:m.home,away:m.away};const ok=await fbPut(`gulfCup27Predictions/${currentUserId}/${id}`,val);if(ok){myPreds[id]=val;renderMatches();toast('تم حفظ توقعك ✅')}else toast('تعذر حفظ التوقع')}
function setupTabs(){document.querySelectorAll('.gulf-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.gulf-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-pane').forEach(x=>x.classList.remove('active'));b.classList.add('active');el(`tab-${b.dataset.tab}`).classList.add('active');lucide?.createIcons()}))}
function updateCountdown(){const start=new Date('2026-09-23T21:00:00+03:00').getTime(),d=start-Date.now();if(d<=0){el('countdown').textContent='البطولة انطلقت — أهلًا بالخليج 🇸🇦';return}const days=Math.floor(d/86400000),hrs=Math.floor((d%86400000)/3600000),mins=Math.floor((d%3600000)/60000);el('countdown').textContent=`متبقي على الافتتاح: ${days} يوم · ${hrs} ساعة · ${mins} دقيقة`}
async function init(){setupTabs();renderGroups();renderTeams();if(currentUserId){myPreds=await fbGet(`gulfCup27Predictions/${currentUserId}`)||{}}renderMatches();updateCountdown();setInterval(()=>{updateCountdown();renderMatches()},60000);setTimeout(()=>lucide?.createIcons(),100)}
window.savePrediction=savePrediction;document.addEventListener('DOMContentLoaded',init);
