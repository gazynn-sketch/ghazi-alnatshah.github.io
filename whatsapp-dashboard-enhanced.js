(function(){
  'use strict';

  let dashboardSubscribers=[];
  let refreshTimer=null;

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function ensureStat(grid,id,label,extraClass){
    if(document.getElementById(id))return;
    const box=document.createElement('div');
    box.className='stat'+(extraClass?' '+extraClass:'');
    box.innerHTML='<span>'+esc(label)+'</span><strong id="'+id+'">—</strong>';
    grid.appendChild(box);
  }

  function installUi(){
    const panel=document.getElementById('whatsapp');
    const grid=panel&&panel.querySelector('.statsGrid');
    if(!panel||!grid)return false;

    ensureStat(grid,'waInvited','دعوات الحملة');
    ensureStat(grid,'waDelivered','وصلت للأجهزة');
    ensureStat(grid,'waRead','تمت قراءتها');
    ensureStat(grid,'waFailed','فشل الوصول','cancel');
    ensureStat(grid,'waCampaignJoined','ردّوا تم');
    ensureStat(grid,'waCampaignLeft','ردّوا انسحب','cancel');
    ensureStat(grid,'waPending','بانتظار حالة');

    if(!document.getElementById('waRecent')){
      const block=document.createElement('div');
      block.innerHTML='<h3 style="margin:20px 0 8px;color:#0d4b39">آخر حركات واتساب</h3><div id="waRecent" class="list"></div>';
      const list=document.getElementById('waList');
      panel.insertBefore(block,list);
    }
    return true;
  }

  async function callDashboard(){
    const cfg=window.NATSHA_NOTICE_CONFIG||{};
    const token=sessionStorage.getItem('natshaAdminToken')||'';
    if(!cfg.apiUrl)throw new Error('رابط الخادم غير مضبوط');
    if(!token)throw new Error('سجّل الدخول كمشرف أولاً');
    const payload={action:'whatsappDashboard',token:token};
    const r=await fetch(cfg.apiUrl,{method:'POST',body:new URLSearchParams({payload:JSON.stringify(payload)})});
    const j=await r.json();
    if(!j.ok)throw new Error(j.error||'تعذر تحميل سجل واتساب');
    return j;
  }

  function put(id,value){
    const el=document.getElementById(id);
    if(el)el.textContent=value==null?'—':String(value);
  }

  function renderSubscribers(){
    const list=document.getElementById('waList');
    const search=document.getElementById('waSearch');
    if(!list)return;
    const q=(search?search.value:'').trim().toLowerCase();
    const rows=dashboardSubscribers.filter(function(s){
      const hay=[s.name,s.phone,s.status].join(' ').toLowerCase();
      return !q||hay.indexOf(q)>=0;
    }).slice(0,100);
    list.innerHTML=rows.map(function(s){
      return '<div class="row"><b>'+esc(s.name||'بدون اسم')+'</b><br>'+esc(s.phone||'')+
        ' <span class="waBadge '+(s.whatsappOptIn?'':'off')+'">'+(s.whatsappOptIn?'واتساب مفعّل':'واتساب متوقف')+'</span>'+
        '<br><small>الحالة: '+esc(s.status||'')+
        (s.updatedAt?' | آخر تحديث: '+esc(s.updatedAt):'')+'</small></div>';
    }).join('')||'<div class="row">لا توجد نتائج.</div>';
  }

  function renderRecent(recent){
    const box=document.getElementById('waRecent');
    if(!box)return;
    box.innerHTML=(recent||[]).slice(0,40).map(function(x){
      const isFail=String(x.status||'')==='فشل';
      const isInbound=String(x.channel||'')==='WhatsApp Inbound';
      return '<div class="row"><b>'+esc(x.status||'')+'</b> — '+esc(x.phone||'')+
        '<br><small>'+esc(x.time||'')+' | '+esc(x.channel||'')+
        (x.error?'<br><span style="color:#9f2f29">'+esc(x.error)+'</span>':'')+'</small></div>';
    }).join('')||'<div class="row">لا توجد حركات حديثة.</div>';
  }

  function renderDashboard(j){
    const s=j.summary||{};
    put('waActive',s.active);
    put('waCancelled',s.cancelled);
    put('waTotal',s.totalSubscribers);
    put('waApp',s.appOptIn);
    put('waInvited',s.invited);
    put('waDelivered',s.deliveredOrBetter);
    put('waRead',s.read);
    put('waFailed',s.failed);
    put('waCampaignJoined',s.campaignJoined);
    put('waCampaignLeft',s.campaignLeft);
    put('waPending',s.pending);

    dashboardSubscribers=Array.isArray(j.subscribers)?j.subscribers.slice():[];
    dashboardSubscribers.sort(function(a,b){
      return String(b.updatedAt||b.joinedAt||'').localeCompare(String(a.updatedAt||a.joinedAt||''));
    });
    renderSubscribers();
    renderRecent(j.recent||[]);

    const status=document.getElementById('waStatus');
    if(status){
      const generated=j.generatedAt?' | الخادم: '+j.generatedAt:'';
      status.textContent='تم تحديث سجل الإرسال والاشتراكات'+generated;
      status.className='status ok';
    }
  }

  async function enhancedLoad(){
    const status=document.getElementById('waStatus');
    if(status){status.textContent='جاري تحديث سجل واتساب...';status.className='status ok';}
    try{
      const j=await callDashboard();
      renderDashboard(j);
    }catch(err){
      if(status){
        status.textContent='سجل الإرسال جاهز في الواجهة، لكن يلزم نشر تحديث Google Apps Script مرة واحدة: '+String(err&&err.message||err);
        status.className='status err';
      }
      // Keep the old subscriber-only dashboard usable until the server patch is deployed.
      if(typeof window.__natshaOldWhatsAppLoad==='function'){
        try{await window.__natshaOldWhatsAppLoad();}catch(ignore){}
      }
    }
  }

  function init(){
    if(!installUi())return;
    if(typeof window.loadWhatsAppDashboard==='function')window.__natshaOldWhatsAppLoad=window.loadWhatsAppDashboard;
    window.loadWhatsAppDashboard=enhancedLoad;

    const refresh=document.getElementById('refreshWhatsAppBtn');
    if(refresh)refresh.onclick=enhancedLoad;
    const search=document.getElementById('waSearch');
    if(search)search.oninput=renderSubscribers;

    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(function(){
      const panel=document.getElementById('whatsapp');
      if(panel&&panel.classList.contains('active')&&sessionStorage.getItem('natshaAdminToken'))enhancedLoad();
    },30000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else setTimeout(init,0);
})();
