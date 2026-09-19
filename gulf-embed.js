function openGulfCup(){
  let overlay=document.getElementById('gulfOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='gulfOverlay';
    overlay.className='gulf-overlay';
    overlay.innerHTML=`<button class="gulf-close-fab" onclick="closeGulfCup()" aria-label="العودة لدوري الأبطال"><i data-lucide="x"></i></button><iframe class="gulf-frame" src="gulf.html?embedded=1&v=3" title="خليجي 27"></iframe>`;
    document.body.appendChild(overlay);
  }
  document.body.classList.add('gulf-mode');
  overlay.classList.add('open');
  try{history.pushState({gulf:true},'',location.pathname+location.search+'#gulf27')}catch(e){}
  setTimeout(()=>window.lucide?.createIcons(),50);
}
function closeGulfCup(){
  const overlay=document.getElementById('gulfOverlay');
  if(overlay) overlay.classList.remove('open');
  document.body.classList.remove('gulf-mode');
  if(location.hash==='#gulf27'){
    try{history.replaceState({},'',location.pathname+location.search)}catch(e){}
  }
}
window.openGulfCup=openGulfCup;
window.closeGulfCup=closeGulfCup;
window.addEventListener('popstate',()=>{if(location.hash==='#gulf27') openGulfCup(); else closeGulfCup();});
window.addEventListener('DOMContentLoaded',()=>{if(location.hash==='#gulf27') openGulfCup();});
