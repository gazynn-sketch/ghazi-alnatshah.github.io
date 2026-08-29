(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function'&&typeof api==='function';}catch(_e){}
    if(!ready||!window.NATSHA_NOTICE_CONFIG)return setTimeout(waitReady,300);

    window.deleteBiz=async function(id){
      var name='';
      try{
        var a=(typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[]).find(function(x){return String(x.id)===String(id);});
        name=a&&a.businessName?a.businessName:'';
      }catch(_e){}

      if(!confirm('حذف إعلان «'+name+'» من الظهور العام؟'))return;

      try{
        status('bizStatus','جاري حذف الإعلان...',true);
        await api('businessAdsSession',{adminAction:'delete',adId:id});
        status('bizStatus','تم حذف الإعلان من الظهور العام.',true);
        await loadBusinessAds();
      }catch(e){
        var msg=String(e&&e.message||e||'تعذر حذف الإعلان');
        if(/انتهت جلسة|جلسة المشرف|بيانات الدخول|صلاحية/i.test(msg)){
          try{sessionStorage.removeItem('natshaAdminToken');}catch(_e){}
          status('bizStatus','انتهت جلسة الإدارة. سجّل الخروج ثم ادخل من جديد، وبعدها أعد الحذف.',false);
          return;
        }
        status('bizStatus',msg,false);
      }
    };
  }
  waitReady();
})();