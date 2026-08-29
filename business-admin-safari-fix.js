(function(){
  function waitReady(){
    var ready=false;
    try{ready=typeof deleteBiz==='function'&&typeof loadBusinessAds==='function';}catch(_e){}
    if(!ready||!window.NATSHA_NOTICE_CONFIG)return setTimeout(waitReady,300);

    function adminRows(){
      try{return typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[];}catch(_e){return [];}
    }

    function hideDeletedFromUi(id){
      try{
        if(typeof bizRows!=='undefined'&&Array.isArray(bizRows)){
          bizRows=bizRows.filter(function(x){return String(x.id)!==String(id)&&String(x.status||x.state||'')!=='محذوف';});
        }
      }catch(_e){}

      try{
        var list=document.getElementById('bizList');
        if(!list)return;
        var buttons=[].slice.call(list.querySelectorAll('button'));
        buttons.forEach(function(btn){
          var onclick=String(btn.getAttribute('onclick')||'');
          if(onclick.indexOf(String(id))<0)return;
          var row=btn.closest('.row');
          if(row)row.remove();
        });
      }catch(_e){}
    }

    function hideAnyDeletedRows(){
      try{
        var deleted=adminRows().filter(function(x){return String(x.status||x.state||x['الحالة']||'')==='محذوف';});
        deleted.forEach(function(x){hideDeletedFromUi(x.id);});
      }catch(_e){}
    }

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

    var originalLoad=window.loadBusinessAds;
    window.loadBusinessAds=async function(){
      var out=await originalLoad.apply(this,arguments);
      hideAnyDeletedRows();
      return out;
    };

    window.deleteBiz=async function(id){
      var name='';
      try{var a=adminRows().find(function(x){return String(x.id)===String(id);});name=a&&a.businessName?a.businessName:'';}catch(_e){}
      if(!confirm('حذف إعلان «'+name+'»؟ سيختفي فورًا من لوحة الإدارة والصفحة العامة.'))return;

      var adminToken='';
      try{adminToken=sessionStorage.getItem('natshaAdminToken')||'';}catch(_e){}
      if(!adminToken){status('bizStatus','انتهت جلسة الإدارة. سجّل الدخول من جديد.',false);return;}

      status('bizStatus','جاري حذف الإعلان...',true);
      try{
        var submitted=await submitHiddenForm(id,adminToken);
        if(!submitted)throw new Error('رابط الخادم غير مضبوط');
        hideDeletedFromUi(id);
        status('bizStatus','تم حذف الإعلان وإخفاؤه من لوحة الإدارة والصفحة العامة.',true);
        setTimeout(async function(){
          try{await window.loadBusinessAds();}catch(_e){}
        },2200);
      }catch(e){
        status('bizStatus',String(e&&e.message||e||'تعذر حذف الإعلان'),false);
      }
    };

    hideAnyDeletedRows();
  }
  waitReady();
})();