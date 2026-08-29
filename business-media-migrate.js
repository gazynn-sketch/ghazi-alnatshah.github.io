(function(){
  'use strict';

  function adminToken(){
    try{return typeof token!=='undefined'?String(token||''):(sessionStorage.getItem('natshaAdminToken')||'');}
    catch(_e){return sessionStorage.getItem('natshaAdminToken')||'';}
  }

  function adminAds(){
    try{return typeof bizRows!=='undefined'&&Array.isArray(bizRows)?bizRows:[];}
    catch(_e){return [];}
  }

  function waitForAdmin(){
    if(!/family-admin\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;
    var apiReady=false,loadReady=false;
    try{apiReady=typeof api==='function';loadReady=typeof loadBusinessAds==='function';}catch(_e){}
    if(!apiReady||!loadReady||!window.NatshaR2Media){
      return setTimeout(waitForAdmin,250);
    }
    install();
  }

  function install(){
    if(document.getElementById('natsha-r2-migrate-btn'))return;

    var wrap=document.createElement('div');
    wrap.id='natsha-r2-migrate-wrap';
    wrap.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99999;max-width:min(92vw,390px);font-family:inherit';
    wrap.innerHTML='<button id="natsha-r2-migrate-btn" type="button" style="width:100%;border:0;border-radius:14px;padding:13px 16px;background:#0d4b39;color:#fff;font-weight:900;box-shadow:0 8px 24px rgba(0,0,0,.22);cursor:pointer">☁️ ترحيل الوسائط القديمة إلى Cloudflare R2</button><div id="natsha-r2-migrate-status" style="display:none;margin-top:8px;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #d7e4dc;box-shadow:0 8px 24px rgba(0,0,0,.12);font-size:13px;line-height:1.6"></div>';
    document.body.appendChild(wrap);
    document.getElementById('natsha-r2-migrate-btn').onclick=runMigration;
  }

  function status(text,isError){
    var el=document.getElementById('natsha-r2-migrate-status');
    if(!el)return;
    el.style.display='block';
    el.style.color=isError?'#9f2f29':'#0d4b39';
    el.textContent=text;
  }

  function legacyMedia(ad){
    return (Array.isArray(ad&&ad.media)?ad.media:[]).filter(function(m){
      return m&&m.url&&m.storage!=='r2'&&!/natsha-family-media\.gazynn\.workers\.dev\/media\//i.test(String(m.url||''));
    });
  }

  function hasLegacy(ad){return legacyMedia(ad).length>0;}

  function fileExt(type,isVideo){
    var map={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
    return map[type]||(isVideo?'mp4':'jpg');
  }

  async function fetchBlobFromMedia(media){
    var urls=[];
    if(media.fileId){
      urls.push('https://drive.google.com/uc?export=download&id='+encodeURIComponent(media.fileId));
      urls.push('https://drive.usercontent.google.com/download?id='+encodeURIComponent(media.fileId)+'&export=download&confirm=t');
    }
    if(media.url)urls.push(String(media.url));

    var lastError=null;
    for(var i=0;i<urls.length;i++){
      try{
        var res=await fetch(urls[i],{method:'GET',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store'});
        if(!res.ok)throw new Error('HTTP '+res.status);
        var blob=await res.blob();
        if(!blob||!blob.size)throw new Error('الملف فارغ');
        var ct=String(blob.type||res.headers.get('Content-Type')||'').split(';')[0].toLowerCase();
        if(/^text\/html$/i.test(ct))throw new Error('تم استلام صفحة بدلاً من الملف');
        return {blob:blob,type:ct};
      }catch(e){lastError=e;}
    }
    throw new Error('تعذر تنزيل الوسائط القديمة من مصدرها'+(lastError&&lastError.message?' — '+lastError.message:''));
  }

  async function svgToPng(blob){
    return new Promise(function(resolve,reject){
      var url=URL.createObjectURL(blob),img=new Image();
      img.onload=function(){
        try{
          var w=Math.max(1,img.naturalWidth||1200),h=Math.max(1,img.naturalHeight||800),scale=Math.min(1,1600/Math.max(w,h));
          var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
          var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
          canvas.toBlob(function(out){URL.revokeObjectURL(url);if(out)resolve(out);else reject(new Error('تعذر تحويل SVG إلى PNG'));},'image/png',0.92);
        }catch(e){URL.revokeObjectURL(url);reject(e);}
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('تعذر قراءة SVG القديم'));};
      img.src=url;
    });
  }

  async function mediaToFile(media,index){
    var got=await fetchBlobFromMedia(media),blob=got.blob,type=got.type;
    if(type==='image/svg+xml'||/\.svg(?:$|[?#])/i.test(String(media.url||''))){
      blob=await svgToPng(blob);type='image/png';
    }
    if(!type)type=media.type==='video'?'video/mp4':'image/jpeg';
    var allowed=/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/i.test(type);
    if(!allowed)throw new Error('نوع وسائط غير مدعوم بعد التنزيل: '+type);
    var ext=fileExt(type,media.type==='video');
    return new File([blob],'legacy-'+Date.now()+'-'+(index+1)+'.'+ext,{type:type,lastModified:Date.now()});
  }

  function updatePayload(ad,newMedia,keepIndexes){
    return {
      adId:ad.id,
      adminAction:'update',
      businessName:String(ad.businessName||''),
      ownerName:String(ad.ownerName||''),
      category:String(ad.category||''),
      city:String(ad.city||''),
      phone:String(ad.phone||''),
      whatsapp:String(ad.whatsapp||ad.phone||''),
      description:String(ad.description||''),
      website:String(ad.website||''),
      locationUrl:String(ad.locationUrl||''),
      expiresAt:String(ad.expiresAt||''),
      keepMediaIndexes:keepIndexes,
      newMedia:newMedia
    };
  }

  async function runMigration(){
    var btn=document.getElementById('natsha-r2-migrate-btn');
    if(!btn||btn.disabled)return;
    if(!window.NatshaR2Media||!window.NatshaR2Media.enabled()){
      status('تخزين R2 غير مفعّل في إعدادات الموقع. أعد تحميل الصفحة ثم حاول مرة أخرى.',true);return;
    }
    var currentToken=adminToken();
    if(!currentToken){status('انتهت جلسة الإدارة. سجّل الدخول من جديد ثم أعد المحاولة.',true);return;}

    try{await api('session');}catch(e){
      status('جلسة الإدارة غير صالحة. سجّل الخروج ثم ادخل من جديد قبل الترحيل.',true);return;
    }

    var ads=adminAds().filter(hasLegacy);
    if(!ads.length){status('لا توجد وسائط قديمة تحتاج إلى ترحيل. كل الوسائط الحالية على R2.');return;}

    var okAds=0,failedAds=0,uploadedCount=0,failures=[];
    btn.disabled=true;btn.style.opacity='.65';

    try{
      for(var a=0;a<ads.length;a++){
        var ad=ads[a],media=Array.isArray(ad.media)?ad.media:[],keepIndexes=[],files=[];
        for(var i=0;i<media.length;i++){
          var m=media[i];
          if(m&&m.url&&(m.storage==='r2'||/natsha-family-media\.gazynn\.workers\.dev\/media\//i.test(String(m.url||''))))keepIndexes.push(i);
          else if(m&&m.url)files.push({media:m,index:i});
        }
        if(!files.length)continue;

        var uploaded=[];
        try{
          status('جاري ترحيل إعلان '+(a+1)+' من '+ads.length+': '+String(ad.businessName||ad.id)+'…');
          for(var f=0;f<files.length;f++){
            var file=await mediaToFile(files[f].media,f);
            var refs=await window.NatshaR2Media.uploadFiles([file],currentToken,'admin',function(){
              status('جاري رفع '+String(ad.businessName||ad.id)+' — ملف '+(f+1)+' من '+files.length+' إلى R2…');
            });
            uploaded.push(refs[0]);uploadedCount++;
          }
          await api('businessAdsSession',updatePayload(ad,uploaded,keepIndexes));
          uploaded=[];okAds++;
        }catch(e){
          failedAds++;
          failures.push(String(ad.businessName||ad.id)+': '+String(e&&e.message||e));
          if(uploaded.length)await window.NatshaR2Media.cleanup(uploaded,currentToken,'admin');
        }
      }
      await loadBusinessAds();
      if(failedAds){
        status('تم ترحيل '+okAds+' إعلان و'+uploadedCount+' ملف إلى R2. تعذر ترحيل '+failedAds+' إعلان. '+failures.join(' | '),true);
      }else{
        status('تم بنجاح ترحيل '+okAds+' إعلان و'+uploadedCount+' ملف إلى Cloudflare R2. النسخ القديمة لم تُحذف من مصادرها.');
      }
    }finally{
      btn.disabled=false;btn.style.opacity='1';
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForAdmin);else waitForAdmin();
})();