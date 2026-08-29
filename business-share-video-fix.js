(function(){
  function ready(){
    if(typeof window.shareAd!=='function')return setTimeout(ready,200);

    var APP_URL='https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/';
    var ADS_URL='https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/business-ads.html';

    function extFor(item,blob){
      var type=String(blob&&blob.type||'').toLowerCase();
      if(type.indexOf('png')>=0)return 'png';
      if(type.indexOf('webp')>=0)return 'webp';
      if(type.indexOf('gif')>=0)return 'gif';
      if(type.indexOf('webm')>=0)return 'webm';
      if(type.indexOf('quicktime')>=0)return 'mov';
      if(type.indexOf('mp4')>=0)return 'mp4';
      return item&&item.type==='video'?'mp4':'jpg';
    }

    function fileName(item,index,blob){
      return 'natsha-ad-'+(index+1)+'.'+extFor(item,blob);
    }

    async function fetchMediaBlob(item){
      var urls=[];
      if(item&&item.fileId){
        if(item.type==='image'){
          urls.push('https://lh3.googleusercontent.com/d/'+encodeURIComponent(item.fileId)+'=w1600');
          urls.push('https://drive.google.com/thumbnail?id='+encodeURIComponent(item.fileId)+'&sz=w1600');
        }
        urls.push('https://drive.usercontent.google.com/download?id='+encodeURIComponent(item.fileId)+'&export=download&confirm=t');
        urls.push('https://drive.google.com/uc?export=download&id='+encodeURIComponent(item.fileId));
      }
      if(item&&item.url)urls.push(item.url);

      for(var i=0;i<urls.length;i++){
        try{
          var r=await fetch(urls[i],{cache:'no-store'});
          if(!r.ok)continue;
          var b=await r.blob();
          var t=String(b&&b.type||'').toLowerCase();
          if(b&&b.size>0&&t.indexOf('text/html')<0)return b;
        }catch(_e){}
      }
      return null;
    }

    async function buildFiles(media){
      var files=[];
      for(var i=0;i<media.length;i++){
        var item=media[i];
        if(!item)continue;
        var blob=await fetchMediaBlob(item);
        if(!blob)continue;
        var type=blob.type;
        if(!type||(!/^image\//.test(type)&&!/^video\//.test(type))){
          type=item.type==='video'?'video/mp4':'image/jpeg';
        }
        try{files.push(new File([blob],fileName(item,i,blob),{type:type}));}catch(_e){}
      }
      return files;
    }

    function canShareFiles(files){
      return !!(files&&files.length&&navigator.share&&(!navigator.canShare||navigator.canShare({files:files})));
    }

    async function tryShare(title,text,files){
      if(!canShareFiles(files))return false;
      try{
        await navigator.share({title:title,text:text,files:files});
        return true;
      }catch(e){
        if(e&&e.name==='AbortError')throw e;
        return false;
      }
    }

    window.shareAd=async function(ad){
      var text=[
        '*'+ad.businessName+'*',
        'بإدارة: '+ad.ownerName,
        ad.description,
        ad.city?'📍 '+ad.city:'',
        ad.phone?'☎️ '+ad.phone:'',
        ad.website||'',
        '',
        '📲 تمت مشاركة هذا الإعلان من تطبيق عائلة النتشة',
        '🔗 رابط التطبيق: '+APP_URL,
        '🛍️ قسم الإعلانات: '+ADS_URL
      ].filter(function(x){return x!==null&&x!==undefined&&String(x).length>0;}).join('\n');

      var media=Array.isArray(ad.media)?ad.media:[];

      if(navigator.share&&typeof File!=='undefined'&&media.length){
        try{
          var files=await buildFiles(media);
          var videos=files.filter(function(f){return /^video\//.test(f.type);});
          var images=files.filter(function(f){return /^image\//.test(f.type);});

          // أولاً: حاول مشاركة كل الصور والفيديو معًا.
          if(await tryShare(ad.businessName,text,files))return;
          // بعض إصدارات iOS/WhatsApp لا تقبل خلط الصور والفيديو، فجرّب الفيديو وحده.
          if(videos.length&&await tryShare(ad.businessName,text,videos.slice(0,1)))return;
          // وإذا تعذر الفيديو، لا نخسر الصور: شارك الصور المتاحة.
          if(images.length&&await tryShare(ad.businessName,text,images))return;
        }catch(e){
          if(e&&e.name==='AbortError')return;
        }
      }

      if(navigator.share){
        try{
          await navigator.share({title:ad.businessName,text:text,url:ADS_URL});
          return;
        }catch(e){if(e&&e.name==='AbortError')return;}
      }

      var links=[];
      media.forEach(function(m){
        if(!m)return;
        if(m.fileId){
          links.push(m.type==='video'
            ?'https://drive.google.com/file/d/'+encodeURIComponent(m.fileId)+'/view'
            :'https://drive.google.com/uc?export=view&id='+encodeURIComponent(m.fileId));
        }else if(m.url){
          links.push(m.url);
        }
      });
      var fallback=[text,links.length?'📷🎬 الصور والفيديو:\n'+links.join('\n'):''].filter(Boolean).join('\n\n');
      window.open('https://wa.me/?text='+encodeURIComponent(fallback),'_blank');
    };
  }
  ready();
})();