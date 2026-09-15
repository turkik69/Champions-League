from pathlib import Path
import re
import json

ROOT = Path(__file__).resolve().parents[1]
index_path = ROOT / "index.html"
styles_path = ROOT / "styles.css"
app_path = ROOT / "app.js"
manifest_path = ROOT / "ucl-manifest.json"

html = index_path.read_text(encoding="utf-8")

style_match = re.search(r"<style>(.*?)</style>", html, re.S)
if not style_match:
    raise SystemExit("Inline <style> block not found")

inline_scripts = list(re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S | re.I))
if not inline_scripts:
    raise SystemExit("Inline <script> block not found")
script_match = inline_scripts[-1]

base_css = style_match.group(1).strip() + "\n"
app_js = script_match.group(1).strip() + "\n"

# Security hardening for a static-only deployment:
# 1) regular name login can never self-promote to admin
app_js = app_js.replace(
    "const isAdmin = (userId.includes('admin') || userId.includes('turki69'));",
    "const isAdmin = false;"
)

# 2) remove plaintext admin credentials from source and compare a SHA-256 fingerprint instead.
# This hides the plaintext but is NOT equivalent to server-side authentication.
admin_re = re.compile(r"function submitAdminLogin\(\)\{.*?\n\}\n\nfunction checkSession", re.S)
admin_fn = r'''async function submitAdminLogin(){
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

function checkSession'''
app_js, n = admin_re.subn(admin_fn, app_js, count=1)
if n != 1:
    raise SystemExit("Admin login function replacement failed")

