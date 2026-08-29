(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function';}catch(_e){}
    if(!ready||!window.NATSHA_NOTICE_CONFIG)return setTimeout(waitReady,300);

    function adminRows(){
      try{return typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[];}catch(_e){return [];}
    }

    window.deleteBiz=async function(id){
      var a=adminRows().find(function(x){return String(x.id)===String(id);});
      var name=a&&a.businessName?a.businessName:'';
      if(!confirm('حذف إعلان «'+name+'» من الظهور العام؟'))return;

      var token='';
      try{token=sessionStorage.getItem('natshaAdminToken')||'';}catch(_e){}
      if(!token){status('bizStatus','انتهت جلسة المشرف. سجّل الدخول من جديد.',false);return;}

      var apiUrl=(window.NATSHA_NOTICE_CONFIG||{}).apiUrl||'';
      if(!apiUrl){status('bizStatus','رابط الخادم غير مضبوط.',false);return;}

      // تشخيص مؤقت: افتح رد Apps Script نفسه في تبويب جديد حتى نرى الخطأ الحقيقي.
      var form=document.createElement('form');
      form.method='POST';
      form.action=apiUrl;
      form.target='_blank';
      form.style.display='none';
      var input=document.createElement('input');
      input.type='hidden';
      input.name='payload';
      input.value=JSON.stringify({action:'deleteBusinessAdAdminDirect',adId:id,token:token});
      form.appendChild(input);
      document.body.appendChild(form);
      status('bizStatus','سيُفتح رد Apps Script في تبويب جديد. أرسل لي النص الذي يظهر هناك.',true);
      try{form.submit();}catch(e){status('bizStatus',String(e&&e.message||e),false);}
      setTimeout(function(){try{form.remove();}catch(_e){}},2000);
    };
  }
  waitReady();
})();