window.NATSHA_NOTICE_CONFIG = Object.freeze({
  apiUrl: 'https://script.google.com/macros/s/AKfycbwqY9A2JlUEXxUJrTcMegJ0Qwy1cOn9jGiKb8E9ObWdkYy6jOlfROR0Kmx9G68q8N1H/exec',
  spreadsheetId: '1eDulzaGE3GRrfky_yq6p8yzxS45SJWl-qz5IgmKZbSE',
  ownerEmail: 'gazynn@gmail.com',
  whatsappEnabled: true,
  pushEnabled: true
});

/*
  iOS/Safari may occasionally throw "Load failed" while calling the
  Google Apps Script web app. Retry only requests that are safe to repeat:
  - GET requests (used to reload business ads)
  - admin business-ad delete (server delete is idempotent)
  This avoids retrying publish/send actions that could otherwise duplicate data.
*/
(function(){
  var originalFetch = window.fetch && window.fetch.bind(window);
  if(!originalFetch || window.__natshaFetchRetryInstalled)return;
  window.__natshaFetchRetryInstalled = true;

  function wait(ms){ return new Promise(function(resolve){ setTimeout(resolve,ms); }); }

  function isRetryableError(err){
    var msg = String(err && err.message || err || '');
    return /Load failed|Failed to fetch|NetworkError|network request failed/i.test(msg);
  }

  function isAppsScriptUrl(input){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    return /^https:\/\/script\.google\.com\//i.test(url);
  }

  function isSafePostDelete(options){
    try{
      if(!options || String(options.method || 'GET').toUpperCase() !== 'POST')return false;
      var body = options.body;
      if(!(body instanceof URLSearchParams))return false;
      var raw = body.get('payload');
      if(!raw)return false;
      var payload = JSON.parse(raw);
      return payload && payload.action === 'businessAdsSession' && payload.adminAction === 'delete';
    }catch(_){ return false; }
  }

  window.fetch = async function(input, options){
    var method = String(options && options.method || (input && input.method) || 'GET').toUpperCase();
    var retryable = isAppsScriptUrl(input) && (method === 'GET' || isSafePostDelete(options));
    try{
      return await originalFetch(input, options);
    }catch(err){
      if(!retryable || !isRetryableError(err))throw err;
      await wait(700);
      return await originalFetch(input, options);
    }
  };
})();

(function(){
  if(!/family-admin\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;

  var dashboard=document.createElement('script');
  dashboard.src='whatsapp-dashboard-enhanced.js?v=20260809-1';
  dashboard.defer=true;
  document.head.appendChild(dashboard);

  var media=document.createElement('script');
  media.src='family-admin-media-addon.js?v=20260812-3';
  media.defer=true;
  document.head.appendChild(media);
})();
