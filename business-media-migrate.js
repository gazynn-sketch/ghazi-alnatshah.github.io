(function(){
  'use strict';

  function waitForAdmin(){
    if(!/family-admin\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;
    var ready=false;
    try{ready=typeof api==='function'&&typeof loadBusinessAds==='function';}catch(_e){}
    if(!ready)return setTimeout(waitForAdmin,250);
    install();
  }

  function install(){
    if(document.getElementById('natsha-r2-migrate-btn'))return;
    var wrap=document.createElement('div');
    wrap.id='natsha-r2-migrate-wrap';
    wrap.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99999;max-width:min(92vw,390px);font-family:inherit';
    wrap.innerHTML='<button id="natsha-r2-migrate-btn" type="button" style="width:100%;border:0;border-radius:14px;padding:13px 16px;background:#0d4b39;color:#fff;font-weight:900;box-shadow:0 8px 24px rgba(0,0,0,.22);cursor:pointer">☁️ ترحيل الوسائط القديمة إلى Cloudflare R2</button><div id="natsha-r2-migrate-status" style="display:none;margin-top:8px;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #d7e4dc;box-shadow:0 8px 24px rgba(0,0,0,.12);font-size:13px;line-height:1.6"></div>';
    document.body.appendChild(wrap);
    document.getElementById('natsha-r2-migrate-btn').onclick=runMigration;
  }

  function status(text,isError){
    var el=document.getElementById('natsha-r2-migrate-status');
    if(!el)return;
    el.style.display='block';
    el.style.color=isError?'#9f2f29':'#0d4b39';
    el.textContent=text;
  }

  async function runMigration(){
    var btn=document.getElementById('natsha-r2-migrate-btn');
    if(!btn||btn.disabled)return;
    btn.disabled=true;
    btn.style.opacity='.65';
    status('جاري ترحيل الوسائط القديمة من Google Drive إلى Cloudflare R2 من جهة الخادم…');
    try{
      var result=await api('businessAdsSession',{adminAction:'migrateLegacy'});
      var msg='تم ترحيل '+Number(result.migratedAds||0)+' إعلان و'+Number(result.migratedFiles||0)+' ملف إلى Cloudflare R2.';
      if(Number(result.failedAds||0)>0){
        msg+=' تعذر ترحيل '+Number(result.failedAds||0)+' إعلان.';
        if(Array.isArray(result.failures)&&result.failures.length)msg+=' '+result.failures.join(' | ');
        status(msg,true);
      }else{
        status(msg);
      }
      try{await loadBusinessAds();}catch(_e){}
    }catch(e){
      status(String(e&&e.message||e||'تعذر ترحيل الوسائط'),true);
    }finally{
      btn.disabled=false;
      btn.style.opacity='1';
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForAdmin);else waitForAdmin();
})();
