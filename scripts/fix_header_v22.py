from pathlib import Path

root = Path(__file__).resolve().parents[1]
index = root/'index.html'
styles = root/'styles.css'
app = root/'app.js'

html = index.read_text(encoding='utf-8')
css = styles.read_text(encoding='utf-8')
js = app.read_text(encoding='utf-8')

# Prevent iPhone standalone mode from drawing app UI under the status bar.
html = html.replace('content="black-translucent"', 'content="black"')

# Add optional licensed splash audio. Browsers may require first interaction before playback.
if 'id="appIntroAudio"' not in html:
    html = html.replace('<div id="toast"></div>', '''<div id="toast"></div>\n\n<!-- Optional licensed intro audio: place assets/intro.mp3 in the repo -->\n<audio id="appIntroAudio" preload="auto" playsinline>\n  <source src="assets/intro.mp3" type="audio/mpeg">\n</audio>''')

# Add a more visible label beside the Champions League logo.
html = html.replace('<span class="brand-mark"><img', '<span class="brand-mark ucl-brand-mark"><img')

patch = r'''

/* ======================================================================
   V2.2 — iPhone safe-area / clearer header / stronger UCL branding
   ====================================================================== */
header{
  background:linear-gradient(180deg,rgba(5,8,22,.995),rgba(8,14,34,.985)) !important;
  -webkit-backdrop-filter:none !important;
  backdrop-filter:none !important;
  padding-top:max(env(safe-area-inset-top,0px),10px) !important;
  min-height:104px;
  box-shadow:0 8px 30px rgba(0,0,0,.28);
}
.header-inner{
  min-height:74px;
  padding:14px 18px 12px !important;
}
.brand{gap:13px !important;overflow:visible}
.ucl-brand-mark{
  width:58px;height:58px;min-width:58px;
  display:grid;place-items:center;
  border-radius:17px;
  background:#fff;
  border:1px solid rgba(255,255,255,.85);
  box-shadow:0 8px 24px rgba(0,0,0,.32),0 0 0 4px rgba(255,255,255,.055);
  overflow:hidden;
}
.ucl-brand-mark img{
  width:49px !important;height:49px !important;
  object-fit:contain !important;
  border-radius:0 !important;
  filter:contrast(1.2) saturate(1.05);
}
.brand-text h1{font-size:1.08rem !important;line-height:1.25 !important}
.brand-text p{font-size:.72rem !important;margin-top:3px}
.header-actions{gap:8px !important}
.icon-btn{width:41px !important;height:41px !important;background:rgba(255,255,255,.075) !important}

/* Keep the header content comfortably below Dynamic Island/status bar. */
@supports (padding-top: env(safe-area-inset-top)){
  body{padding-top:0}
  header{top:0}
}

/* Make the official mark highly visible on the login screen too. */
.ucl-official-mark{
  width:112px !important;height:112px !important;
  padding:12px !important;background:#fff !important;
  border-radius:30px !important;
  box-shadow:0 18px 50px rgba(0,0,0,.38),0 0 40px rgba(91,110,255,.22) !important;
}
.ucl-official-mark img{object-fit:contain !important;filter:contrast(1.2)}

@media(max-width:760px){
  header{min-height:112px}
  .header-inner{min-height:80px;padding:14px 14px 13px !important}
  .ucl-brand-mark{width:60px;height:60px;min-width:60px}
  .ucl-brand-mark img{width:51px !important;height:51px !important}
  .brand-text h1{font-size:1.02rem !important;max-width:180px}
  .brand-text p{display:block !important;font-size:.67rem !important}
}
'''
if 'V2.2 — iPhone safe-area' not in css:
    css += patch

intro_js = r'''

// Optional opening sound. Add a licensed file at assets/intro.mp3.
// iOS may block autoplay; if so it plays once on the user's first tap.
function tryPlayIntroAudio(){
  const audio = document.getElementById('appIntroAudio');
  if(!audio || sessionStorage.getItem('ucl_intro_played')==='1') return;
  audio.volume = 0.32;
  const p = audio.play();
  if(p && typeof p.then === 'function'){
    p.then(()=>sessionStorage.setItem('ucl_intro_played','1')).catch(()=>{});
  }
}
window.addEventListener('load', ()=>setTimeout(tryPlayIntroAudio, 350));
document.addEventListener('pointerdown', function playIntroOnce(){
  tryPlayIntroAudio();
  if(sessionStorage.getItem('ucl_intro_played')==='1') document.removeEventListener('pointerdown', playIntroOnce);
}, {passive:true});
'''
if 'function tryPlayIntroAudio' not in js:
    js += intro_js

index.write_text(html, encoding='utf-8')
styles.write_text(css, encoding='utf-8')
app.write_text(js, encoding='utf-8')
print('V2.2 header patch applied')
