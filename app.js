// ════════════════════════════════════════════
// دوري أبطال أوروبا 2026-27 — نظام التوقعات
// يستخدم نفس قاعدة بيانات Firebase ونفس المشاركين المسجّلين بتطبيق فانتزي العزبة
// ⚠️ ملاحظة أمنية مهمة (راجع الأسفل عند submitAdminLogin): بيانات دخول المشرف مكتوبة
// صراحة بكود JavaScript من جهة العميل — أي شخص يفتح "عرض المصدر" يراها. الحل الصحيح
// طويل المدى: نقل التحقق لخادم (Firebase Authentication أو قاعدة بيانات تتحقق من كلمة
// المرور بقواعد أمان من جهة الخادم)، لا JavaScript يعمل بالمتصفح. لم أُغيّر هذا الآن
// حتى لا أكسر تسجيل الدخول الحالي — يحتاج قراراً وعملاً منفصلاً لاحقاً.
// ════════════════════════════════════════════
const FB_URL = 'https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app';

async function fbGet(path){
  try{
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 4000);
    const r = await fetch(`${FB_URL}/${path}.json`, {signal:controller.signal});
    clearTimeout(timer);
    return r.ok ? await r.json() : null;
  }catch(e){ return null; }
}
async function fbPatch(path, val){
  try{ await fetch(`${FB_URL}/${path}.json`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(val)}); return true; }
  catch(e){ return false; }
}
async function fbPut(path, val){
  try{ await fetch(`${FB_URL}/${path}.json`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(val)}); return true; }
  catch(e){ return false; }
}

// ── بيانات المباريات: 144 مباراة رسمية عبر 8 جولات (مصدر: UEFA.com) — لم تُغيَّر ──
// الجولة الأولى (8-10 سبتمبر 2026) انتهت فعلياً — نتائجها الحقيقية مُضمّنة (resH/resA)
const CLUB_EN = {
  'أ.إي.ك أثينا':'aek-athens','لاسك لينز':'lask','كلوب بروج':'club-brugge','أستون فيلا':'aston-villa',
  'بوروسيا دورتموند':'borussia-dortmund','فياريال':'villarreal','بورتو':'porto','مانشستر سيتي':'manchester-city',
  'ليل':'lille','ريال بيتيس':'real-betis','ريال مدريد':'real-madrid','إنتر ميلان':'inter',
  'برشلونة':'barcelona','فينورد':'feyenoord','شتوتغارت':'stuttgart','فايكينغ':'viking-fk',
  'ليفربول':'liverpool','أتلتيكو مدريد':'atletico-madrid','باريس سان جيرمان':'paris-saint-germain','سلوفان براتيسلافا':'slovan-bratislava',
  'سبورتينغ لشبونة':'sporting-cp','غلطة سراي':'galatasaray','نابولي':'napoli','أرسنال':'arsenal',
  'فنربخشة':'fenerbahce','روما':'roma','بي إس في آيندهوفن':'psv-eindhoven','شاختار دونيتسك':'shakhtar-donetsk',
  'كومو':'como-1907','لايبزيغ':'rb-leipzig','بايرن ميونخ':'bayern-munich','بودو غليمت':'bodo-glimt',
  'مانشستر يونايتد':'manchester-united','سابح':'kf-sabail','سلافيا براغ':'slavia-prague','لانس':'rc-lens',
};
const CLUB_BADGE = {
  'أ.إي.ك أثينا':['AEK','#FFD500','#000'], 'لاسك لينز':['LSK','#0A0A0A','#fff'],
  'كلوب بروج':['CLB','#005CA9','#fff'], 'أستون فيلا':['AVL','#670E36','#95BFE5'],
  'بوروسيا دورتموند':['BVB','#FDE100','#000'], 'فياريال':['VIL','#FFE667','#005187'],
  'بورتو':['POR','#0B4EA2','#fff'], 'مانشستر سيتي':['MCI','#6CABDD','#fff'],
  'ليل':['LOS','#C10000','#fff'], 'ريال بيتيس':['BET','#00A650','#fff'],
  'ريال مدريد':['RMA','#FFFFFF','#00529F'], 'إنتر ميلان':['INT','#010E80','#fff'],
  'برشلونة':['BAR','#A50044','#004D98'], 'فينورد':['FEY','#E1000F','#fff'],
  'شتوتغارت':['VFB','#E0001F','#fff'], 'فايكينغ':['VIK','#003399','#fff'],
  'ليفربول':['LIV','#C8102E','#fff'], 'أتلتيكو مدريد':['ATM','#CB3524','#272E61'],
  'باريس سان جيرمان':['PSG','#004170','#DA291C'], 'سلوفان براتيسلافا':['SLB','#5DBFEB','#003057'],
  'سبورتينغ لشبونة':['SCP','#008542','#fff'], 'غلطة سراي':['GAL','#FFB300','#A90432'],
  'نابولي':['NAP','#12A0D7','#fff'], 'أرسنال':['ARS','#EF0107','#fff'],
  'فنربخشة':['FB','#FFDD00','#003399'], 'روما':['ROM','#8E1F2F','#F0BC42'],
  'بي إس في آيندهوفن':['PSV','#ED1C24','#fff'], 'شاختار دونيتسك':['SHK','#FF6600','#000'],
  'كومو':['COM','#0057A8','#fff'], 'لايبزيغ':['RBL','#DD0741','#fff'],
  'بايرن ميونخ':['BAY','#DC052D','#0066B2'], 'بودو غليمت':['BOD','#FFD700','#000'],
  'مانشستر يونايتد':['MUN','#DA020E','#FBE122'], 'سابح':['SAB','#C8102E','#00205B'],
  'سلافيا براغ':['SLA','#C8102E','#fff'], 'لانس':['LEN','#FFD100','#C8102E'],
};
function clubBadge(name, size){
  const b = CLUB_BADGE[name] || ['—','#333','#fff'];
  const s = size||38;
  return `<span class="club-crest" style="width:${s}px;height:${s}px;background:${b[1]};color:${b[2]}">${b[0]}</span>`;
}

