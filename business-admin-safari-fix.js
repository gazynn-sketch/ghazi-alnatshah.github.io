(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function';}catch(_e){}
    if(!ready||!window.NATSHA_NOTICE_CONFIG)return setTimeout(waitReady,300);

    function submitHiddenForm(id,token){
      return new Promise(function(resolve){
        var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
        if(!apiUrl)return resolve(false);
        var frameName='natshaDeleteFrame_'+Date.now();
        var iframe=document.createElement('iframe');
        iframe.name=frameName;iframe.style.display='none';document.body.appendChild(iframe);
        var form=document.createElement('form');
        form.method='POST';form.action=apiUrl;form.target=frameName;form.style.display='none';
        var input=document.createElement('input');
        input.type='hidden';input.name='payload';
        input.value=JSON.stringify({action:'businessAdsSession',adminAction:'delete',adId:id,token:token});
        form.appendChild(input);document.body.appendChild(form);
        form.submit();
        setTimeout(function(){try{form.remove();iframe.remove();}catch(_e){} resolve(true);},1600);
      });
    }

    window.deleteBiz=async function(id){
      var name='';
      try{var a=(typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[]).find(function(x){return String(x.id)===String(id);});name=a&&a.businessName?a.businessName:'';}catch(_e){}
      if(!confirm('حذف إعلان «'+name+'» من الظهور العام؟'))return;

      var adminToken='';
      try{adminToken=sessionStorage.getItem('natshaAdminToken')||'';}catch(_e){}
      if(!adminToken){status('bizStatus','انتهت جلسة الإدارة. سجّل الدخول من جديد.',false);return;}

      status('bizStatus','جاري حذف الإعلان...',true);
      try{
        var submitted=await submitHiddenForm(id,adminToken);
        if(!submitted)throw new Error('رابط الخادم غير مضبوط');
        await new Promise(function(r){setTimeout(r,1800);});
        try{await loadBusinessAds();}catch(_e){}
        var stillThere=false;
        try{stillThere=(typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[]).some(function(x){return String(x.id)===String(id);});}catch(_e){}
        if(stillThere)status('bizStatus','تم إرسال طلب الحذف. اضغط تحديث بعد ثوانٍ؛ إذا بقي الإعلان سجّل الخروج ثم ادخل من جديد.',false);
        else status('bizStatus','تم حذف الإعلان من الظهور العام.',true);
      }catch(e){status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);}
    };
  }
  waitReady();
})();