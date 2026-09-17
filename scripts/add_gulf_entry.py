from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
needle='    <button class="tab-btn" id="adminTabBtn" style="display:none" onclick="showTab(\'admin\',this)"><i data-lucide="shield" class="icon-sm"></i> الإدارة</button>'
insert='    <button class="tab-btn" onclick="location.href=\'gulf.html\'" style="color:#28d5a0"><i data-lucide="trophy" class="icon-sm"></i> خليجي 27</button>\n'+needle
if 'gulf.html' not in s:
    if needle not in s: raise SystemExit('navigation anchor not found')
    s=s.replace(needle,insert)
    s=s.replace('<meta name="app-version" content="3.5-prediction-alerts">','<meta name="app-version" content="3.6-gulf-cup">')
    p.write_text(s,encoding='utf-8')
