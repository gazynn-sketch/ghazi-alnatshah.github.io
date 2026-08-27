(function(){
  function waitReady(){
    if(typeof window.deleteBiz!=='function'||typeof window.loadBusinessAds!=='function'||!window.NATSHA_NOTICE_CONFIG){
      return setTimeout(waitReady,300);
    }

    async function publicAdStillExists(id){
      var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
      if(!apiUrl)return true;
      try{
        var r=await fetch(apiUrl+'?action=listBusinessAds&v='+Date.now(),{cache:'no-store'});
        var j=await r.json();
        var list=j&&Array.isArray(j.ads)?j.ads:[];
        return list.some(function(x){return String(x.id)===String(id);});
      }catch(_e){
        return true;
      }
    }

    async function verifyDeleted(id){
      for(var i=0;i<5;i++){
        await new Promise(function(r){setTimeout(r,i===0?900:1200);});
        if(!(await publicAdStillExists(id)))return true;
      }
      return false;
    }

    async function submitHiddenForm(id,token){
      return new Promise(function(resolve){
        var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
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

        var submitted=false;
        setTimeout(function(){submitted=true;form.submit();},100);
        setTimeout(function(){
          try{form.remove();iframe.remove();}catch(_e){}
          resolve(submitted);
        },1800);
      });
    }

    window.deleteBiz=async function(id){
      var name='';
      try{
        var a=(typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[]).find(function(x){return String(x.id)===String(id);});
        name=a&&a.businessName?a.businessName:'';
      }catch(_e){}

      if(!confirm('حذف إعلان «'+name+'» من الظهور العام؟'))return;

      var token=sessionStorage.getItem('natshaAdminToken')||'';
      var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
      if(!apiUrl){
        if(typeof window.status==='function')window.status('bizStatus','رابط الخادم غير مضبوط');
        return;
      }

      if(typeof window.status==='function')window.status('bizStatus','جاري حذف الإعلان...',true);

      var requestWorked=false;
      try{
        if(typeof window.api==='function'){
          await window.api('businessAdsSession',{adminAction:'delete',adId:id});
          requestWorked=true;
        }
      }catch(_e){}

      if(!requestWorked){
        try{await submitHiddenForm(id,token);}catch(_e){}
      }

      var deleted=await verifyDeleted(id);
      if(deleted){
        if(typeof window.status==='function')window.status('bizStatus','تم حذف الإعلان من الظهور العام.',true);
        try{await window.loadBusinessAds();}catch(_e){}
      }else{
        if(typeof window.status==='function')window.status('bizStatus','لم يتم حذف الإعلان فعليًا. أعد تسجيل الدخول ثم حاول مرة أخرى.',false);
      }
    };
  }
  waitReady();
})();