const MATCHES = [
  {id:'ucl_m1',md:1,home:'أ.إي.ك أثينا',away:'لاسك لينز',ko:'2026-09-08T19:00:00Z',resH:1,resA:0},
  {id:'ucl_m2',md:1,home:'كلوب بروج',away:'أستون فيلا',ko:'2026-09-08T19:00:00Z',resH:2,resA:3},
  {id:'ucl_m3',md:1,home:'بوروسيا دورتموند',away:'فياريال',ko:'2026-09-08T19:00:00Z',resH:3,resA:2},
  {id:'ucl_m4',md:1,home:'بورتو',away:'مانشستر سيتي',ko:'2026-09-08T19:00:00Z',resH:0,resA:2},
  {id:'ucl_m5',md:1,home:'ليل',away:'ريال بيتيس',ko:'2026-09-08T19:00:00Z',resH:2,resA:3},
  {id:'ucl_m6',md:1,home:'ريال مدريد',away:'إنتر ميلان',ko:'2026-09-08T19:00:00Z',resH:2,resA:1},
  {id:'ucl_m7',md:1,home:'برشلونة',away:'فينورد',ko:'2026-09-09T19:00:00Z',resH:5,resA:1},
  {id:'ucl_m8',md:1,home:'شتوتغارت',away:'فايكينغ',ko:'2026-09-09T19:00:00Z',resH:3,resA:1},
  {id:'ucl_m9',md:1,home:'ليفربول',away:'أتلتيكو مدريد',ko:'2026-09-09T19:00:00Z',resH:2,resA:1},
  {id:'ucl_m10',md:1,home:'باريس سان جيرمان',away:'سلوفان براتيسلافا',ko:'2026-09-09T19:00:00Z',resH:6,resA:1},
  {id:'ucl_m11',md:1,home:'سبورتينغ لشبونة',away:'غلطة سراي',ko:'2026-09-09T19:00:00Z',resH:3,resA:1},
  {id:'ucl_m12',md:1,home:'نابولي',away:'أرسنال',ko:'2026-09-09T19:00:00Z',resH:0,resA:1},
  {id:'ucl_m13',md:1,home:'فنربخشة',away:'روما',ko:'2026-09-10T19:00:00Z',resH:1,resA:1},
  {id:'ucl_m14',md:1,home:'بي إس في آيندهوفن',away:'شاختار دونيتسك',ko:'2026-09-10T19:00:00Z',resH:1,resA:1},
  {id:'ucl_m15',md:1,home:'كومو',away:'لايبزيغ',ko:'2026-09-10T19:00:00Z',resH:4,resA:1},
  {id:'ucl_m16',md:1,home:'بايرن ميونخ',away:'بودو غليمت',ko:'2026-09-10T19:00:00Z',resH:5,resA:0},
  {id:'ucl_m17',md:1,home:'مانشستر يونايتد',away:'سابح',ko:'2026-09-10T19:00:00Z',resH:4,resA:0},
  {id:'ucl_m18',md:1,home:'سلافيا براغ',away:'لانس',ko:'2026-09-10T19:00:00Z',resH:2,resA:3},

  {id:'ucl_m19',md:2,home:'لانس',away:'سبورتينغ لشبونة',ko:'2026-10-13T16:45:00Z'},
  {id:'ucl_m20',md:2,home:'سابح',away:'سلافيا براغ',ko:'2026-10-13T16:45:00Z'},
  {id:'ucl_m21',md:2,home:'أرسنال',away:'ليل',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m22',md:2,home:'أتلتيكو مدريد',away:'مانشستر يونايتد',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m23',md:2,home:'إنتر ميلان',away:'كلوب بروج',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m24',md:2,home:'غلطة سراي',away:'برشلونة',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m25',md:2,home:'لايبزيغ',away:'بي إس في آيندهوفن',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m26',md:2,home:'فايكينغ',away:'بايرن ميونخ',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m27',md:2,home:'فياريال',away:'نابولي',ko:'2026-10-13T19:00:00Z'},
  {id:'ucl_m28',md:2,home:'فينورد',away:'كومو',ko:'2026-10-14T16:45:00Z'},
  {id:'ucl_m29',md:2,home:'لاسك لينز',away:'ليفربول',ko:'2026-10-14T16:45:00Z'},
  {id:'ucl_m30',md:2,home:'روما',away:'ريال مدريد',ko:'2026-10-14T19:00:00Z'},
  {id:'ucl_m31',md:2,home:'أستون فيلا',away:'فنربخشة',ko:'2026-10-14T19:00:00Z'},
  {id:'ucl_m32',md:2,home:'شاختار دونيتسك',away:'أ.إي.ك أثينا',ko:'2026-10-14T19:00:00Z'},
  {id:'ucl_m33',md:2,home:'بودو غليمت',away:'بوروسيا دورتموند',ko:'2026-10-14T19:00:00Z'},
  {id:'ucl_m34',md:2,home:'مانشستر سيتي',away:'باريس سان جيرمان',ko:'2026-10-14T19:00:00Z'},
  {id:'ucl_m35',md:2,home:'ريال بيتيس',away:'بورتو',ko:'2026-10-14T19:00:00Z'},
  {id:'ucl_m36',md:2,home:'سلوفان براتيسلافا',away:'شتوتغارت',ko:'2026-10-14T19:00:00Z'},

  {id:'ucl_m37',md:3,home:'فنربخشة',away:'سلافيا براغ',ko:'2026-10-20T16:45:00Z'},
  {id:'ucl_m38',md:3,home:'سابح',away:'بوروسيا دورتموند',ko:'2026-10-20T16:45:00Z'},
  {id:'ucl_m39',md:3,home:'روما',away:'سلوفان براتيسلافا',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m40',md:3,home:'بورتو',away:'بي إس في آيندهوفن',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m41',md:3,home:'ليفربول',away:'فياريال',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m42',md:3,home:'مانشستر سيتي',away:'أ.إي.ك أثينا',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m43',md:3,home:'باريس سان جيرمان',away:'برشلونة',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m44',md:3,home:'نابولي',away:'بودو غليمت',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m45',md:3,home:'شتوتغارت',away:'أتلتيكو مدريد',ko:'2026-10-20T19:00:00Z'},
  {id:'ucl_m46',md:3,home:'كومو',away:'مانشستر يونايتد',ko:'2026-10-21T16:45:00Z'},
  {id:'ucl_m47',md:3,home:'ليل',away:'غلطة سراي',ko:'2026-10-21T16:45:00Z'},
  {id:'ucl_m48',md:3,home:'أستون فيلا',away:'فايكينغ',ko:'2026-10-21T19:00:00Z'},
  {id:'ucl_m49',md:3,home:'كلوب بروج',away:'لانس',ko:'2026-10-21T19:00:00Z'},
  {id:'ucl_m50',md:3,home:'بايرن ميونخ',away:'أرسنال',ko:'2026-10-21T19:00:00Z'},
  {id:'ucl_m51',md:3,home:'إنتر ميلان',away:'شاختار دونيتسك',ko:'2026-10-21T19:00:00Z'},
  {id:'ucl_m52',md:3,home:'ريال مدريد',away:'لايبزيغ',ko:'2026-10-21T19:00:00Z'},
  {id:'ucl_m53',md:3,home:'ريال بيتيس',away:'فينورد',ko:'2026-10-21T19:00:00Z'},
  {id:'ucl_m54',md:3,home:'سبورتينغ لشبونة',away:'لاسك لينز',ko:'2026-10-21T19:00:00Z'},

  {id:'ucl_m55',md:4,home:'شاختار دونيتسك',away:'سبورتينغ لشبونة',ko:'2026-11-03T17:45:00Z'},
  {id:'ucl_m56',md:4,home:'غلطة سراي',away:'شتوتغارت',ko:'2026-11-03T17:45:00Z'},
  {id:'ucl_m57',md:4,home:'أتلتيكو مدريد',away:'بايرن ميونخ',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m58',md:4,home:'برشلونة',away:'أستون فيلا',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m59',md:4,home:'فينورد',away:'إنتر ميلان',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m60',md:4,home:'بودو غليمت',away:'ليل',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m61',md:4,home:'لاسك لينز',away:'سلوفان براتيسلافا',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m62',md:4,home:'مانشستر يونايتد',away:'روما',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m63',md:4,home:'فياريال',away:'باريس سان جيرمان',ko:'2026-11-03T20:00:00Z'},
  {id:'ucl_m64',md:4,home:'أ.إي.ك أثينا',away:'ريال مدريد',ko:'2026-11-04T17:45:00Z'},
  {id:'ucl_m65',md:4,home:'فنربخشة',away:'ليفربول',ko:'2026-11-04T17:45:00Z'},
  {id:'ucl_m66',md:4,home:'بوروسيا دورتموند',away:'ريال بيتيس',ko:'2026-11-04T20:00:00Z'},
  {id:'ucl_m67',md:4,home:'بورتو',away:'نابولي',ko:'2026-11-04T20:00:00Z'},
  {id:'ucl_m68',md:4,home:'بي إس في آيندهوفن',away:'كلوب بروج',ko:'2026-11-04T20:00:00Z'},
  {id:'ucl_m69',md:4,home:'لايبزيغ',away:'مانشستر سيتي',ko:'2026-11-04T20:00:00Z'},
  {id:'ucl_m70',md:4,home:'لانس',away:'كومو',ko:'2026-11-04T20:00:00Z'},
  {id:'ucl_m71',md:4,home:'سلافيا براغ',away:'أرسنال',ko:'2026-11-04T20:00:00Z'},
  {id:'ucl_m72',md:4,home:'فايكينغ',away:'سابح',ko:'2026-11-04T20:00:00Z'},

  {id:'ucl_m73',md:5,home:'بودو غليمت',away:'لاسك لينز',ko:'2026-11-24T17:45:00Z'},
  {id:'ucl_m74',md:5,home:'غلطة سراي',away:'أستون فيلا',ko:'2026-11-24T17:45:00Z'},
  {id:'ucl_m75',md:5,home:'أرسنال',away:'بوروسيا دورتموند',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m76',md:5,home:'كومو',away:'أ.إي.ك أثينا',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m77',md:5,home:'فينورد',away:'بورتو',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m78',md:5,home:'مانشستر سيتي',away:'نابولي',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m79',md:5,home:'لايبزيغ',away:'لانس',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m80',md:5,home:'ريال مدريد',away:'بي إس في آيندهوفن',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m81',md:5,home:'سلوفان براتيسلافا',away:'ريال بيتيس',ko:'2026-11-24T20:00:00Z'},
  {id:'ucl_m82',md:5,home:'سابح',away:'برشلونة',ko:'2026-11-25T17:45:00Z'},
  {id:'ucl_m83',md:5,home:'سلافيا براغ',away:'فياريال',ko:'2026-11-25T17:45:00Z'},
  {id:'ucl_m84',md:5,home:'أتلتيكو مدريد',away:'فايكينغ',ko:'2026-11-25T20:00:00Z'},
  {id:'ucl_m85',md:5,home:'كلوب بروج',away:'ليفربول',ko:'2026-11-25T20:00:00Z'},
  {id:'ucl_m86',md:5,home:'إنتر ميلان',away:'شتوتغارت',ko:'2026-11-25T20:00:00Z'},
  {id:'ucl_m87',md:5,home:'شاختار دونيتسك',away:'فنربخشة',ko:'2026-11-25T20:00:00Z'},
  {id:'ucl_m88',md:5,home:'ليل',away:'بايرن ميونخ',ko:'2026-11-25T20:00:00Z'},
  {id:'ucl_m89',md:5,home:'باريس سان جيرمان',away:'روما',ko:'2026-11-25T20:00:00Z'},
  {id:'ucl_m90',md:5,home:'سبورتينغ لشبونة',away:'مانشستر يونايتد',ko:'2026-11-25T20:00:00Z'},

  {id:'ucl_m91',md:6,home:'فايكينغ',away:'فينورد',ko:'2026-12-08T17:45:00Z'},
  {id:'ucl_m92',md:6,home:'فياريال',away:'سابح',ko:'2026-12-08T17:45:00Z'},
  {id:'ucl_m93',md:6,home:'أ.إي.ك أثينا',away:'غلطة سراي',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m94',md:6,home:'روما',away:'سبورتينغ لشبونة',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m95',md:6,home:'أستون فيلا',away:'باريس سان جيرمان',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m96',md:6,home:'برشلونة',away:'مانشستر سيتي',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m97',md:6,home:'بايرن ميونخ',away:'سلافيا براغ',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m98',md:6,home:'مانشستر يونايتد',away:'لايبزيغ',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m99',md:6,home:'نابولي',away:'كلوب بروج',ko:'2026-12-08T20:00:00Z'},
  {id:'ucl_m100',md:6,home:'ريال بيتيس',away:'كومو',ko:'2026-12-09T17:45:00Z'},
  {id:'ucl_m101',md:6,home:'سلوفان براتيسلافا',away:'شاختار دونيتسك',ko:'2026-12-09T17:45:00Z'},
  {id:'ucl_m102',md:6,home:'أرسنال',away:'ريال مدريد',ko:'2026-12-09T20:00:00Z'},
  {id:'ucl_m103',md:6,home:'بوروسيا دورتموند',away:'إنتر ميلان',ko:'2026-12-09T20:00:00Z'},
  {id:'ucl_m104',md:6,home:'لاسك لينز',away:'فنربخشة',ko:'2026-12-09T20:00:00Z'},
  {id:'ucl_m105',md:6,home:'ليفربول',away:'بورتو',ko:'2026-12-09T20:00:00Z'},
  {id:'ucl_m106',md:6,home:'بي إس في آيندهوفن',away:'أتلتيكو مدريد',ko:'2026-12-09T20:00:00Z'},
  {id:'ucl_m107',md:6,home:'لانس',away:'بودو غليمت',ko:'2026-12-09T20:00:00Z'},
  {id:'ucl_m108',md:6,home:'شتوتغارت',away:'ليل',ko:'2026-12-09T20:00:00Z'},

  {id:'ucl_m109',md:7,home:'بودو غليمت',away:'أتلتيكو مدريد',ko:'2027-01-19T17:45:00Z'},
  {id:'ucl_m110',md:7,home:'غلطة سراي',away:'فينورد',ko:'2027-01-19T17:45:00Z'},
  {id:'ucl_m111',md:7,home:'أ.إي.ك أثينا',away:'روما',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m112',md:7,home:'أستون فيلا',away:'بوروسيا دورتموند',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m113',md:7,home:'إنتر ميلان',away:'ليفربول',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m114',md:7,home:'بورتو',away:'سلافيا براغ',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m115',md:7,home:'ليل',away:'سلوفان براتيسلافا',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m116',md:7,home:'ريال مدريد',away:'لاسك لينز',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m117',md:7,home:'شتوتغارت',away:'كلوب بروج',ko:'2027-01-19T20:00:00Z'},
  {id:'ucl_m118',md:7,home:'فنربخشة',away:'فياريال',ko:'2027-01-20T17:45:00Z'},
  {id:'ucl_m119',md:7,home:'سابح',away:'نابولي',ko:'2027-01-20T17:45:00Z'},
  {id:'ucl_m120',md:7,home:'كومو',away:'باريس سان جيرمان',ko:'2027-01-20T20:00:00Z'},
  {id:'ucl_m121',md:7,home:'مانشستر يونايتد',away:'بايرن ميونخ',ko:'2027-01-20T20:00:00Z'},
  {id:'ucl_m122',md:7,home:'لايبزيغ',away:'شاختار دونيتسك',ko:'2027-01-20T20:00:00Z'},
  {id:'ucl_m123',md:7,home:'لانس',away:'مانشستر سيتي',ko:'2027-01-20T20:00:00Z'},
  {id:'ucl_m124',md:7,home:'ريال بيتيس',away:'أرسنال',ko:'2027-01-20T20:00:00Z'},
  {id:'ucl_m125',md:7,home:'سبورتينغ لشبونة',away:'برشلونة',ko:'2027-01-20T20:00:00Z'},
  {id:'ucl_m126',md:7,home:'فايكينغ',away:'بي إس في آيندهوفن',ko:'2027-01-20T20:00:00Z'},

  {id:'ucl_m127',md:8,home:'أرسنال',away:'سابح',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m128',md:8,home:'روما',away:'ليل',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m129',md:8,home:'أتلتيكو مدريد',away:'فنربخشة',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m130',md:8,home:'بوروسيا دورتموند',away:'أ.إي.ك أثينا',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m131',md:8,home:'كلوب بروج',away:'بودو غليمت',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m132',md:8,home:'بايرن ميونخ',away:'ريال بيتيس',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m133',md:8,home:'برشلونة',away:'كومو',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m134',md:8,home:'شاختار دونيتسك',away:'ريال مدريد',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m135',md:8,home:'فينورد',away:'لايبزيغ',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m136',md:8,home:'لاسك لينز',away:'بورتو',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m137',md:8,home:'ليفربول',away:'لانس',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m138',md:8,home:'مانشستر سيتي',away:'سبورتينغ لشبونة',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m139',md:8,home:'باريس سان جيرمان',away:'غلطة سراي',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m140',md:8,home:'بي إس في آيندهوفن',away:'شتوتغارت',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m141',md:8,home:'سلافيا براغ',away:'أستون فيلا',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m142',md:8,home:'نابولي',away:'فايكينغ',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m143',md:8,home:'فياريال',away:'مانشستر يونايتد',ko:'2027-01-27T20:00:00Z'},
  {id:'ucl_m144',md:8,home:'سلوفان براتيسلافا',away:'إنتر ميلان',ko:'2027-01-27T20:00:00Z'},
];

