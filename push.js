// UCL direct push notifications — Firebase Cloud Messaging (FCM)
// Works independently of Supabase and keeps the current Realtime Database setup.
(function(){
  const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/11.10.0';
  let mergedConfig = null;
  let messaging = null;
  let serviceWorkerRegistration = null;
  let modulesPromise = null;
  let foregroundBound = false;

  function getUser(){
    try{ return (typeof currentUser !== 'undefined') ? currentUser : null; }catch(e){ return null; }
  }

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function supportsPush(){
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function configured(c){
    return !!(c && c.apiKey && c.projectId && c.messagingSenderId && c.appId && c.vapidKey);
  }

  async function loadPublicConfig(){
    if(mergedConfig) return mergedConfig;
    const base = Object.assign({}, window.UCL_PUSH_CONFIG || {});
    try{
      const path = base.publicConfigPath || 'pushPublicConfig';
      const db = base.databaseURL || (typeof FB_URL !== 'undefined' ? FB_URL : '');
      if(db){
        const r = await fetch(`${db}/${path}.json`, {cache:'no-store'});
        if(r.ok){
          const remote = await r.json();
          if(remote && typeof remote === 'object') Object.assign(base, remote);
        }
      }
    }catch(e){}
    mergedConfig = base;
    return base;
  }

  async function loadModules(){
    if(!modulesPromise){
      modulesPromise = Promise.all([
        import(`${FIREBASE_CDN}/firebase-app.js`),
        import(`${FIREBASE_CDN}/firebase-messaging.js`)
      ]);
    }
    return modulesPromise;
  }

  async function registerServiceWorker(){
    if(serviceWorkerRegistration) return serviceWorkerRegistration;
    serviceWorkerRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {scope:'./'});
    await navigator.serviceWorker.ready;
    return serviceWorkerRegistration;
  }

  async function getMessagingClient(){
    if(messaging) return messaging;
    const cfg = await loadPublicConfig();
    if(!configured(cfg)) throw new Error('PUSH_CONFIG_INCOMPLETE');
    const [appMod,msgMod] = await loadModules();
    let app;
    try{ app = appMod.getApp(); }catch(e){ app = appMod.initializeApp(cfg); }
    messaging = msgMod.getMessaging(app);
    if(!foregroundBound){
      msgMod.onMessage(messaging, payload=>{
        const title = payload?.notification?.title || payload?.data?.title || 'توقعاتي';
        const body = payload?.notification?.body || payload?.data?.body || 'لديك إشعار جديد';
        if(typeof showToast === 'function') showToast(`${title}: ${body}`, 'info');
      });
      foregroundBound = true;
    }
    return {client:messaging, mod:msgMod, cfg};
  }

  async function tokenKey(token){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function saveToken(token){
    const cfg = await loadPublicConfig();
    const user = getUser();
    if(!cfg.databaseURL || !token || !user || user.isAdmin) return;
    const key = await tokenKey(token);
    const record = {
      token,
      userId: String(user.id || ''),
      name: String(user.nickname || user.name || ''),
      enabled: true,
      platform: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios-webapp' : 'web',
      updatedAt: Date.now()
    };
    await fetch(`${cfg.databaseURL}/uclPushTokens/${key}.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(record)
    });
    localStorage.setItem('ucl_push_token_key', key);
  }

  async function disableSavedToken(){
    const cfg = await loadPublicConfig();
    const key = localStorage.getItem('ucl_push_token_key');
    if(!key || !cfg.databaseURL) return;
    try{
      await fetch(`${cfg.databaseURL}/uclPushTokens/${key}.json`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({enabled:false,updatedAt:Date.now()})
      });
    }catch(e){}
  }

  async function enablePushNotifications(){
    const btn = document.getElementById('pushEnableBtn');
    try{
      if(btn){ btn.disabled=true; btn.textContent='جارٍ التفعيل...'; }
      if(!supportsPush()) throw new Error('UNSUPPORTED');
      const cfg = await loadPublicConfig();
      if(!configured(cfg)) throw new Error('PUSH_CONFIG_INCOMPLETE');
      if(/iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalone()) throw new Error('IOS_INSTALL_REQUIRED');
      const permission = await Notification.requestPermission();
      if(permission !== 'granted') throw new Error('PERMISSION_DENIED');
      const reg = await registerServiceWorker();
      const {client,mod} = await getMessagingClient();
      const token = await mod.getToken(client, {vapidKey:cfg.vapidKey, serviceWorkerRegistration:reg});
      if(!token) throw new Error('NO_TOKEN');
      await saveToken(token);
      localStorage.setItem('ucl_push_enabled','1');
      updatePushUI();
      hidePrompt();
      if(typeof showToast === 'function') showToast('تم تفعيل الإشعارات المباشرة بنجاح', 'success');
    }catch(e){
      const code = e?.message || '';
      let msg='تعذر تفعيل الإشعارات حالياً';
      if(code==='IOS_INSTALL_REQUIRED') msg='ثبّت التطبيق على الشاشة الرئيسية أولاً ثم فعّل الإشعارات من داخله';
      else if(code==='PERMISSION_DENIED') msg='تم رفض إذن الإشعارات من الجهاز';
      else if(code==='PUSH_CONFIG_INCOMPLETE') msg='نظام الإشعارات جاهز داخل التطبيق وبانتظار إكمال ربط Firebase Messaging';
      else if(code==='UNSUPPORTED') msg='هذا الجهاز أو المتصفح لا يدعم الإشعارات المباشرة';
      if(typeof showToast === 'function') showToast(msg, 'warning');
      updatePushUI(code);
    }finally{
      if(btn) btn.disabled=false;
    }
  }

  async function disablePushNotifications(){
    await disableSavedToken();
    localStorage.removeItem('ucl_push_enabled');
    updatePushUI();
    if(typeof showToast === 'function') showToast('تم إيقاف الإشعارات المباشرة لهذا الجهاز', 'info');
  }

  async function updatePushUI(forceCode){
    const status = document.getElementById('pushStatusText');
    const btn = document.getElementById('pushEnableBtn');
    if(!status || !btn) return;
    const cfg = await loadPublicConfig();
    if(!supportsPush()){
      status.textContent='غير مدعوم على هذا الجهاز'; btn.style.display='none'; return;
    }
    if(!configured(cfg)){
      status.textContent='جاهز داخل التطبيق — بانتظار إكمال ربط Firebase Messaging';
      btn.textContent='إعداد الإشعارات';
      return;
    }
    if(Notification.permission==='granted' && localStorage.getItem('ucl_push_enabled')==='1'){
      status.textContent='الإشعارات المباشرة مفعّلة على هذا الجهاز';
      btn.textContent='إيقاف الإشعارات';
      btn.onclick=disablePushNotifications;
      btn.classList.add('push-disable');
    }else{
      status.textContent='استقبل رسائل المشرف والتنبيهات حتى والتطبيق مغلق';
      btn.textContent='تفعيل الإشعارات المباشرة';
      btn.onclick=enablePushNotifications;
      btn.classList.remove('push-disable');
    }
  }

  function injectStyles(){
    if(document.getElementById('pushStyles')) return;
    const s=document.createElement('style'); s.id='pushStyles';
    s.textContent=`
      .push-panel{margin:16px 0;padding:14px;border:1px solid rgba(137,152,255,.25);border-radius:18px;background:linear-gradient(145deg,rgba(17,35,103,.72),rgba(6,18,70,.78));}
      .push-panel-head{display:flex;align-items:center;gap:8px;font-weight:800;margin-bottom:5px}.push-panel-status{font-size:.76rem;color:#aebcf1;line-height:1.7;margin-bottom:10px}
      .push-enable-btn{width:100%;min-height:44px;border:0;border-radius:14px;color:#fff;font:inherit;font-weight:800;background:linear-gradient(105deg,#3157ff,#7a28ff,#df2ad9);cursor:pointer}.push-enable-btn:disabled{opacity:.55}.push-enable-btn.push-disable{background:rgba(255,255,255,.08);border:1px solid rgba(160,175,255,.22)}
      #pushPrompt{position:fixed;z-index:210;right:14px;left:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:470px;margin:auto;padding:13px 14px;border-radius:18px;background:rgba(5,17,68,.96);border:1px solid rgba(158,137,255,.38);box-shadow:0 18px 55px rgba(0,0,35,.55);backdrop-filter:blur(18px);display:flex;align-items:center;gap:10px;direction:rtl}
      #pushPrompt .pp-copy{flex:1}#pushPrompt .pp-title{font-weight:800;font-size:.88rem}#pushPrompt .pp-sub{font-size:.7rem;color:#abb9ea;margin-top:2px}#pushPrompt button{border:0;border-radius:12px;padding:9px 12px;color:white;font-weight:800;background:linear-gradient(105deg,#3157ff,#d92bda)}#pushPrompt .pp-close{background:transparent;color:#aab7e5;padding:6px;font-size:1rem}
    `;
    document.head.appendChild(s);
  }

  function injectProfilePanel(){
    const sheet=document.querySelector('#profileOverlay .modal-sheet');
    if(!sheet || document.getElementById('pushPanel')) return;
    const panel=document.createElement('div'); panel.id='pushPanel'; panel.className='push-panel';
    panel.innerHTML=`<div class="push-panel-head">🔔 الإشعارات المباشرة</div><div id="pushStatusText" class="push-panel-status">جارٍ التحقق...</div><button id="pushEnableBtn" type="button" class="push-enable-btn">تفعيل الإشعارات المباشرة</button>`;
    const saveBtn=sheet.querySelector('.btn-primary');
    sheet.insertBefore(panel, saveBtn || null);
    document.getElementById('pushEnableBtn').onclick=enablePushNotifications;
    updatePushUI();
  }

  function hidePrompt(){
    const p=document.getElementById('pushPrompt'); if(p) p.remove();
  }

  async function maybeShowPrompt(){
    const user=getUser();
    if(!user || user.isAdmin || localStorage.getItem('ucl_push_enabled')==='1' || sessionStorage.getItem('ucl_push_prompt_closed')==='1') return;
    const cfg=await loadPublicConfig();
    if(!configured(cfg) || !supportsPush() || Notification.permission==='denied') return;
    if(/iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalone()) return;
    if(document.getElementById('pushPrompt')) return;
    const p=document.createElement('div'); p.id='pushPrompt';
    p.innerHTML=`<div class="pp-copy"><div class="pp-title">فعّل إشعارات توقعاتي</div><div class="pp-sub">استقبل رسائل المشرف وتنبيهات المباريات مباشرة.</div></div><button id="ppEnable">تفعيل</button><button class="pp-close" id="ppClose" aria-label="إغلاق">✕</button>`;
    document.body.appendChild(p);
    document.getElementById('ppEnable').onclick=enablePushNotifications;
    document.getElementById('ppClose').onclick=()=>{sessionStorage.setItem('ucl_push_prompt_closed','1');hidePrompt();};
  }

  async function autoRefreshToken(){
    try{
      if(Notification.permission!=='granted' || localStorage.getItem('ucl_push_enabled')!=='1') return;
      const cfg=await loadPublicConfig(); if(!configured(cfg)) return;
      const reg=await registerServiceWorker();
      const {client,mod}=await getMessagingClient();
      const token=await mod.getToken(client,{vapidKey:cfg.vapidKey,serviceWorkerRegistration:reg});
      if(token) await saveToken(token);
    }catch(e){}
  }

  window.enablePushNotifications=enablePushNotifications;
  window.disablePushNotifications=disablePushNotifications;

  window.addEventListener('DOMContentLoaded',()=>{
    injectStyles(); injectProfilePanel();
    setTimeout(maybeShowPrompt,1800);
    setTimeout(autoRefreshToken,2400);
    setInterval(()=>{injectProfilePanel();maybeShowPrompt();},5000);
  });
})();
