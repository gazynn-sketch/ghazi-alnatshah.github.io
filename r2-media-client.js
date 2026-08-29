(function(){
  function config(){return window.NATSHA_NOTICE_CONFIG||{};}
  function baseUrl(){return String(config().r2MediaApiUrl||'').replace(/\/$/,'');}
  function enabled(){return config().r2MediaEnabled===true&&/^https:\/\//.test(baseUrl());}
  function safeHeaderFileName(value){var name=String(value||'media').replace(/[\r\n\0]/g,'').replace(/[^\x20-\x7E]/g,'_').slice(0,180);return name||'media';}
  function friendlyUploadError(error){var msg=String(error&&error.message||error||'');if(/TypeError|Type error|Load failed|Failed to fetch|NetworkError|network request failed/i.test(msg))return new Error('تعذر رفع الملف من الهاتف. أعد فتح الصفحة وتأكد من اتصال الإنترنت ثم حاول مجددًا.');return error instanceof Error?error:new Error(msg||'تعذر رفع ملف الوسائط.');}

  async function uploadFile(file,token,scope){
    if(!enabled())throw new Error('تخزين الوسائط الآمن غير مفعّل.');
    if(!token)throw new Error('انتهت جلسة الدخول؛ أدخل كلمة المرور من جديد.');
    var response;try{response=await fetch(baseUrl()+'/upload',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+token,
        'Content-Type':file.type,
        'X-File-Name':safeHeaderFileName(file.name),
        'X-Natsha-Auth-Scope':scope||'business'
      },
      body:file
    });}catch(error){throw friendlyUploadError(error);}
    var result={};try{result=await response.json();}catch(_e){}
    if(!response.ok||!result.ok)throw new Error(result.error||'تعذر رفع ملف الوسائط.');
    return {type:result.type,url:result.url,key:result.key,mimeType:result.mimeType,size:result.size,storage:'r2'};
  }

  async function uploadFiles(files,token,scope,onProgress){
    var uploaded=[];files=Array.prototype.slice.call(files||[]);
    try{
      for(var i=0;i<files.length;i++){
        if(onProgress)onProgress(i+1,files.length,files[i]);
        uploaded.push(await uploadFile(files[i],token,scope));
      }
      return uploaded;
    }catch(error){
      await cleanup(uploaded,token,scope);
      throw error;
    }
  }

  async function cleanup(items,token,scope){
    var keys=(items||[]).map(function(item){return item&&item.key;}).filter(Boolean);
    if(!enabled()||!token||!keys.length)return;
    try{
      await fetch(baseUrl()+'/cleanup',{
        method:'POST',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','X-Natsha-Auth-Scope':scope||'business'},
        body:JSON.stringify({keys:keys})
      });
    }catch(_e){}
  }

  window.NatshaR2Media=Object.freeze({enabled:enabled,uploadFiles:uploadFiles,cleanup:cleanup});
})();
