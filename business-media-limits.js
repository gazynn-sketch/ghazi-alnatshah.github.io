(function(){
  function install(){
    if(!/business-ads\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;

    window.validateFiles=function(files){
      files=Array.from(files||[]);
      if(files.length>5)throw new Error('يمكن اختيار 4 صور مع فيديو واحد كحد أقصى.');
      var images=files.filter(function(f){return String(f.type||'').indexOf('image/')===0;});
      var videos=files.filter(function(f){return String(f.type||'').indexOf('video/')===0;});
      if(images.length>4)throw new Error('يمكن إضافة 4 صور كحد أقصى.');
      if(videos.length>1)throw new Error('يمكن إضافة فيديو واحد فقط.');
      var total=0;
      files.forEach(function(f){
        var image=String(f.type||'').indexOf('image/')===0;
        var video=String(f.type||'').indexOf('video/')===0;
        if(!image&&!video)throw new Error('المسموح صور أو فيديو فقط.');
        if(image&&f.size>5*1048576)throw new Error('إحدى الصور أكبر من 5 MB.');
        if(video&&f.size>12*1048576)throw new Error('الفيديو أكبر من 12 MB.');
        total+=Number(f.size||0);
      });
      if(total>20*1048576)throw new Error('إجمالي الصور والفيديو أكبر من 20 MB.');
    };

    var input=document.getElementById('mediaFiles');
    if(input){
      var small=input.closest('.files');
      small=small&&small.querySelector('small');
      if(small)small.textContent='يمكن إضافة حتى 4 صور (5 MB للصورة) مع فيديو واحد (12 MB)، وإجمالي الملفات لا يتجاوز 20 MB.';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();