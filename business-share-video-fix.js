(function(){
  function ready(){
    if(typeof window.shareAd!=='function')return setTimeout(ready,200);

    function fileName(item,blob){
      var type=String(blob&&blob.type||'').toLowerCase();
      var ext=type.indexOf('webm')>=0?'webm':type.indexOf('quicktime')>=0?'mov':'mp4';
      return 'natsha-ad-video.'+ext;
    }

    async function fetchDriveFile(item){
      var urls=[];
      if(item&&item.fileId){
        urls.push('https://drive.usercontent.google.com/download?id='+encodeURIComponent(item.fileId)+'&export=download&confirm=t');
        urls.push('https://drive.google.com/uc?export=download&id='+encodeURIComponent(item.fileId));
      }
      if(item&&item.url)urls.push(item.url);
      for(var i=0;i<urls.length;i++){
        try{
          var r=await fetch(urls[i],{cache:'no-store'});
          if(!r.ok)continue;
          var b=await r.blob();
          if(b&&b.size>0&&String(b.type||'').indexOf('text/html')<0)return b;
        }catch(_e){}
      }
      return null;
    }

    window.shareAd=async function(ad){
      var text=[
        '*'+ad.businessName+'*',
        'بإدارة: '+ad.ownerName,
        ad.description,
        ad.city?'📍 '+ad.city:'',
        ad.phone?'☎️ '+ad.phone:'',
        ad.website||'',
        location.href
      ].filter(Boolean).join('\n');

      var media=Array.isArray(ad.media)?ad.media:[];
      var video=media.find(function(m){return m&&m.type==='video';});

      if(video&&navigator.share&&typeof File!=='undefined'){
        try{
          var blob=await fetchDriveFile(video);
          if(blob){
            var type=blob.type&&blob.type.indexOf('video/')===0?blob.type:'video/mp4';
            var file=new File([blob],fileName(video,blob),{type:type});
            if(!navigator.canShare||navigator.canShare({files:[file]})){
              await navigator.share({title:ad.businessName,text:text,files:[file]});
              return;
            }
          }
        }catch(e){
          if(e&&e.name==='AbortError')return;
        }
      }

      if(!video&&navigator.share){
        try{
          if(typeof window.shareMediaFiles_==='function'){
            var files=await window.shareMediaFiles_(ad);
            if(files.length&&(!navigator.canShare||navigator.canShare({files:files}))){
              await navigator.share({title:ad.businessName,text:text,files:files});
              return;
            }
          }
          await navigator.share({title:ad.businessName,text:text,url:location.href});
          return;
        }catch(e){if(e&&e.name==='AbortError')return;}
      }

      var links=[];
      media.forEach(function(m){
        if(!m)return;
        if(m.type==='video'&&m.fileId)links.push('https://drive.google.com/file/d/'+encodeURIComponent(m.fileId)+'/view');
        else if(m.url)links.push(m.url);
      });
      var fallback=[text,links.length?'الصور/الفيديو:\n'+links.join('\n'):''].filter(Boolean).join('\n\n');
      window.open('https://wa.me/?text='+encodeURIComponent(fallback),'_blank');
    };
  }
  ready();
})();