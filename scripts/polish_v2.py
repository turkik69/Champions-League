from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app = ROOT / 'app.js'
css = ROOT / 'styles.css'
html = ROOT / 'index.html'

js = app.read_text(encoding='utf-8')
styles = css.read_text(encoding='utf-8')
page = html.read_text(encoding='utf-8')

club_meta = r'''const CLUB_META = {
  'أ.إي.ك أثينا':{id:'50129',abbr:'AEK',c1:'#FFCC00',c2:'#111111'},
  'لاسك لينز':{id:'63405',abbr:'LASK',c1:'#111111',c2:'#FFFFFF'},
  'كلوب بروج':{id:'50043',abbr:'CLB',c1:'#005CA9',c2:'#111111'},
  'أستون فيلا':{id:'52683',abbr:'AVL',c1:'#670E36',c2:'#95BFE5'},
  'بوروسيا دورتموند':{id:'52758',abbr:'BVB',c1:'#FDE100',c2:'#111111'},
  'فياريال':{id:'70691',abbr:'VIL',c1:'#FFE667',c2:'#005187'},
  'بورتو':{id:'50064',abbr:'FCP',c1:'#00428C',c2:'#FFFFFF'},
  'مانشستر سيتي':{id:'52919',abbr:'MCI',c1:'#6CABDD',c2:'#FFFFFF'},
  'ليل':{id:'75797',abbr:'LOSC',c1:'#D71920',c2:'#172B4D'},
  'ريال بيتيس':{id:'52265',abbr:'BET',c1:'#00954C',c2:'#FFFFFF'},
  'ريال مدريد':{id:'50051',abbr:'RMA',c1:'#FFFFFF',c2:'#FEBE10'},
  'إنتر ميلان':{id:'50138',abbr:'INT',c1:'#0057B8',c2:'#111111'},
  'برشلونة':{id:'50080',abbr:'BAR',c1:'#A50044',c2:'#004D98'},
  'فينورد':{id:'52749',abbr:'FEY',c1:'#E31B23',c2:'#FFFFFF'},
  'شتوتغارت':{id:'50107',abbr:'VFB',c1:'#E32219',c2:'#FFFFFF'},
  'فايكينغ':{id:'52319',abbr:'VIK',c1:'#00205B',c2:'#FFFFFF'},
  'ليفربول':{id:'7889',abbr:'LIV',c1:'#C8102E',c2:'#00B2A9'},
  'أتلتيكو مدريد':{id:'50124',abbr:'ATM',c1:'#CB3524',c2:'#272E61'},
  'باريس سان جيرمان':{id:'52747',abbr:'PSG',c1:'#004170',c2:'#DA291C'},
  'سلوفان براتيسلافا':{id:'52797',abbr:'SLB',c1:'#5DBFEB',c2:'#FFFFFF'},
  'سبورتينغ لشبونة':{id:'50149',abbr:'SCP',c1:'#008A3B',c2:'#FFFFFF'},
  'غلطة سراي':{id:'50067',abbr:'GAL',c1:'#A90432',c2:'#FDB912'},
  'نابولي':{id:'50136',abbr:'NAP',c1:'#12A0D7',c2:'#FFFFFF'},
  'أرسنال':{id:'52280',abbr:'ARS',c1:'#EF0107',c2:'#FFFFFF'},
  'فنربخشة':{id:'52692',abbr:'FB',c1:'#FFED00',c2:'#002D72'},
  'روما':{id:'50137',abbr:'ROM',c1:'#8E1F2F',c2:'#F0BC42'},
  'بي إس في آيندهوفن':{id:'50062',abbr:'PSV',c1:'#ED1C24',c2:'#FFFFFF'},
  'شاختار دونيتسك':{id:'52707',abbr:'SHK',c1:'#F36F21',c2:'#111111'},
  'كومو':{id:'79946',abbr:'COM',c1:'#1F5FA8',c2:'#FFFFFF'},
  'لايبزيغ':{id:'2603790',abbr:'RBL',c1:'#DD0741',c2:'#001E69'},
  'بايرن ميونخ':{id:'50037',abbr:'FCB',c1:'#DC052D',c2:'#0066B2'},
  'بودو غليمت':{id:'59333',abbr:'BOD',c1:'#FFDD00',c2:'#111111'},
  'مانشستر يونايتد':{id:'52682',abbr:'MUN',c1:'#DA291C',c2:'#FBE122'},
  'سابح':{id:'2609356',abbr:'SAB',c1:'#0E3A73',c2:'#FFFFFF'},
  'سلافيا براغ':{id:'52498',abbr:'SLA',c1:'#D71920',c2:'#FFFFFF'},
  'لانس':{id:'52277',abbr:'RCL',c1:'#FFD100',c2:'#C8102E'},
};

function clubBadge(name, size){
  const m = CLUB_META[name] || {id:null,abbr:'—',c1:'#27304f',c2:'#ffffff'};
  const s = size || 50;
  if(!m.id){
    return `<span class="club-crest crest-fallback" style="width:${s}px;height:${s}px;--team-a:${m.c1};--team-b:${m.c2}">${m.abbr}</span>`;
  }
  const src = `https://img.uefa.com/imgml/TP/teams/logos/70x70/${m.id}.png`;
  return `<span class="club-crest crest-real" style="width:${s}px;height:${s}px;--team-a:${m.c1};--team-b:${m.c2}"><img src="${src}" alt="شعار ${name}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="crest-fallback-text">${m.abbr}</span></span>`;
}'''

