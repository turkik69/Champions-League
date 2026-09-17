from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'gulf-embed.css' not in s:
    s=s.replace('<link rel="stylesheet" href="ucl-identity.css">','<link rel="stylesheet" href="ucl-identity.css">\n<link rel="stylesheet" href="gulf-embed.css?v=1">')
s=s.replace("onclick=\"location.href='gulf.html'\"","onclick=\"openGulfCup()\"")
if 'gulf-embed.js' not in s:
    s=s.replace('<script src="push.js"></script>','<script src="push.js"></script>\n<script src="gulf-embed.js?v=1"></script>')
p.write_text(s,encoding='utf-8')

p=Path('gulf.html')
s=p.read_text(encoding='utf-8')
s=s.replace("onclick=\"location.href='index.html'\"","onclick=\"window.parent && window.parent!==window && window.parent.closeGulfCup ? window.parent.closeGulfCup() : location.href='index.html'\"")
p.write_text(s,encoding='utf-8')
