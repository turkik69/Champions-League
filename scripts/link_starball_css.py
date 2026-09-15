from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
link='<link rel="stylesheet" href="starball.css">'
if link not in s:
    marker='<link rel="stylesheet" href="styles.css">'
    if marker not in s:
        raise SystemExit('styles.css link not found')
    s=s.replace(marker, marker+'\n'+link, 1)
p.write_text(s, encoding='utf-8')
print('starball.css linked')
