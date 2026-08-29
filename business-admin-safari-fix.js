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

    function submitDelete(id,email,pin,token){
      return new Promise(function(resolve,reject){
        var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
        if(!apiUrl)return reject(new Error('رابط الخادم غير مضبوط'));
        var frameName='natshaDelete_'+Date.now();
        var iframe=document.createElement('iframe');
        iframe.name=frameName;iframe.style.display='none';document.body.appendChild(iframe);
        var form=document.createElement('form');
        form.method='POST';form.action=apiUrl;form.target=frameName;form.style.display='none';
        var input=document.createElement('input');input.type='hidden';input.name='payload';
        input.value=JSON.stringify({action:'businessAdsSession',adminAction:'delete',adId:id,adminEmail:email,adminPin:pin,token:token});
        form.appendChild(input);document.body.appendChild(form);form.submit();
        setTimeout(function(){try{form.remove();iframe.remove();}catch(_e){} resolve(true);},1800);
      });
    }

    window.deleteBiz=async function(id){
      var a=adminRows().find(function(x){return String(x.id)===String(id);});
      var name=a&&a.businessName?a.businessName:'';
      if(!confirm('حذف إعلان «'+name+'»؟'))return;

      var email='';
      try{email=(me&&me.email)||'';}catch(_e){}
      var adminToken='';
      try{adminToken=sessionStorage.getItem('natshaAdminToken')||'';}catch(_e){}
      if(!email||!adminToken){status('bizStatus','سجّل الخروج ثم ادخل من جديد قبل الحذف.',false);return;}

      var pin=prompt('أدخل رمز المشرف PIN لتأكيد الحذف:');
      if(pin===null)return;
      pin=String(pin).trim();
      if(!/^\d{4,20}$/.test(pin)){status('bizStatus','رمز المشرف غير صحيح.',false);return;}

      status('bizStatus','جاري حذف الإعلان...',true);
      try{
        await submitDelete(id,email,pin,adminToken);
        await new Promise(function(r){setTimeout(r,1400);});
        await window.loadBusinessAds();
        var returned=adminRows().some(function(x){return String(x.id)===String(id);});
        if(returned){
          status('bizStatus','لم يتم الحذف. إذا كان PIN صحيحًا سجّل الخروج ثم ادخل من جديد وأعد المحاولة.',false);
        }else{
          removeFromUi(id);
          status('bizStatus','تم حذف الإعلان بنجاح.',true);
        }
      }catch(e){status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);}
    };
  }
  waitReady();
})();