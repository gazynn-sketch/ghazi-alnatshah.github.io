(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function'&&typeof api==='function';}catch(_e){}
    if(!ready)return setTimeout(waitReady,300);

    function adminRows(){
      try{return typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[];}catch(_e){return [];}
    }

    function removeFromUi(id){
      try{if(typeof bizRows!=='undefined'&&Array.isArray(bizRows))bizRows=bizRows.filter(function(x){return String(x.id)!==String(id);});}catch(_e){}
      try{if(typeof renderBusinessAds==='function')renderBusinessAds();}catch(_e){}
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
        // استخدم نفس api() الذي تعمل به بقية لوحة الإدارة؛ فهو يضيف token تلقائياً
        // ويقرأ رد Apps Script الحقيقي بدلاً من إرسال نموذج مخفي لا يمكن معرفة نتيجته.
        var result=await api('businessAdsSession',{adminAction:'delete',adId:id});
        if(!result||result.ok!==true)throw new Error((result&&result.error)||'لم يؤكد الخادم عملية الحذف');
        removeFromUi(id);
        status('bizStatus','تم حذف الإعلان بنجاح.',true);
        await new Promise(function(r){setTimeout(r,500);});
        await loadBusinessAds();
      }catch(e){
        status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);
      }
    };
  }
  waitReady();
})();