(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function';}catch(_e){}
    if(!ready||!window.NATSHA_NOTICE_CONFIG)return setTimeout(waitReady,300);

    function adminRows(){
      try{return typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[];}catch(_e){return [];}
    }

    function removeFromUi(id){
      try{if(typeof bizRows!=='undefined'&&Array.isArray(bizRows))bizRows=bizRows.filter(function(x){return String(x.id)!==String(id);});}catch(_e){}
      try{if(typeof renderBusinessAds==='function')renderBusinessAds();}catch(_e){}
    }

    async function verifyGone(id){
      await new Promise(function(r){setTimeout(r,1800);});
      await loadBusinessAds();
      return !adminRows().some(function(x){return String(x.id)===String(id);});
    }

    async function sendDeleteOpaque(id,token){
      var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
      if(!apiUrl)throw new Error('رابط الخادم غير مضبوط');
      var payload=JSON.stringify({action:'businessAdsSession',adminAction:'delete',adId:id,token:token});
      var params=new URLSearchParams();params.set('payload',payload);

      // Safari قد ينفذ طلب Apps Script ثم يفشل عند قراءة الرد بسبب CORS/redirect.
      // sendBeacon يرسل الطلب بدون الحاجة لقراءة الرد، ثم نتحقق عبر GET من اختفاء الإعلان.
      var beaconSent=false;
      try{
        if(navigator.sendBeacon){
          var blob=new Blob([params.toString()],{type:'application/x-www-form-urlencoded;charset=UTF-8'});
          beaconSent=navigator.sendBeacon(apiUrl,blob);
        }
      }catch(_e){}

      if(!beaconSent){
        await fetch(apiUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params.toString(),keepalive:true});
      }
    }

    window.deleteBiz=async function(id){
      var a=adminRows().find(function(x){return String(x.id)===String(id);});
      var name=a&&a.businessName?a.businessName:'';
      if(!confirm('حذف إعلان «'+name+'» من الظهور العام؟'))return;

      var adminToken='';
      try{adminToken=sessionStorage.getItem('natshaAdminToken')||'';}catch(_e){}
      if(!adminToken){status('bizStatus','انتهت جلسة المشرف. سجّل الدخول من جديد.',false);return;}

      status('bizStatus','جاري حذف الإعلان...',true);
      try{
        await sendDeleteOpaque(id,adminToken);
        var gone=await verifyGone(id);
        if(gone){
          removeFromUi(id);
          status('bizStatus','تم حذف الإعلان بنجاح.',true);
        }else{
          status('bizStatus','وصل طلب الحذف لكن الخادم لم يغيّر حالة الإعلان. أعد تسجيل الدخول ثم جرّب مرة أخرى.',false);
        }
      }catch(e){
        status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);
      }
    };
  }
  waitReady();
})();