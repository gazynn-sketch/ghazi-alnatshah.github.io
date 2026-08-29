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
      await new Promise(function(r){setTimeout(r,2500);});
      await loadBusinessAds();
      return !adminRows().some(function(x){return String(x.id)===String(id);});
    }

    function sendDeleteByForm(id,token){
      return new Promise(function(resolve,reject){
        var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
        if(!apiUrl)return reject(new Error('رابط الخادم غير مضبوط'));

        var frameName='natshaDeleteFrame_'+Date.now();
        var iframe=document.createElement('iframe');
        iframe.name=frameName;
        iframe.style.display='none';
        document.body.appendChild(iframe);

        var form=document.createElement('form');
        form.method='POST';
        form.action=apiUrl;
        form.target=frameName;
        form.style.display='none';

        var input=document.createElement('input');
        input.type='hidden';
        input.name='payload';
        input.value=JSON.stringify({action:'businessAdsSession',adminAction:'delete',adId:id,token:token});
        form.appendChild(input);
        document.body.appendChild(form);

        try{form.submit();}
        catch(e){try{form.remove();iframe.remove();}catch(_e){} return reject(e);}

        // نموذج HTML عادي يتجاوز مشكلة Safari مع fetch و Apps Script redirects/CORS.
        setTimeout(function(){
          try{form.remove();iframe.remove();}catch(_e){}
          resolve(true);
        },1800);
      });
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
        await sendDeleteByForm(id,adminToken);
        var gone=await verifyGone(id);
        if(gone){
          removeFromUi(id);
          status('bizStatus','تم حذف الإعلان بنجاح.',true);
        }else{
          status('bizStatus','الخادم استلم الطلب لكن الإعلان ما زال منشورًا. المشكلة الآن في نسخة Apps Script المنشورة، وليست في Safari.',false);
        }
      }catch(e){
        status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);
      }
    };
  }
  waitReady();
})();