/* Safari/iOS compatibility for business-ads API GET requests. */
(function(){
  if(!/business-ads\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;

  function apiConfig(){return window.NATSHA_NOTICE_CONFIG||{};}
  function baseUrl(){return String(apiConfig().apiUrl||'').trim();}
  function retryable(error){return /expected pattern|Load failed|Failed to fetch|NetworkError|network request failed|TypeError/i.test(String(error&&error.message||error||''));}

  function parseJson(text){
    var j;
    try{j=JSON.parse(String(text||''));}
    catch(_e){throw new Error('تعذر قراءة رد خادم الإعلانات.');}
    if(!j||j.ok!==true)throw new Error((j&&j.error)||'فشل الطلب');
    return j;
  }

  function xhrGet(url){
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();
      try{xhr.open('GET',url,true);}catch(e){reject(e);return;}
      xhr.timeout=25000;
      xhr.setRequestHeader('Accept','application/json,text/plain,*/*');
      xhr.onload=function(){
        if(xhr.status>=200&&xhr.status<400)resolve(xhr.responseText||'');
        else reject(new Error('فشل الاتصال بخادم الإعلانات ('+xhr.status+').'));
      };
      xhr.onerror=function(){reject(new Error('تعذر الاتصال بخادم الإعلانات.'));};
      xhr.ontimeout=function(){reject(new Error('انتهت مهلة الاتصال بخادم الإعلانات.'));};
      try{xhr.send(null);}catch(e){reject(e);}
    });
  }

  async function getText(url){
    try{
      var response=await fetch(url,{method:'GET',cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      return await response.text();
    }catch(error){
      if(!retryable(error)&&!/HTTP\s+\d+/i.test(String(error&&error.message||error||'')))throw error;
      return await xhrGet(url);
    }
  }

  function install(){
    if(typeof window.api!=='function')return setTimeout(install,60);
    if(window.api.__natshaSafariSafe)return;

    var originalApi=window.api;
    var safeApi=async function(action,data,method){
      method=method||'POST';
      /* Keep the original POST path so the page's private businessToken remains attached correctly. */
      if(method!=='GET')return originalApi(action,data,method);

      var base=baseUrl();
      if(!/^https:\/\//i.test(base))throw new Error('رابط خادم الإعلانات غير مضبوط.');
      var joiner=base.indexOf('?')>=0?'&':'?';
      var url=base+joiner+'action='+encodeURIComponent(action)+'&v='+Date.now();
      return parseJson(await getText(url));
    };
    safeApi.__natshaSafariSafe=true;
    window.api=safeApi;

    /* If Safari's first request already failed, immediately try again through the safe path. */
    setTimeout(function(){try{if(typeof window.loadAds==='function')window.loadAds();}catch(_e){}},100);
  }

  install();
})();
