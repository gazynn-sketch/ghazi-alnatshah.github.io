(function(){
  if(!/business-ads\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;

  var style=document.createElement('style');
  style.textContent='.media iframe.natshaDriveVideo{width:100%;height:100%;border:0;background:#000;display:block}';
  document.head.appendChild(style);

  function driveIdFromUrl(url){
    url=String(url||'');
    var m=url.match(/[?&]id=([^&]+)/);
    if(m)return decodeURIComponent(m[1]);
    m=url.match(/\/file\/d\/([^/]+)/);
    return m?m[1]:'';
  }

  function replaceVideo(video){
    if(!video||video.dataset.natshaDriveFixed==='1')return;
    var src=video.currentSrc||video.getAttribute('src')||'';
    var id=driveIdFromUrl(src);
    if(!id||!/drive\.google\.com/i.test(src))return;

    var iframe=document.createElement('iframe');
    iframe.className='natshaDriveVideo';
    iframe.src='https://drive.google.com/file/d/'+encodeURIComponent(id)+'/preview';
    iframe.allow='autoplay; encrypted-media; fullscreen';
    iframe.setAttribute('allowfullscreen','');
    iframe.setAttribute('loading','lazy');
    iframe.title='فيديو الإعلان';
    video.dataset.natshaDriveFixed='1';
    video.replaceWith(iframe);
  }

  function scan(root){
    (root||document).querySelectorAll('.media video').forEach(replaceVideo);
  }

  function install(){
    scan(document);
    var target=document.getElementById('adsList')||document.body;
    var observer=new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        m.addedNodes.forEach(function(node){
          if(node.nodeType!==1)return;
          if(node.matches&&node.matches('.media video'))replaceVideo(node);
          scan(node);
        });
      });
    });
    observer.observe(target,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
  else install();
})();