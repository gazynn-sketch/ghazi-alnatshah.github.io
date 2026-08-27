(function(){
  function waitReady(){
    if(typeof window.deleteBiz!=='function'||typeof window.loadBusinessAds!=='function'||!window.NATSHA_NOTICE_CONFIG){
      return setTimeout(waitReady,300);
    }

    window.deleteBiz=async function(id){
      var a=(window.bizRows||[]).find(function(x){return x.id===id;});
      var name=a&&a.businessName?a.businessName:'';
      if(!confirm('حذف إعلان «'+name+'» من الظهور العام؟'))return;

      var token=sessionStorage.getItem('natshaAdminToken')||window.token||'';
      var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
      if(!apiUrl){
        if(typeof window.status==='function')window.status('bizStatus','رابط الخادم غير مضبوط');
        return;
      }

      if(typeof window.status==='function')window.status('bizStatus','جاري حذف الإعلان...',true);

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
      input.value=JSON.stringify({
        action:'businessAdsSession',
        adminAction:'delete',
        adId:id,
        token:token
      });
      form.appendChild(input);
      document.body.appendChild(form);

      var finished=false;
      function cleanup(){
        setTimeout(function(){
          try{form.remove();iframe.remove();}catch(_e){}
        },1500);
      }

      iframe.onload=async function(){
        if(finished)return;
        finished=true;
        cleanup();
        await new Promise(function(r){setTimeout(r,700);});
        try{
          await window.loadBusinessAds();
          var stillThere=(window.bizRows||[]).some(function(x){return x.id===id;});
          if(typeof window.status==='function'){
            window.status('bizStatus',stillThere?'لم يتم الحذف. أعد تسجيل الدخول ثم حاول مرة أخرى.':'تم حذف الإعلان من الظهور العام.',!stillThere);
          }
        }catch(e){
          if(typeof window.status==='function')window.status('bizStatus','تم إرسال طلب الحذف. اضغط تحديث للتأكد.',true);
        }
      };

      form.submit();

      setTimeout(async function(){
        if(finished)return;
        finished=true;
        cleanup();
        try{
          await window.loadBusinessAds();
          var stillThere=(window.bizRows||[]).some(function(x){return x.id===id;});
          if(typeof window.status==='function')window.status('bizStatus',stillThere?'لم يتم الحذف. أعد تسجيل الدخول ثم حاول مرة أخرى.':'تم حذف الإعلان من الظهور العام.',!stillThere);
        }catch(e){
          if(typeof window.status==='function')window.status('bizStatus','تم إرسال طلب الحذف. اضغط تحديث للتأكد.',true);
        }
      },4500);
    };
  }
  waitReady();
})();