const CACHE='natsha-v22';
const ASSETS=['./','index.html','radio.html','mushaf.html','quran-player.html','kids-memorization.html','quran-stories-kids.html','quran-languages.html','notifications.html','business-ads.html','hadith.html','family-notifications.json','umrah.html','prayer.html','qibla.html','message-sender.html','join-notifications.html','natsha-family-logo.svg','natsha-project-poster.svg','privacy.html','manifest.json'];
const ADMIN_FRESH=['family-admin.html','business-ads.html','notifications-config.js','family-admin-media-addon.js','whatsapp-dashboard-enhanced.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const fresh=ADMIN_FRESH.some(name=>url.pathname.endsWith('/'+name)||url.pathname.endsWith(name));
  if(fresh){
    e.respondWith(fetch(new Request(e.request,{cache:'no-store'})).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))));
});
self.addEventListener('notificationclick',e=>{e.notification.close();const target=new URL(e.notification.data?.url||'notifications.html',self.location.origin).href;e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(target);return c.focus()}}return clients.openWindow(target)}))});