let DB = { users:{}, uclPredictions:{}, uclResults:{}, announcements:{} };
let currentUser = null;
let currentMD = 2; // أول جولة قابلة للتوقع

function now(){ return new Date(); }
// يستدعي مكتبة الأيقونات بعد كل تحديث للواجهة (Lucide يحتاج استدعاءً يدوياً بعد كل innerHTML جديد)
function paintIcons(){ if(window.lucide) lucide.createIcons(); }

async function loadDatabase(){
  const [u, p, r, msgs] = await Promise.all([fbGet('users'), fbGet('uclPredictions'), fbGet('uclResults'), fbGet('announcements')]);
  DB.users = u || {};
  DB.uclPredictions = p || {};
  DB.uclResults = r || {};
  DB.announcements = msgs || {};
  // نتائج الجولة الأولى الحقيقية — تُحفظ تلقائياً أول مرة (بلا توقعات، للعرض فقط)
  let needSave = false;
  MATCHES.forEach(m=>{
    if(m.resH!=null && !DB.uclResults[m.id]){
      DB.uclResults[m.id] = {h:m.resH, a:m.resA};
      needSave = true;
    }
  });
  if(needSave) fbPatch('uclResults', DB.uclResults);
}

// ════════════════════════════════════════════
// AUTH — نفس آلية الدخول المستخدمة بتطبيق الفانتزي (توافق كامل) — لم يتغيّر المنطق
// ════════════════════════════════════════════
function submitLogin(){
  const first = document.getElementById('loginFirstName').value.trim();
  const tribe = document.getElementById('loginTribeName').value.trim();
  if(!first || !tribe){ showToast('أدخل اسمك الأول والعائلة كاملين', 'warning'); return; }
  const userId = (first+'_'+tribe).toLowerCase().replace(/\s+/g,'_').replace(/[^\u0600-\u06FFa-z0-9_]/g,'');
  const isAdmin = false;
  let userObj = DB.users[userId];
  if(!userObj){
    userObj = { id:userId, name:`${first} ${tribe}`, isAdmin };
    DB.users[userId] = userObj;
    fbPatch(`users/${userId}`, userObj);
  }
  localStorage.setItem('ucl_azba_user', userId);
  currentUser = userObj;
  loginSuccess();
}