pattern = re.compile(r"const CLUB_BADGE = \{.*?\n\};\nfunction clubBadge\(name, size\)\{.*?\n\}", re.S)
js, count = pattern.subn(club_meta, js, count=1)
if count != 1:
    raise SystemExit('Could not replace CLUB_BADGE block')

# Add competition metadata used in dashboard and cards.
if "const UCL_COMPETITION" not in js:
    anchor = "const FB_URL = 'https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app';"
    js = js.replace(anchor, anchor + "\nconst UCL_COMPETITION = { season:'2026/27', name:'UEFA Champions League', identity:'Kick of Light' };", 1)

# Enhance dashboard with an official-identity competition eyebrow.
js = js.replace(
    '<div class="dash-greet"><i data-lucide="hand" class="icon"></i> مرحباً، ${(currentUser.nickname||currentUser.name).split(\' \')[0]}</div>',
    '<div class="ucl-eyebrow"><span class="ucl-star">✦</span> UEFA Champions League · 2026/27</div><div class="dash-greet"><i data-lucide="hand" class="icon"></i> مرحباً، ${(currentUser.nickname||currentUser.name).split(\' \')[0]}</div>',
    1
)

# Add team color variables to match cards for subtle club-specific accents.
needle = "return `<div class=\"match-card status-${status}\" id=\"card-${m.id}\">"
replace = "const hm = CLUB_META[m.home] || {}; const am = CLUB_META[m.away] || {};\n  return `<div class=\"match-card status-${status}\" id=\"card-${m.id}\" style=\"--home-color:${hm.c1||'#3b5cff'};--away-color:${am.c1||'#55dcff'}\">"
js = js.replace(needle, replace, 1)

# Official competition logo: Wikimedia's SVG rendering of the unchanged UEFA Champions League logo.
logo_url = 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/UEFA_Champions_League.svg/512px-UEFA_Champions_League.svg.png'
page = page.replace('<div class="auth-logo-wrap"><img src="ucl-icon-512.png" alt="دوري الأبطال"></div>',
                    f'<div class="auth-logo-wrap ucl-official-mark"><img src="{logo_url}" alt="UEFA Champions League"></div>', 1)
page = page.replace('<img src="ucl-icon-192.png" alt="دوري الأبطال">',
                    f'<span class="brand-mark"><img src="{logo_url}" alt="UEFA Champions League"></span>', 1)
page = page.replace('<div class="footer-credit">بيانات النتائج التلقائية عبر <a href="https://sportscore.com/" rel="dofollow">SportScore</a></div>',
                    '<div class="footer-credit">بيانات النتائج التلقائية عبر <a href="https://sportscore.com/" rel="dofollow">SportScore</a><br><span class="footer-note">مشروع توقعات مستقل وغير تابع للاتحاد الأوروبي لكرة القدم UEFA.</span></div>', 1)