# Modern V2 visual layer. Existing class names are retained so all application logic keeps working.
v2_css = r'''

/* ======================================================================
   V2 VISUAL REFRESH — mobile-first Champions League experience
   ====================================================================== */
:root{
  --navy:#050816;
  --navy2:#0a1026;
  --card:#0e1733;
  --card-el:#142044;
  --blue:#3b5cff;
  --cyan:#55dcff;
  --gold:#f6c453;
  --text:#f7f9ff;
  --muted:#9aa8c7;
  --muted-dim:#65728f;
  --border:rgba(255,255,255,.085);
  --border-strong:rgba(255,255,255,.16);
  --r-md:16px;
  --r-lg:20px;
  --r-xl:28px;
}

body{
  background:
    radial-gradient(900px 460px at 50% -100px, rgba(69,91,255,.28), transparent 62%),
    radial-gradient(620px 380px at 100% 18%, rgba(85,220,255,.08), transparent 68%),
    linear-gradient(180deg,#050816 0%,#071027 55%,#050816 100%);
  background-attachment:fixed;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:-1;opacity:.35;
  background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.12) 1px,transparent 0);
  background-size:28px 28px;
  mask-image:linear-gradient(to bottom,#000,transparent 55%);
}

header{
  background:linear-gradient(180deg,rgba(5,8,22,.94),rgba(5,8,22,.76));
  border-bottom:1px solid rgba(255,255,255,.06);
  box-shadow:0 12px 36px rgba(0,0,0,.18);
}
.header-inner{padding:13px 18px}
.brand img{width:38px;height:38px;border-radius:12px;box-shadow:0 8px 20px rgba(59,92,255,.25)}
.brand-text h1{font-size:.98rem;letter-spacing:.1px}
.brand-text p{color:#7f91bb}
.icon-btn{background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.085);backdrop-filter:blur(10px)}
.icon-btn:hover{color:#fff;background:rgba(255,255,255,.09)}

main{padding-top:20px}
.dash-card{
  position:relative;overflow:hidden;
  background:
    radial-gradient(420px 210px at 100% 0%,rgba(85,220,255,.12),transparent 60%),
    linear-gradient(145deg,rgba(27,43,91,.96),rgba(12,20,47,.96));
  border-color:rgba(117,140,255,.2);
  box-shadow:0 18px 45px rgba(0,0,0,.28);
}
.dash-card::after{content:'';position:absolute;inset:auto -35px -75px auto;width:180px;height:180px;border-radius:50%;border:30px solid rgba(255,255,255,.025);pointer-events:none}
.dash-greet{font-size:1.16rem}
.dash-sub{color:var(--muted);margin-bottom:18px}
.dash-stats{gap:8px}
.stat-cell{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.055);border-radius:16px;padding:12px 8px}
.stat-cell .t-num{font-size:1.22rem}
.prog-bar-track{height:7px;background:rgba(255,255,255,.07)}
.prog-bar-fill{background:linear-gradient(90deg,var(--blue),var(--cyan));box-shadow:0 0 18px rgba(85,220,255,.28)}

.match-card{
  background:linear-gradient(160deg,rgba(19,31,66,.94),rgba(10,17,40,.96));
  border:1px solid rgba(255,255,255,.085);
  box-shadow:0 12px 28px rgba(0,0,0,.22);
  border-radius:24px;
  overflow:hidden;
  transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;
}
.match-card:hover{transform:translateY(-2px);border-color:rgba(85,220,255,.18);box-shadow:0 18px 35px rgba(0,0,0,.28)}
.match-card-top{background:rgba(255,255,255,.025);border-bottom:1px solid rgba(255,255,255,.055)}
.match-card-body{padding-top:18px}
.team-col{gap:8px}
.club-crest{box-shadow:0 7px 18px rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.2)!important}
.vs-chip{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);padding:5px 10px;border-radius:999px;color:var(--muted)}
.score-result{font-size:1.7rem;letter-spacing:2px;text-shadow:0 5px 20px rgba(0,0,0,.3)}
.status-pill{border-radius:999px;padding:5px 9px}
.pred-zone{margin-top:16px;border-top:1px solid rgba(255,255,255,.055);padding-top:15px}
.stepper{background:#080f24;border:1px solid rgba(255,255,255,.09);border-radius:16px;overflow:hidden}
.stepper button{background:rgba(255,255,255,.045)}
.score-num{font-size:1.2rem}
.save-btn{border-radius:14px;background:linear-gradient(135deg,#4264ff,#2c49d8);box-shadow:0 8px 20px rgba(59,92,255,.26)}
.save-btn:active{transform:scale(.98)}
.countdown-txt{color:#a8b8dd;background:rgba(255,255,255,.04);border-radius:999px;padding:4px 8px}

.md-selector{scroll-snap-type:x proximity;padding-bottom:7px}
.md-btn{scroll-snap-align:start;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035);border-radius:14px}
.md-btn.active{background:linear-gradient(135deg,#4264ff,#2c49d8);border-color:transparent;box-shadow:0 8px 22px rgba(59,92,255,.25)}

.lb-hero{
  background:radial-gradient(420px 160px at 50% -30%,rgba(246,196,83,.2),transparent 68%),linear-gradient(160deg,#172347,#0d1732);
  border:1px solid rgba(246,196,83,.2);border-radius:26px;box-shadow:0 15px 36px rgba(0,0,0,.25)
}
.podium-card,.lb-row{background:linear-gradient(155deg,rgba(20,32,68,.94),rgba(10,17,39,.94));border-color:rgba(255,255,255,.075)}
.lb-row.me{border-color:rgba(85,220,255,.3);background:linear-gradient(155deg,rgba(23,47,87,.98),rgba(10,24,49,.96))}

.auth-card{max-width:410px;background:rgba(10,16,38,.58);border:1px solid rgba(255,255,255,.08);border-radius:30px;padding:28px 24px;backdrop-filter:blur(18px);box-shadow:0 28px 70px rgba(0,0,0,.38)}
.auth-logo-wrap{width:96px;height:96px;border-radius:28px}
.auth-title{font-size:1.55rem}
.fpl-input{background:rgba(6,12,30,.72);border-color:rgba(255,255,255,.1);border-radius:15px}
.btn-primary{border-radius:15px;background:linear-gradient(135deg,#4567ff,#2947d4)}
.modal-sheet{background:linear-gradient(180deg,#111b3a,#0a122b);border-color:rgba(255,255,255,.1)}

.admin-section{background:linear-gradient(160deg,rgba(18,29,63,.96),rgba(10,17,39,.96));border-color:rgba(255,255,255,.075);border-radius:22px}
.admin-match-row,.admin-user-row{background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.06)}

#toast{background:#101a37;border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 45px rgba(0,0,0,.35)}

/* Mobile app navigation */
@media(max-width:760px){
  header{position:sticky;top:0}
  header .tabs{
    position:fixed;z-index:220;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));
    max-width:none;margin:0;padding:7px;
    border:1px solid rgba(255,255,255,.1);
    background:rgba(8,13,31,.9);backdrop-filter:blur(20px) saturate(150%);
    border-radius:21px;box-shadow:0 16px 45px rgba(0,0,0,.42);
    justify-content:space-around;overflow:visible;
  }
  .tab-btn{flex:1;min-width:0;padding:8px 4px;min-height:48px;border-radius:15px;flex-direction:column;gap:2px;font-size:.62rem}
  .tab-btn .icon{width:19px;height:19px;vertical-align:0}
  .tab-btn.active{background:linear-gradient(145deg,rgba(70,101,255,.95),rgba(43,70,211,.95));box-shadow:0 7px 18px rgba(59,92,255,.28)}
  main{padding:15px 13px calc(100px + env(safe-area-inset-bottom,0px))}
  .header-inner{padding-inline:14px}
  .brand-text p{display:none}
  .dash-card{padding:18px;border-radius:24px}
  .match-card{border-radius:22px}
  .match-card-body{padding-inline:13px}
  .team-name-wrap{max-width:110px}
  .t-team{font-size:.79rem}
}

@media(min-width:761px){
  .tabs{padding-bottom:12px}
  main{padding-top:22px}
  .match-card{max-width:760px;margin-inline:auto}
}
'''

styles_path.write_text(base_css + v2_css, encoding="utf-8")
app_path.write_text(app_js, encoding="utf-8")

# Replace inline blocks with external assets.
new_html = html[:style_match.start()] + '<link rel="stylesheet" href="styles.css">' + html[style_match.end():]
# Re-find inline script after the style replacement because offsets changed.
new_inline_scripts = list(re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", new_html, re.S | re.I))
if not new_inline_scripts:
    raise SystemExit("Inline script missing after style extraction")
last = new_inline_scripts[-1]
new_html = new_html[:last.start()] + '<script src="app.js"></script>' + new_html[last.end():]

# Add a V2 marker for easy diagnosis in production.
new_html = new_html.replace('</head>', '<meta name="app-version" content="2.0-redesign">\n</head>', 1)
index_path.write_text(new_html, encoding="utf-8")

# Fix PWA start URL to the actual entry point.
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["start_url"] = "./"
    manifest["scope"] = "./"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("V2 refactor complete: index.html + styles.css + app.js + manifest fix")