function showAdminLogin(){
  document.getElementById('authCard').innerHTML = `
    <div class="auth-logo-wrap" style="background:var(--card);display:flex;align-items:center;justify-content:center"><i data-lucide="shield" class="icon-lg" style="width:40px;height:40px;color:var(--gold)"></i></div>
    <h2 class="auth-title">دخول المشرف</h2>
    <div class="auth-season" style="margin-bottom:24px">لإدارة نتائج دوري الأبطال</div>
    <div class="field-group"><label class="field-label">اسم المستخدم</label><input class="fpl-input" id="adminUser"></div>
    <div class="field-group"><label class="field-label">كلمة المرور</label><input class="fpl-input" type="password" id="adminPass"></div>
    <button class="btn-primary" onclick="submitAdminLogin()"><i data-lucide="log-in" class="icon"></i> دخول</button>
    <button class="btn-secondary" onclick="location.reload()"><i data-lucide="arrow-right" class="icon-sm"></i> رجوع</button>
  `;
  paintIcons();
}
async function submitAdminLogin(){
  const u = document.getElementById('adminUser').value.trim();
  const p = document.getElementById('adminPass').value;
  if(!u || !p){ showToast('أدخل اسم المستخدم وكلمة المرور', 'warning'); return; }

  try{
    const bytes = new TextEncoder().encode(`${u}:${p}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const fingerprint = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const allowedFingerprint = '132a9ec6a54d270968b6c50b84adb40285d116e3d921d52fcbae986daced40e3';

    if(fingerprint === allowedFingerprint){
      const userId='admin_turki69';
      currentUser = { id:userId, name:'المشرف', isAdmin:true };
      DB.users[userId] = currentUser;
      fbPatch(`users/${userId}`, currentUser);
      localStorage.setItem('ucl_azba_user', userId);
      loginSuccess();
    } else {
      showToast('بيانات دخول خاطئة', 'error');
    }
  }catch(e){
    showToast('تعذر التحقق من بيانات الدخول', 'error');
  }
}

function checkSession(){
  const saved = localStorage.getItem('ucl_azba_user');
  if(saved && DB.users[saved]){ currentUser = DB.users[saved]; loginSuccess(); }
  else { document.getElementById('authOverlay').style.display='flex'; paintIcons(); }
}
function doLogout(){ localStorage.removeItem('ucl_azba_user'); location.reload(); }

function loginSuccess(){
  document.getElementById('authOverlay').style.display='none';
  document.getElementById('userBadge').textContent = currentUser.nickname || currentUser.name;
  if(currentUser.isAdmin){
    document.getElementById('adminBadge').style.display='inline-flex';
    document.getElementById('adminTabBtn').style.display='flex';
  }
  if(currentUser.themeColor) applyThemeColor(currentUser.themeColor);
  renderAll();
}

// ════════════════════════════════════════════
// PROFILE SETTINGS — لقب، لون ثيم شخصي، تفعيل التذكيرات — لم يتغيّر المنطق
// ════════════════════════════════════════════
const THEME_PRESETS = ['#22D3EE','#2563EB','#F5C542','#22C55E','#EF4444','#A855F7','#FF8C00','#EC4899'];
let _pendingThemeColor = null;

function applyThemeColor(hex){
  document.documentElement.style.setProperty('--cyan', hex);
}
function previewThemeColor(hex){
  _pendingThemeColor = hex;
  applyThemeColor(hex);
  document.getElementById('colorPreviewName').textContent = 'لونك الحالي: ' + hex;
  document.getElementById('colorPreviewName').style.color = hex;
}

function openProfileSettings(){
  document.getElementById('nicknameInp').value = currentUser.nickname || '';
  const currentColor = currentUser.themeColor || '#22D3EE';
  document.getElementById('colorPicker').value = currentColor;
  _pendingThemeColor = currentColor;
  document.getElementById('colorPreviewName').textContent = 'لونك الحالي: ' + currentColor;
  document.getElementById('colorPreviewName').style.color = currentColor;
  document.getElementById('colorSwatches').innerHTML = THEME_PRESETS.map(c=>
    `<button class="swatch" onclick="previewThemeColor('${c}');document.getElementById('colorPicker').value='${c}'" style="background:${c}" aria-label="لون ${c}"></button>`
  ).join('');
  document.getElementById('notifyToggle').checked = currentUser.notifyEnabled !== false;
  updateNotifyTrackUI();
  document.getElementById('profileOverlay').style.display='flex';
  paintIcons();
}
function closeProfileSettings(ev){ if(ev.target.id==='profileOverlay') closeProfileSettingsDirect(); }
function closeProfileSettingsDirect(){
  document.getElementById('profileOverlay').style.display='none';
  applyThemeColor(currentUser.themeColor || '#22D3EE');
}
function toggleNotifySwitch(){
  const cb = document.getElementById('notifyToggle');
  cb.checked = !cb.checked;
  updateNotifyTrackUI();
}
function updateNotifyTrackUI(){
  const on = document.getElementById('notifyToggle').checked;
  document.getElementById('notifyTrack').classList.toggle('on', on);
}

async function saveProfileSettings(){
  const nickname = document.getElementById('nicknameInp').value.trim();
  const notifyEnabled = document.getElementById('notifyToggle').checked;
  const themeColor = _pendingThemeColor || '#22D3EE';

  currentUser.nickname = nickname || null;
  currentUser.themeColor = themeColor;
  currentUser.notifyEnabled = notifyEnabled;
  DB.users[currentUser.id] = currentUser;

  await fbPatch(`users/${currentUser.id}`, currentUser);

  document.getElementById('userBadge').textContent = nickname || currentUser.name;
  applyThemeColor(themeColor);

  if(notifyEnabled && 'Notification' in window && Notification.permission==='default'){
    Notification.requestPermission();
  }

  document.getElementById('profileOverlay').style.display='none';
  showToast('تم حفظ إعداداتك', 'success');
  renderLeaderboard();
}

// ════════════════════════════════════════════
// SCORING — لم يتغيّر منطق الاحتساب إطلاقاً
// ════════════════════════════════════════════
function outcome(h,a){ return h>a?'h':a>h?'a':'d'; }
function pts(pred,res){
  if(!res||!pred) return null;
  if(pred.h===res.h && pred.a===res.a) return 3;
  if(outcome(pred.h,pred.a)===outcome(res.h,res.a)) return 1;
  return 0;
}
function totalPts(userId){
  const preds = DB.uclPredictions[userId] || {};
  let s = 0;
  Object.entries(preds).forEach(([mid,pred])=>{
    const res = DB.uclResults[mid];
    if(res){ const v=pts(pred,res); if(v!=null) s+=v; }
  });
  return s;
}

// ════════════════════════════════════════════
// RENDER — نظرة عامة
// ════════════════════════════════════════════
function renderAll(){
  renderDashboard();
  renderMdSelector();
  renderMatches();
  renderLeaderboard();
  if(currentUser.isAdmin) renderAdmin();
  paintIcons();
}

// ── لوحة معلومات المستخدم (جديد) — أرقام محسوبة من البيانات الفعلية فقط ──
function renderDashboard(){
  const el = document.getElementById('dashboardWrap');
  if(!el || currentUser.isAdmin) { if(el) el.innerHTML=''; return; }
  const myPreds = DB.uclPredictions[currentUser.id] || {};
  const savedCount = Object.keys(myPreds).length;
  const completedCount = Object.keys(DB.uclResults).length;
  const myPts = totalPts(currentUser.id);
  const mdMatches = MATCHES.filter(m=>m.md===currentMD);
  const mdSavedForCurrent = mdMatches.filter(m=>myPreds[m.id]).length;
  const pct = mdMatches.length ? Math.round((mdSavedForCurrent/mdMatches.length)*100) : 0;

  el.innerHTML = `
    <div class="dash-card">
      <div class="dash-greet"><i data-lucide="hand" class="icon"></i> مرحباً، ${(currentUser.nickname||currentUser.name).split(' ')[0]}</div>
      <div class="dash-sub">توقعاتك في دوري الأبطال</div>
      <div class="dash-stats">
        <div class="stat-cell"><span class="t-num">${savedCount}</span><span class="t-meta">توقع محفوظ</span></div>
        <div class="stat-cell"><span class="t-num">${completedCount}</span><span class="t-meta">مباراة مكتملة</span></div>
        <div class="stat-cell"><span class="t-num">${myPts}</span><span class="t-meta">نقاطك</span></div>
      </div>
      <div class="dash-progress">
        <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);font-weight:700">
          <span>توقعاتك بالجولة ${currentMD}</span><span>${mdSavedForCurrent}/${mdMatches.length}</span>
        </div>
        <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${pct}%"></div></div>
      </div>
    </div>`;
}

function renderMdSelector(){
  const el = document.getElementById('mdSelector');
  const mds = [1,2,3,4,5,6,7,8];
  el.innerHTML = mds.map(md=>{
    const mdMatches = MATCHES.filter(m=>m.md===md);
    const allDone = mdMatches.every(m=>DB.uclResults[m.id]);
    const cls = (md===currentMD?'active ':'') + (allDone?'md-done ':'');
    const icon = allDone ? '<i data-lucide="check-circle-2" class="md-icon"></i>' : (md===currentMD ? '<i data-lucide="circle-dot" class="md-icon"></i>' : '');
    return `<button class="md-btn ${cls}" onclick="setMD(${md})">${icon}<span class="md-num">جولة ${md}</span></button>`;
  }).join('');
  paintIcons();
}
function setMD(md){ currentMD=md; renderDashboard(); renderMdSelector(); renderMatches(); if(currentUser.isAdmin) renderAdmin(); paintIcons(); }

function matchStatus(m){
  const res = DB.uclResults[m.id];
  if(res) return 'done';
  const ko = new Date(m.ko);
  const openTime = new Date(ko.getTime() - 24*3600*1000);
  const lockTime = new Date(ko.getTime() - 3600*1000);
  if(now() >= lockTime) return 'locked';
  if(now() < openTime) return 'soon';
  return 'open';
}
function formatDT(iso){
  const d = new Date(new Date(iso).getTime() + 4*3600*1000); // توقيت مسقط (UTC+4)
  const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const hh = d.getUTCHours().toString().padStart(2,'0');
  const mm = d.getUTCMinutes().toString().padStart(2,'0');
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} · ${hh}:${mm}`;
}
// نص العد التنازلي المبسّط حتى إغلاق التوقع
function countdownText(lockTime){
  const diff = lockTime - now();
  if(diff<=0) return null;
  const totalMin = Math.floor(diff/60000);
  if(totalMin < 60) return `يُغلق التوقع بعد ${totalMin} دقيقة`;
  const hrs = Math.floor(totalMin/60), mins = totalMin%60;
  if(hrs < 24) return `يُغلق التوقع بعد ${hrs} س ${mins} د`;
  const days = Math.floor(hrs/24);
  return `يُغلق التوقع بعد ${days} يوم`;
}

function renderMatches(){
  const el = document.getElementById('matchesList');
  const list = MATCHES.filter(m=>m.md===currentMD);
  if(!list.length){
    el.innerHTML = `<div class="f-empty"><i data-lucide="calendar-x" class="icon-lg"></i><p>لا توجد مباريات في هذه الجولة</p><div class="t-meta">اختر جولة أخرى من الأعلى</div></div>`;
  } else {
    el.innerHTML = list.map(m=>buildMatchCard(m)).join('');
  }
  paintIcons();
}

// ── بطاقة مباراة (Component) ──
function buildStatusBadge(status){
  const map = {
    open:   {cls:'status-open',   icon:'circle-check', label:'مفتوح للتوقع'},
    locked: {cls:'status-locked', icon:'lock',          label:'أُغلق التوقع'},
    soon:   {cls:'status-soon',   icon:'hourglass',     label:'يُفتح قريباً'},
    done:   {cls:'status-done',   icon:'flag',          label:'انتهت المباراة'},
  };
  const s = map[status];
  return `<span class="status-pill ${s.cls}"><i data-lucide="${s.icon}" class="icon-sm"></i> ${s.label}</span>`;
}

function buildMatchCard(m){
  const status = matchStatus(m);
  const res = DB.uclResults[m.id];
  const myPred = DB.uclPredictions[currentUser.id]?.[m.id];
  const badge = buildStatusBadge(status);
  const scoreHTML = res ? `<div class="score-result">${res.h} - ${res.a}</div>` : `<span class="vs-chip">VS</span>`;

  let cdHTML = '';
  if(status==='open'){
    const lockTime = new Date(new Date(m.ko).getTime() - 3600*1000);
    const cd = countdownText(lockTime);
    if(cd) cdHTML = `<div class="countdown-txt"><i data-lucide="timer" class="icon-sm"></i> ${cd}</div>`;
  }

  let predHTML = '';
  if(status==='open'){
    const ph = myPred?.h ?? 0, pa = myPred?.a ?? 0;
    predHTML = `<div class="pred-zone">
      <div class="stepper-row">
        <div class="stepper" id="stepH_${m.id}"><button onclick="adj('${m.id}','h',-1)" aria-label="إنقاص">−</button><input class="score-num" type="number" inputmode="numeric" id="h_${m.id}" value="${ph}" min="0" max="15"><button onclick="adj('${m.id}','h',1)" aria-label="زيادة">+</button></div>
        <span class="dash-sep">–</span>
        <div class="stepper" id="stepA_${m.id}"><button onclick="adj('${m.id}','a',-1)" aria-label="إنقاص">−</button><input class="score-num" type="number" inputmode="numeric" id="a_${m.id}" value="${pa}" min="0" max="15"><button onclick="adj('${m.id}','a',1)" aria-label="زيادة">+</button></div>
      </div>
      <button class="save-btn" id="saveBtn_${m.id}" onclick="savePred('${m.id}',event)"><i data-lucide="check" class="icon-sm"></i> <span>حفظ التوقع</span></button>
    </div>`;
  } else if(myPred){
    const v = res ? pts(myPred,res) : null;
    let ptsBadge, extraRow='';
    if(res){
      if(v===3) ptsBadge = `<span class="pts-chip pts-3"><i data-lucide="target" class="icon-sm"></i> +3</span>`;
      else if(v===1) ptsBadge = `<span class="pts-chip pts-1"><i data-lucide="check" class="icon-sm"></i> +1</span>`;
      else ptsBadge = `<span class="pts-chip pts-0"><i data-lucide="x" class="icon-sm"></i> 0</span>`;
      extraRow = `<div class="compare-row"><span class="t-meta">النتيجة الحقيقية</span><span class="t-num" style="font-size:.9rem">${res.h} - ${res.a}</span></div>`;
    } else {
      ptsBadge = `<span class="pts-chip pts-pending"><i data-lucide="lock" class="icon-sm"></i> سري</span>`;
    }
    predHTML = `<div class="pred-zone">
      <div class="my-pred-box">
        <div class="result-compare" style="flex:1">
          ${extraRow}
          <div class="compare-row"><span class="pred-label-row"><i data-lucide="check-circle" class="icon-sm"></i> توقعك</span><span class="pred-score-big">${myPred.h} - ${myPred.a}</span></div>
        </div>
        ${ptsBadge}
      </div>
    </div>`;
  } else if(status==='soon'){
    predHTML = `<div class="pred-zone"><div class="no-pred-note"><i data-lucide="hourglass" class="icon-sm"></i> يُفتح التوقع تلقائياً قبل الموعد بـ24 ساعة</div></div>`;
  } else if(status!=='open'){
    predHTML = `<div class="pred-zone"><div class="no-pred-note"><i data-lucide="minus-circle" class="icon-sm"></i> لم تُدخل توقعاً لهذه المباراة</div></div>`;
  }

  return `<div class="match-card status-${status}" id="card-${m.id}">
    <div class="match-card-top">
      <div class="match-time-wrap"><i data-lucide="calendar" class="icon-sm"></i><span class="t-meta">${formatDT(m.ko)}</span></div>
      ${badge}
    </div>
    <div class="match-card-body">
      <div class="teams-row">
        <div class="team-col">${clubBadge(m.home)}<div class="team-name-wrap"><span class="t-team">${m.home}</span></div></div>
        <div class="vs-col">${scoreHTML}${cdHTML}</div>
        <div class="team-col">${clubBadge(m.away)}<div class="team-name-wrap"><span class="t-team">${m.away}</span></div></div>
      </div>
      ${predHTML}
    </div>
  </div>`;
}

function adj(id,side,d){
  const i = document.getElementById(side+'_'+id);
  if(!i) return;
  i.value = Math.max(0, Math.min(15, (+i.value||0)+d));
  const wrap = document.getElementById((side==='h'?'stepH_':'stepA_')+id);
  if(wrap){ wrap.classList.remove('pulse'); void wrap.offsetWidth; wrap.classList.add('pulse'); }
}

async function savePred(id, ev){
  const btn = document.getElementById('saveBtn_'+id);
  const label = btn?.querySelector('span');
  if(btn){ btn.disabled=true; if(label) label.textContent='جارٍ الحفظ...'; }
  const h = Math.max(0, +document.getElementById('h_'+id).value||0);
  const a = Math.max(0, +document.getElementById('a_'+id).value||0);
  if(!DB.uclPredictions[currentUser.id]) DB.uclPredictions[currentUser.id]={};
  DB.uclPredictions[currentUser.id][id] = {h,a};
  const ok = await fbPatch(`uclPredictions/${currentUser.id}`, DB.uclPredictions[currentUser.id]);
  const m = MATCHES.find(x=>x.id===id);
  if(ok){
    showToast(`تم حفظ توقعك: ${m.home} ${h}-${a} ${m.away}`, 'success');
    if(btn){ btn.classList.add('success'); if(label) label.textContent='تم الحفظ'; }
    renderDashboard();
    setTimeout(()=>{ const card=document.getElementById('card-'+id); if(card) card.outerHTML = buildMatchCard(m); paintIcons(); const nc=document.getElementById('card-'+id); if(nc) nc.querySelector('.my-pred-box')?.classList.add('saved-flash'); }, 550);
  } else {
    showToast('تعذّر الحفظ — حاول مرة أخرى', 'error');
    if(btn){ btn.disabled=false; btn.classList.add('error'); if(label) label.textContent='تعذّر الحفظ — حاول مرة أخرى'; setTimeout(()=>{ btn.classList.remove('error'); if(label) label.textContent='حفظ التوقع'; },2000); }
  }
}

// ════════════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════════════
function buildLeaderboardRow(p, rank){
  const rankBadge = rank<=3 ? '' : `<span class="lb-rank-num">${rank}</span>`;
  const isMe = p.id===currentUser.id;
  return `<div class="lb-row ${isMe?'me':''}" style="animation-delay:${Math.min((rank-1)*30,300)}ms">
    ${rankBadge || `<span class="lb-rank-num">${rank}</span>`}
    <div class="lb-info"><span class="lb-name">${isMe?'<i data-lucide="star" class="icon-sm lb-me-star"></i> ':''}${p.name}</span></div>
    <span class="lb-pts">${p.pts}</span>
  </div>`;
}
function renderLeaderboard(){
  const players = Object.values(DB.users).filter(u=>!u.isAdmin)
    .map(u=>({id:u.id, name:u.nickname||u.name, pts:totalPts(u.id)}))
    .sort((a,b)=>b.pts-a.pts);

  const heroEl = document.getElementById('lbHeroWrap');
  const podiumEl = document.getElementById('podiumWrap');
  const listEl = document.getElementById('lbList');

  if(!players.length){
    heroEl.innerHTML=''; podiumEl.innerHTML='';
    listEl.innerHTML = `<div class="f-empty"><i data-lucide="users" class="icon-lg"></i><p>لا يوجد مشاركون حتى الآن</p></div>`;
    paintIcons(); return;
  }

  if(!currentUser.isAdmin){
    const myRank = players.findIndex(p=>p.id===currentUser.id)+1;
    const myPts = totalPts(currentUser.id);
    heroEl.innerHTML = myRank>0 ? `
      <div class="lb-hero">
        <i data-lucide="trophy" class="icon-lg"></i>
        <div class="lb-hero-title">مركزك الحالي</div>
        <div class="lb-hero-rank">#${myRank}</div>
        <div class="lb-hero-pts">${myPts} نقطة</div>
      </div>` : '';
  } else { heroEl.innerHTML=''; }

  const top3 = players.slice(0,3);
  const rest = players.slice(3);
  const order = top3.length===3 ? [1,0,2] : top3.map((_,i)=>i); // المركز الأول بالمنتصف بصرياً
  podiumEl.innerHTML = top3.length ? `<div class="podium">${order.map(i=>{
    const p = top3[i]; if(!p) return '';
    const rank=i+1;
    return `<div class="podium-card p${rank}"><div class="podium-rank-badge">${rank}</div><div class="podium-name">${p.name}</div><div class="podium-pts">${p.pts}</div></div>`;
  }).join('')}</div>` : '';

  listEl.innerHTML = rest.map((p,i)=>buildLeaderboardRow(p, i+4)).join('');
  paintIcons();
}

// ════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════
function buildStatCard(icon, value, label){
  return `<div class="admin-stat-card"><i data-lucide="${icon}" class="icon" style="color:var(--muted)"></i><span class="t-num">${value}</span><div class="t-meta">${label}</div></div>`;
}
function renderAdmin(){
  const totalUsers = Object.keys(DB.users).filter(u=>!DB.users[u].isAdmin).length;
  const totalMD = MATCHES.filter(m=>m.md===currentMD).length;
  const doneMD = MATCHES.filter(m=>m.md===currentMD && DB.uclResults[m.id]).length;
  const totalPreds = Object.values(DB.uclPredictions).reduce((s,p)=>s+Object.keys(p).length,0);

  document.getElementById('adminStatsGrid').innerHTML =
    buildStatCard('users', totalUsers, 'مشاركون') +
    buildStatCard('goal', `${doneMD}/${totalMD}`, `نتائج الجولة ${currentMD}`) +
    buildStatCard('list-checks', totalPreds, 'إجمالي التوقعات') +
    buildStatCard('calendar', MATCHES.length, 'إجمالي المباريات');

  const list = MATCHES.filter(m=>m.md===currentMD);
  document.getElementById('adminMatches').innerHTML = list.map(m=>{
    const r = DB.uclResults[m.id];
    return `<div class="admin-match-row">
      <div class="admin-match-title">${r?`<span class="result-badge">${r.h}-${r.a}</span>`:''}${clubBadge(m.home,22)} ${m.home} <span style="color:var(--muted-dim)">vs</span> ${m.away} ${clubBadge(m.away,22)}</div>
      <div class="admin-score-row">
        <input class="admin-inp" type="number" id="ah_${m.id}" value="${r?.h??''}" min="0" placeholder="0">
        <span style="color:var(--muted)">-</span>
        <input class="admin-inp" type="number" id="aa_${m.id}" value="${r?.a??''}" min="0" placeholder="0">
        <button class="btn-admin" onclick="adminSaveResult('${m.id}')"><i data-lucide="save" class="icon-sm"></i> حفظ</button>
      </div>
    </div>`;
  }).join('');

  renderAdminUsers();
  renderAdminMessages();
  paintIcons();
}

function renderAdminUsers(){
  const participants = Object.entries(DB.users).filter(([id,u])=>!u.isAdmin);
  const el = document.getElementById('adminUsers');
  if(!participants.length){ el.innerHTML = `<div class="t-meta" style="text-align:center;padding:12px">لا يوجد مشاركون مسجّلون بعد</div>`; return; }
  el.innerHTML = participants.map(([id,u])=>{
    const p = totalPts(id);
    return `<div class="admin-user-row">
      <div><div class="t-card-title">${u.name}</div><div class="t-meta">${p} نقطة</div></div>
      <button class="btn-admin btn-danger" onclick="adminDeleteUser('${id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
    </div>`;
  }).join('');
}

async function adminDeleteUser(userId){
  const u = DB.users[userId];
  if(!u) return;
  if(!confirm(`حذف "${u.name}" نهائياً مع كل توقعاته؟ لا يمكن التراجع!`)) return;
  delete DB.users[userId];
  delete DB.uclPredictions[userId];
  await Promise.all([
    fetch(`${FB_URL}/users/${userId}.json`, {method:'DELETE'}),
    fetch(`${FB_URL}/uclPredictions/${userId}.json`, {method:'DELETE'}),
  ]);
  showToast(`تم حذف ${u.name}`, 'success');
  renderAdminUsers(); renderLeaderboard();
}

// محاولة جلب النتائج تلقائياً — بأفضل جهد فقط (مصدر غير موثّق رسمياً) — لم يتغيّر المنطق
async function autoFetchResults(){
  const btn = document.getElementById('autoFetchBtn');
  btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="icon-sm"></i> جارٍ المحاولة...'; paintIcons();
  const pending = MATCHES.filter(m=>m.md===currentMD && !DB.uclResults[m.id]);
  if(!pending.length){ showToast('كل نتائج هذه الجولة مُدخلة بالفعل', 'info'); btn.disabled=false; btn.innerHTML='<i data-lucide="refresh-cw" class="icon-sm"></i> محاولة جلب النتائج تلقائياً'; paintIcons(); return; }

  let found = 0, tried = 0;
  for(const m of pending){
    const slug = CLUB_EN[m.home];
    if(!slug) continue;
    tried++;
    try{
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), 3500);
      const r = await fetch(`https://sportscore.com/api/widget/team/?sport=football&slug=${slug}&limit=10&src=ucl-azba-app`, {signal:controller.signal});
      clearTimeout(timer);
      if(!r.ok) continue;
      const data = await r.json();
      const fixtures = data.fixtures || data.matches || data.data || [];
      const awayEn = CLUB_EN[m.away];
      const match = fixtures.find(fx=>{
        const homeN = (fx.home_team?.name || fx.homeTeam?.name || fx.home?.name || fx.home_team_name || '').toLowerCase();
        const awayN = (fx.away_team?.name || fx.awayTeam?.name || fx.away?.name || fx.away_team_name || '').toLowerCase();
        const st = (fx.status || fx.state || '').toLowerCase();
        const isFinished = st.includes('finish') || st.includes('ft') || st.includes('ended');
        return isFinished && (awayEn && (homeN.includes(awayEn.split('-')[0])||awayN.includes(awayEn.split('-')[0])));
      });
      if(match){
        const hs = match.score?.home ?? match.home_score ?? match.scores?.home ?? null;
        const as = match.score?.away ?? match.away_score ?? match.scores?.away ?? null;
        if(hs!=null && as!=null){
          const hInp = document.getElementById('ah_'+m.id), aInp = document.getElementById('aa_'+m.id);
          if(hInp && aInp){ hInp.value = hs; aInp.value = as; hInp.style.borderColor='var(--green)'; aInp.style.borderColor='var(--green)'; found++; }
        }
      }
    }catch(e){ /* تجاهل صامت — لا نكسر بقية المحاولات */ }
  }
  btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw" class="icon-sm"></i> محاولة جلب النتائج تلقائياً'; paintIcons();
  if(found>0) showToast(`وُجدت ${found} نتيجة محتملة — راجعها واضغط حفظ لكل مباراة`, 'success');
  else showToast(`لم تُوجد نتائج جاهزة الآن (${tried} محاولة) — أدخل يدوياً`, 'info');
}