polish_css = r'''

/* ======================================================================
   V2.1 — UEFA Champions League “Kick of Light” inspired polish
   Uses the competition's established night-blue base with prism accents.
   ====================================================================== */
:root{
  --ucl-night:#08082f;
  --ucl-deep:#101044;
  --ucl-blue:#2743ff;
  --ucl-violet:#7657ff;
  --ucl-cyan:#00d8ff;
  --ucl-magenta:#e03cff;
  --ucl-white:#ffffff;
  --navy:#08082f;
  --navy2:#101044;
  --blue:#2743ff;
  --cyan:#00d8ff;
}

body{
  background:
    radial-gradient(780px 430px at 10% -5%,rgba(224,60,255,.16),transparent 62%),
    radial-gradient(850px 470px at 92% 0%,rgba(0,216,255,.15),transparent 62%),
    radial-gradient(1000px 520px at 50% 105%,rgba(39,67,255,.13),transparent 70%),
    linear-gradient(180deg,#08082f 0%,#090d32 48%,#05071e 100%);
}

body::after{
  content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.48;
  background:
    linear-gradient(118deg,transparent 0 43%,rgba(255,255,255,.018) 43% 44%,transparent 44% 100%),
    linear-gradient(62deg,transparent 0 67%,rgba(0,216,255,.018) 67% 68%,transparent 68% 100%);
}

header{background:rgba(8,8,47,.82);backdrop-filter:blur(18px) saturate(150%)}
.brand-mark{width:46px;height:46px;border-radius:14px;background:#fff;display:grid;place-items:center;padding:5px;box-shadow:0 8px 24px rgba(0,0,0,.25),0 0 0 1px rgba(255,255,255,.2)}
.brand-mark img{width:100%;height:100%;object-fit:contain;border-radius:0;box-shadow:none}
.auth-logo-wrap.ucl-official-mark{width:132px;height:104px;border-radius:22px;background:#fff;padding:12px;box-shadow:0 20px 50px rgba(0,0,0,.35),0 0 40px rgba(118,87,255,.2)}
.auth-logo-wrap.ucl-official-mark img{object-fit:contain}

.ucl-eyebrow{display:flex;align-items:center;gap:6px;font-size:.68rem;font-weight:800;color:#bcc7ff;letter-spacing:.2px;margin-bottom:8px;text-transform:uppercase}
.ucl-star{color:var(--ucl-cyan);filter:drop-shadow(0 0 8px rgba(0,216,255,.55))}

.dash-card{border-color:rgba(118,87,255,.25);background:
  radial-gradient(480px 200px at 100% 0%,rgba(0,216,255,.13),transparent 60%),
  radial-gradient(420px 230px at 0% 100%,rgba(224,60,255,.11),transparent 65%),
  linear-gradient(145deg,rgba(24,27,83,.98),rgba(9,13,50,.98));
}

.club-crest{position:relative;display:grid;place-items:center;border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(238,242,255,.92));border:1px solid rgba(255,255,255,.32)!important;box-shadow:0 8px 20px rgba(0,0,0,.28),0 0 0 3px color-mix(in srgb,var(--team-a) 18%,transparent);overflow:hidden;padding:6px}
.club-crest img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 5px rgba(0,0,0,.18))}
.crest-fallback-text{display:none;width:100%;height:100%;place-items:center;border-radius:10px;background:linear-gradient(135deg,var(--team-a),var(--team-b));color:#fff;font-weight:900;font-size:.68rem;text-shadow:0 1px 2px rgba(0,0,0,.45)}
.crest-fallback{background:linear-gradient(135deg,var(--team-a),var(--team-b));color:#fff;font-weight:900;padding:0}

.match-card{position:relative}
.match-card::before{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(180deg,var(--home-color),transparent 45%,var(--away-color));opacity:.75}
.match-card::after{content:'';position:absolute;left:12%;right:12%;top:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--ucl-cyan),var(--ucl-magenta),transparent);opacity:.28}
.match-card-top{padding-block:11px}
.teams-row{align-items:center}
.team-col{min-width:0}
.team-name-wrap{min-height:34px;display:grid;place-items:center}
.t-team{line-height:1.25;text-align:center}
.score-result,.pred-score-big,.score-num{direction:ltr;font-variant-numeric:tabular-nums}

.status-open{box-shadow:inset 0 0 0 1px rgba(0,216,255,.02)}
.status-pill.status-open{color:#78f0ff;background:rgba(0,216,255,.09);border-color:rgba(0,216,255,.18)}
.status-pill.status-done{color:#c8d2f8;background:rgba(118,87,255,.1);border-color:rgba(118,87,255,.2)}

.md-btn.active{background:linear-gradient(135deg,var(--ucl-blue),var(--ucl-violet));box-shadow:0 8px 24px rgba(39,67,255,.28)}
.save-btn,.btn-primary{background:linear-gradient(135deg,var(--ucl-blue),#4f46e5 55%,var(--ucl-violet));box-shadow:0 9px 24px rgba(39,67,255,.28)}

.lb-hero{background:
  radial-gradient(450px 180px at 50% -25%,rgba(246,196,83,.22),transparent 70%),
  radial-gradient(360px 220px at 100% 100%,rgba(224,60,255,.08),transparent 70%),
  linear-gradient(155deg,#17184f,#0c1036)}
.podium-card.p1{border-color:rgba(246,196,83,.35);box-shadow:0 14px 36px rgba(246,196,83,.08)}

.auth-card{background:linear-gradient(160deg,rgba(16,16,68,.72),rgba(6,8,35,.76));border-color:rgba(126,139,255,.16)}

.footer-note{opacity:.65;font-size:.62rem}

@media(max-width:760px){
  .brand-mark{width:40px;height:40px;border-radius:12px}
  .match-card-body{padding-top:16px}
  .club-crest{border-radius:14px}
  .teams-row{gap:7px}
  .tab-btn.active{background:linear-gradient(145deg,var(--ucl-blue),var(--ucl-violet))}
}
'''

if 'V2.1 — UEFA Champions League' not in styles:
    styles += polish_css

app.write_text(js, encoding='utf-8')
css.write_text(styles, encoding='utf-8')
html.write_text(page, encoding='utf-8')
print('Applied V2.1 polish and real UEFA club crests')
