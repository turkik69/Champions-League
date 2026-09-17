from pathlib import Path

html_path = Path('gulf.html')
css_path = Path('gulf.css')

html = html_path.read_text(encoding='utf-8')
html = html.replace('''  <nav class="gulf-tabs">
    <button class="gulf-tab active" data-tab="matches"><i data-lucide="calendar-days"></i><span>المباريات</span></button>
    <button class="gulf-tab" data-tab="groups"><i data-lucide="table-2"></i><span>المجموعات</span></button>
    <button class="gulf-tab" data-tab="teams"><i data-lucide="shield"></i><span>المنتخبات</span></button>
    <button class="gulf-tab" data-tab="ranking"><i data-lucide="trophy"></i><span>التوقعات</span></button>
  </nav>''','''  <nav class="gulf-tabs">
    <button class="gulf-tab active" data-tab="matches"><i data-lucide="calendar-days"></i><span>المباريات</span></button>
    <button class="gulf-tab" data-tab="groups"><i data-lucide="table-2"></i><span>المجموعات</span></button>
    <button class="gulf-tab" data-tab="teams"><i data-lucide="shield"></i><span>المنتخبات</span></button>
    <button class="gulf-tab" data-tab="ranking"><i data-lucide="trophy"></i><span>الترتيب</span></button>
    <button class="gulf-tab" data-tab="news"><i data-lucide="newspaper"></i><span>الأخبار</span></button>
  </nav>''')
html = html.replace('''        <div><span class="kicker">المباريات المؤكدة</span><h2>بداية المشوار</h2></div>''','''        <div><span class="kicker">الجدول الكامل</span><h2>مباريات خليجي 27</h2></div>''')
html = html.replace('''      <div class="notice-card"><i data-lucide="info"></i><span>بدأنا بالمواجهات المنشورة رسميًا، وسيتم استكمال جميع مباريات البطولة فور تثبيت الجدول الكامل من المصدر الرسمي.</span></div>''','''      <div class="notice-card"><i data-lucide="info"></i><span>الجدول يشمل دور المجموعات ونصف النهائي والنهائي. التوقعات تفتح تلقائيًا قبل كل مباراة بـ24 ساعة وتغلق قبلها بـ30 دقيقة.</span></div>''')
old = '''    <section class="tab-pane" id="tab-ranking">
      <div class="section-head"><div><span class="kicker">تحدي خليجي 27</span><h2>توقعاتك</h2></div></div>
      <div class="stats-row">
        <div class="stat-card"><strong id="myPredictions">0</strong><span>توقعاتي</span></div>
        <div class="stat-card"><strong id="openPredictions">0</strong><span>متاحة الآن</span></div>
        <div class="stat-card"><strong>3</strong><span>نقاط للنتيجة</span></div>
      </div>
      <div class="rules-card">
        <h3><i data-lucide="target"></i> نفس نظام دوري الأبطال</h3>
        <p>3 نقاط للنتيجة الدقيقة، ونقطة واحدة لتوقع الفائز أو التعادل. يُفتح التوقع قبل المباراة بـ24 ساعة ويُغلق قبل الانطلاق بـ30 دقيقة.</p>
      </div>
    </section>'''
new = '''    <section class="tab-pane" id="tab-ranking">
      <div class="section-head"><div><span class="kicker">تحدي خليجي 27</span><h2>ترتيب المتسابقين</h2></div></div>
      <div class="stats-row">
        <div class="stat-card"><strong id="myPredictions">0</strong><span>توقعاتي</span></div>
        <div class="stat-card"><strong id="openPredictions">0</strong><span>متاحة الآن</span></div>
        <div class="stat-card"><strong>3</strong><span>نقاط للنتيجة</span></div>
      </div>
      <div id="rankingList" class="ranking-list"></div>
      <div class="rules-card">
        <h3><i data-lucide="target"></i> نفس نظام دوري الأبطال</h3>
        <p>3 نقاط للنتيجة الدقيقة، ونقطة واحدة لتوقع الفائز أو التعادل. يُفتح التوقع قبل المباراة بـ24 ساعة ويُغلق قبل الانطلاق بـ30 دقيقة.</p>
      </div>
    </section>

    <section class="tab-pane" id="tab-news">
      <div class="section-head"><div><span class="kicker">آخر المستجدات</span><h2>أخبار خليجي 27</h2></div><div class="live-badge">تحديث تلقائي</div></div>
      <div id="newsList" class="news-list"></div>
    </section>'''
html = html.replace(old, new)
html = html.replace('gulf.css?v=1','gulf.css?v=2').replace('gulf.js?v=1','gulf.js?v=2')
html_path.write_text(html, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
css = css.replace('grid-template-columns:repeat(4,1fr)','grid-template-columns:repeat(5,1fr)')
append = '''
.stand-head,.stand-row{display:grid;grid-template-columns:minmax(0,1fr) 34px 44px 34px;gap:6px;align-items:center}.stand-head{padding:8px 0;color:var(--muted);font-size:.66rem;border-bottom:1px solid var(--line)}.stand-row{padding:10px 0;border-bottom:1px solid var(--line);font-size:.76rem}.stand-row:last-child{border-bottom:0}.stand-row>span:first-child{display:flex;align-items:center;gap:6px;min-width:0}.stand-row b{color:var(--muted);font-size:.68rem}.stand-row .mini-flag{font-size:1rem}.stand-row strong{color:var(--green);text-align:center}.final-score{font-size:1.25rem;font-weight:900;color:var(--green);background:#e6f4ef;border-radius:12px;padding:6px 10px}.ranking-list,.news-list{display:grid;gap:10px;margin-bottom:14px}.rank-row{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px 14px}.rank-row.me{border-color:rgba(11,107,79,.35);box-shadow:0 0 0 2px rgba(11,107,79,.06)}.rank-no{width:28px;height:28px;border-radius:10px;background:#e9f4f0;color:var(--green);display:grid;place-items:center;font-weight:900;font-size:.78rem}.rank-name strong{display:block;font-size:.82rem}.rank-name small{display:block;color:var(--muted);font-size:.66rem;margin-top:2px}.rank-pts{color:var(--green);font-size:.88rem}.news-card{display:block;text-decoration:none;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:0 10px 24px rgba(14,54,43,.06)}.news-card strong{display:block;font-size:.86rem;line-height:1.7;margin:4px 0}.news-card small,.news-source{font-size:.66rem;color:var(--muted)}.news-source{color:var(--green2);font-weight:800}.empty-state{background:var(--card);border:1px dashed rgba(11,107,79,.24);border-radius:18px;padding:22px;text-align:center;color:var(--muted);font-size:.78rem}
@media(max-width:560px){.gulf-tabs{overflow-x:auto;grid-template-columns:repeat(5,minmax(64px,1fr))}.gulf-tab{font-size:.62rem}}
'''
if '.ranking-list' not in css:
    css += append
css_path.write_text(css, encoding='utf-8')