async function adminSaveResult(id){
  const h = parseInt(document.getElementById('ah_'+id).value);
  const a = parseInt(document.getElementById('aa_'+id).value);
  if(isNaN(h)||isNaN(a)||h<0||a<0){ showToast('أدخل نتيجة صحيحة', 'warning'); return; }
  DB.uclResults[id] = {h,a};
  await fbPatch('uclResults', {[id]:{h,a}});
  showToast('تم حفظ النتيجة', 'success');
  renderAdmin(); renderMatches(); renderLeaderboard(); renderMdSelector();
}

// ════════════════════════════════════════════
// رسائل الإدارة — بث رسائل لكل المشاركين (يُحفظ بقاعدة البيانات؛ الإرسال كإشعار خارجي حقيقي يحتاج بنية خلفية منفصلة لاحقاً)
// ════════════════════════════════════════════
async function sendAdminMessage(){
  const title = document.getElementById('msgTitleInp').value.trim();
  const body = document.getElementById('msgBodyInp').value.trim();
  if(!body){ showToast('اكتب نص الرسالة أولاً', 'warning'); return; }
  const id = 'msg_' + Date.now();
  const msg = { title: title||'رسالة من الإدارة', body, ts: Date.now(), from: currentUser.name };
  DB.announcements[id] = msg;
  await fbPatch('announcements', {[id]: msg});
  document.getElementById('msgTitleInp').value='';
  document.getElementById('msgBodyInp').value='';
  showToast('تم حفظ الرسالة', 'success');
  renderAdminMessages();
}
function renderAdminMessages(){
  const el = document.getElementById('adminMessagesList');
  if(!el) return;
  const list = Object.entries(DB.announcements||{}).sort((a,b)=>b[1].ts-a[1].ts);
  if(!list.length){ el.innerHTML = `<div class="t-meta">لا توجد رسائل مُرسلة بعد</div>`; return; }
  el.innerHTML = list.map(([id,m])=>`
    <div class="admin-match-row" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div><div class="t-card-title">${m.title}</div><div class="t-meta" style="margin-top:2px">${m.body}</div></div>
      <button class="btn-admin btn-danger" style="flex-shrink:0" onclick="deleteAdminMessage('${id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
    </div>`).join('');
  paintIcons();
}
async function deleteAdminMessage(id){
  if(!confirm('حذف هذه الرسالة؟')) return;
  delete DB.announcements[id];
  await fetch(`${FB_URL}/announcements/${id}.json`, {method:'DELETE'});
  renderAdminMessages();
}

