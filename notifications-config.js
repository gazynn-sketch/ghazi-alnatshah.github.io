window.NATSHA_NOTICE_CONFIG = Object.freeze({
  apiUrl: 'https://script.google.com/macros/s/AKfycbwqY9A2JlUEXxUJrTcMegJ0Qwy1cOn9jGiKb8E9ObWdkYy6jOlfROR0Kmx9G68q8N1H/exec',
  spreadsheetId: '1eDulzaGE3GRrfky_yq6p8yzxS45SJWl-qz5IgmKZbSE',
  ownerEmail: 'gazynn@gmail.com',
  whatsappEnabled: true,
  pushEnabled: true
});

(function(){
  var originalFetch = window.fetch && window.fetch.bind(window);
  if(!originalFetch || window.__natshaFetchRetryInstalled)return;
  window.__natshaFetchRetryInstalled = true;
  function wait(ms){ return new Promise(function(resolve){ setTimeout(resolve,ms); }); }
  function isRetryableError(err){var msg=String(err&&err.message||err||'');return /Load failed|Failed to fetch|NetworkError|network request failed/i.test(msg);}
  function isAppsScriptUrl(input){var url=typeof input==='string'?input:(input&&input.url)||'';return /^https:\/\/script\.google\.com\//i.test(url);}
  function isSafePostDelete(options){try{if(!options||String(options.method||'GET').toUpperCase()!=='POST')return false;var body=options.body;if(!(body instanceof URLSearchParams))return false;var raw=body.get('payload');if(!raw)return false;var payload=JSON.parse(raw);return payload&&payload.action==='businessAdsSession'&&payload.adminAction==='delete';}catch(_){return false;}}
  window.fetch=async function(input,options){var method=String(options&&options.method||(input&&input.method)||'GET').toUpperCase();var retryable=isAppsScriptUrl(input)&&(method==='GET'||isSafePostDelete(options));try{return await originalFetch(input,options);}catch(err){if(!retryable||!isRetryableError(err))throw err;await wait(700);return await originalFetch(input,options);}};
})();

(function(){
  if(!/business-ads\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;
  ['business-reviews-fix.js?v=20260827-2','business-media-limits.js?v=20260829-1','business-video-drive-fix.js?v=20260829-1','business-share-video-fix.js?v=20260829-1'].forEach(function(src){var s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
})();

(function(){
  if(!/business-ads\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;
  var sorting=false,observer=null;
  function ratingData(card){var summary=card.querySelector('.reviewsPanel summary'),text=summary?String(summary.textContent||''):'';var countMatch=text.match(/\((\d+)\s*تقييم/),avgMatch=text.match(/([0-5](?:[.,]\d+)?)\s*من\s*5/);return {count:countMatch?Number(countMatch[1]):0,avg:avgMatch?Number(avgMatch[1].replace(',','.')):0};}
  function sortCards(){if(sorting)return;var list=document.getElementById('adsList');if(!list)return;var current=[].slice.call(list.querySelectorAll(':scope > .ad'));if(current.length<2)return;current.forEach(function(card,index){if(card.__natshaOriginalOrder==null)card.__natshaOriginalOrder=index;});var wanted=current.slice().sort(function(a,b){var ra=ratingData(a),rb=ratingData(b);if(rb.count!==ra.count)return rb.count-ra.count;if(rb.avg!==ra.avg)return rb.avg-ra.avg;return a.__natshaOriginalOrder-b.__natshaOriginalOrder;});var changed=wanted.some(function(card,index){return card!==current[index];});if(!changed)return;sorting=true;if(observer)observer.disconnect();var frag=document.createDocumentFragment();wanted.forEach(function(card){frag.appendChild(card);});list.appendChild(frag);if(observer)observer.observe(list,{childList:true,subtree:true,characterData:true});sorting=false;}
  function install(){var list=document.getElementById('adsList');if(!list)return setTimeout(install,150);observer=new MutationObserver(function(){if(sorting)return;clearTimeout(list.__natshaSortTimer);list.__natshaSortTimer=setTimeout(sortCards,80);});observer.observe(list,{childList:true,subtree:true,characterData:true});setTimeout(sortCards,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

(function(){
  if(!/family-admin\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;
  var dashboard=document.createElement('script');dashboard.src='whatsapp-dashboard-enhanced.js?v=20260809-1';dashboard.defer=true;document.head.appendChild(dashboard);
  var media=document.createElement('script');media.src='family-admin-media-addon.js?v=20260812-3';media.defer=true;document.head.appendChild(media);
  var bizFix=document.createElement('script');bizFix.src='business-admin-safari-fix.js?v=20260827-2';bizFix.defer=true;document.head.appendChild(bizFix);
  var bizMediaEdit=document.createElement('script');bizMediaEdit.src='business-admin-media-edit.js?v=20260829-1';bizMediaEdit.defer=true;document.head.appendChild(bizMediaEdit);
})();