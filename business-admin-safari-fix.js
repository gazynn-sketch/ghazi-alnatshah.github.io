(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function';}catch(_e){}
    if(!ready||!window.NATSHA_NOTICE_CONFIG)return setTimeout(waitReady,300);

    function adminRows(){
      try{return typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[];}catch(_e){return [];}
    }

    function removeFromUi(id){
      try{
        if(typeof bizRows!=='undefined'&&Array.isArray(bizRows)){
          bizRows=bizRows.filter(function(x){return String(x.id)!==String(id)&&String(x.status||x.state||x['الحالة']||'')!=='محذوف';});
        }
      }catch(_e){}
      try{
        var list=document.getElementById('bizList');
        if(!list)return;
        [].slice.call(list.querySelectorAll('button')).forEach(function(btn){
          var onclick=String(btn.getAttribute('onclick')||'');
          if(onclick.indexOf(String(id))<0)return;
          var row=btn.closest('.row');
          if(row)row.remove();
        });
      }catch(_e){}
    }

    function hideAnyDeletedRows(){
      try{
        adminRows().filter(function(x){return String(x.status||x.state||x['الحالة']||'')==='محذوف';}).forEach(function(x){removeFromUi(x.id);});
      }catch(_e){}
    }

    async function sendDelete(id,token){
      var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
      if(!apiUrl)throw new Error('رابط الخادم غير مضبوط');
      var payload=JSON.stringify({action:'businessAdsSession',adminAction:'delete',adId:id,token:token});

      try{
        var response=await fetch(apiUrl,{
          method:'POST',
          body:new URLSearchParams({payload:payload})
        });
        try{
          var result=await response.json();
          if(result&&result.ok)return true;
          if(result&&result.error)throw new Error(result.error);
        }catch(parseErr){
          if(parseErr&&parseErr.message&&parseErr.message!=='Load failed')throw parseErr;
        }
      }catch(err){
        var msg=String(err&&err.message||err||'');
        if(!/Load failed|Failed to fetch|NetworkError|network request failed/i.test(msg))throw err;
      }

      await fetch(apiUrl,{
        method:'POST',
        mode:'no-cors',
        body:new URLSearchParams({payload:payload})
      });
      return true;
    }

    var originalLoad=window.loadBusinessAds;
    window.loadBusinessAds=async function(){
      var out=await originalLoad.apply(this,arguments);
      hideAnyDeletedRows();
      return out;
    };

    window.deleteBiz=async function(id){
      var name='';
      try{var a=adminRows().find(function(x){return String(x.id)===String(id);});name=a&&a.businessName?a.businessName:'';}catch(_e){}
      if(!confirm('حذف إعلان «'+name+'»؟ سيختفي من لوحة الإدارة والصفحة العامة.'))return;

      var adminToken='';
      try{adminToken=sessionStorage.getItem('natshaAdminToken')||'';}catch(_e){}
      if(!adminToken){status('bizStatus','انتهت جلسة الإدارة. سجّل الدخول من جديد.',false);return;}

      status('bizStatus','جاري حذف الإعلان...',true);
      try{
        await sendDelete(id,adminToken);
        removeFromUi(id);
        status('bizStatus','تم إرسال الحذف للخادم. جارٍ التحقق...',true);

        setTimeout(async function(){
          try{
            await window.loadBusinessAds();
            var returned=adminRows().some(function(x){return String(x.id)===String(id);});
            if(returned){
              status('bizStatus','لم يثبت الحذف في الخادم بعد. سجّل الخروج ثم ادخل من جديد وأعد المحاولة.',false);
            }else{
              status('bizStatus','تم حذف الإعلان بنجاح ولن يعود بعد التحديث.',true);
            }
          }catch(_e){
            status('bizStatus','تم إرسال الحذف. اضغط تحديث بعد ثوانٍ للتأكد.',true);
          }
        },2500);
      }catch(e){
        status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);
      }
    };

    hideAnyDeletedRows();
  }
  waitReady();
})();