// ════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════
function showTab(tab, btn){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  if(btn) btn.classList.add('active');
}
const TOAST_ICON = {success:'check-circle', error:'x-circle', warning:'alert-triangle', info:'info'};
function showToast(msg, type){
  type = type || 'info';
  const t = document.getElementById('toast');
  t.className = 't-'+type;
  t.innerHTML = `<i data-lucide="${TOAST_ICON[type]}" class="icon-sm"></i><span>${msg}</span>`;
  paintIcons();
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(()=>t.classList.remove('show'), 3200);
}

// ════════════════════════════════════════════
// تذكيرات محلية — فتح/إغلاق التوقعات (لم يتغيّر المنطق)
// صادق: تعمل فقط طالما المتصفح مفتوحاً بالخلفية — ليست دفعاً حقيقياً للهاتف المغلق تماماً
// ════════════════════════════════════════════
function alreadyNotified(key){
  const seen = JSON.parse(localStorage.getItem('ucl_notified')||'[]');
  return seen.includes(key);
}
function markNotified(key){
  const seen = JSON.parse(localStorage.getItem('ucl_notified')||'[]');
  seen.push(key);
  if(seen.length>300) seen.splice(0, seen.length-300);
  localStorage.setItem('ucl_notified', JSON.stringify(seen));
}
function fireNotification(title, body){
  if('Notification' in window && Notification.permission==='granted'){
    try{ new Notification(title, {body, icon:'ucl-icon-192.png'}); }catch(e){}
  }
}
function checkReminders(){
  if(!currentUser || currentUser.notifyEnabled===false) return;
  const t = now();
  MATCHES.forEach(m=>{
    if(DB.uclResults[m.id]) return;
    const ko = new Date(m.ko);
    const openTime = new Date(ko.getTime() - 24*3600*1000);
    const lockTime = new Date(ko.getTime() - 3600*1000);
    if(t>=openTime && t < new Date(openTime.getTime()+10*60000)){
      const key = `open_${m.id}`;
      if(!alreadyNotified(key)){ fireNotification('فُتح التوقع الآن', `${m.home} ضد ${m.away} — لديك 24 ساعة للتوقع`); markNotified(key); }
    }
    const warnTime = new Date(lockTime.getTime() - 15*60000);
    if(t>=warnTime && t<lockTime){
      const key = `close_${m.id}`;
      if(!alreadyNotified(key)){ fireNotification('التوقع يُغلق قريباً', `${m.home} ضد ${m.away} — أمامك 15 دقيقة فقط`); markNotified(key); }
    }
  });
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadDatabase();
  checkSession();
  document.getElementById('loadingOverlay').style.display='none';
  checkReminders();
  setInterval(checkReminders, 5*60*1000);
  setInterval(async ()=>{ await loadDatabase(); renderDashboard(); renderMatches(); renderLeaderboard(); renderMdSelector(); if(currentUser?.isAdmin) renderAdmin(); paintIcons(); }, 60*1000);
});
