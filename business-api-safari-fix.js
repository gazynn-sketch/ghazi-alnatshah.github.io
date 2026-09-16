/* Safari/iOS compatibility for business-ads API requests. */
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

  function xhrText(method,url,body){
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();
      try{xhr.open(method,url,true);}catch(e){reject(e);return;}
      xhr.timeout=25000;
      xhr.setRequestHeader('Accept','application/json,text/plain,*/*');
      if(method==='POST')xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');
      xhr.onload=function(){
        if(xhr.status>=200&&xhr.status<400)resolve(xhr.responseText||'');
        else reject(new Error('فشل الاتصال بخادم الإعلانات ('+xhr.status+').'));
      };
      xhr.onerror=function(){reject(new Error('تعذر الاتصال بخادم الإعلانات.'));};
      xhr.ontimeout=function(){reject(new Error('انتهت مهلة الاتصال بخادم الإعلانات.'));};
      try{xhr.send(body||null);}catch(e){reject(e);}
    });
  }

  async function requestText(method,url,body){
    try{
      var options={method:method,cache:'no-store'};
      if(method==='POST'){
        options.headers={'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'};
        options.body=body;
      }
      var response=await fetch(url,options);
      if(!response.ok)throw new Error('HTTP '+response.status);
      return await response.text();
    }catch(error){
      if(!retryable(error)&&!/HTTP\s+\d+/i.test(String(error&&error.message||error||'')))throw error;
      return await xhrText(method,url,body);
    }
  }

  function install(){
    if(typeof window.api!=='function')return setTimeout(install,60);
    if(window.api.__natshaSafariSafe)return;

    var safeApi=async function(action,data,method){
      data=data||{};method=method||'POST';
      var base=baseUrl();
      if(!/^https:\/\//i.test(base))throw new Error('رابط خادم الإعلانات غير مضبوط.');

      if(method==='GET'){
        var joiner=base.indexOf('?')>=0?'&':'?';
        var url=base+joiner+'action='+encodeURIComponent(action)+'&v='+Date.now();
        return parseJson(await requestText('GET',url,''));
      }

      var payload={action:action};
      Object.keys(data).forEach(function(k){payload[k]=data[k];});
      try{if(window.businessToken)payload.businessToken=window.businessToken;}catch(_e){}
      var body='payload='+encodeURIComponent(JSON.stringify(payload));
      return parseJson(await requestText('POST',base,body));
    };
    safeApi.__natshaSafariSafe=true;
    window.api=safeApi;

    /* Re-run the directory load if the page's first Safari fetch already failed. */
    setTimeout(function(){try{if(typeof window.loadAds==='function')window.loadAds();}catch(_e){}},80);
  }

  install();
})();
