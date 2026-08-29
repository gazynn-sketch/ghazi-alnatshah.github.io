(function(){
  function ready(){
    if(typeof openBizEdit!=='function'||typeof saveBiz!=='function'||typeof api!=='function'||typeof loadBusinessAds!=='function')return setTimeout(ready,250);

    function fileToPayload(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve({fileName:file.name,mimeType:file.type,dataUrl:String(r.result||'')});};r.onerror=function(){reject(new Error('تعذر قراءة '+file.name));};r.readAsDataURL(file);});}

    function validateMedia(existingMedia,files){
      existingMedia=Array.isArray(existingMedia)?existingMedia:[];files=Array.from(files||[]);
      var existingImages=existingMedia.filter(function(m){return m&&m.type==='image';}).length;
      var existingVideos=existingMedia.filter(function(m){return m&&m.type==='video';}).length;
      var newImages=files.filter(function(f){return /^image\//.test(f.type);}).length;
      var newVideos=files.filter(function(f){return /^video\//.test(f.type);}).length;
      if(existingImages+newImages>4)throw new Error('يسمح بأربع صور كحد أقصى.');
      if(existingVideos+newVideos>1)throw new Error('يسمح بفيديو واحد فقط.');
      if(existingMedia.length+files.length>5)throw new Error('الحد الأقصى 4 صور مع فيديو واحد.');
      var bytes=0;
      files.forEach(function(f){
        var image=/^image\/(jpeg|png|webp|gif)$/.test(f.type),video=/^video\/(mp4|webm|quicktime)$/.test(f.type);
        if(!image&&!video)throw new Error('المسموح صور JPG/PNG/WebP/GIF أو فيديو MP4/WebM/MOV فقط.');
        if(image&&f.size>5*1024*1024)throw new Error('إحدى الصور أكبر من 5 MB.');
        if(video&&f.size>12*1024*1024)throw new Error('الفيديو أكبر من 12 MB.');
        bytes+=f.size;
      });
      if(bytes>20*1024*1024)throw new Error('إجمالي الملفات الجديدة أكبر من 20 MB.');
    }

    function mediaEditorHtml(a){
      var media=Array.isArray(a.media)?a.media:[];
      var current=media.length?media.map(function(m,i){var visual=m.type==='video'?'<video src="'+esc(m.url)+'" controls muted style="width:100%;height:110px;object-fit:contain;background:#edf4f0;border-radius:10px"></video>':'<img src="'+esc(m.url)+'" alt="" style="width:100%;height:110px;object-fit:contain;background:#edf4f0;border-radius:10px">';return '<div style="border:1px solid #d7e4dc;border-radius:12px;padding:8px">'+visual+'<label style="display:flex;gap:7px;align-items:center;margin-top:7px;color:#9f2f29"><input type="checkbox" data-remove-media="'+i+'" style="width:auto;margin:0"> حذف هذا الملف</label></div>';}).join(''):'<div class="small">لا توجد صور أو فيديو حاليًا.</div>';
      return '<div class="full" style="border:2px dashed #a9c9bb;border-radius:14px;padding:12px"><div style="font-weight:900;color:#0d4b39;margin-bottom:8px">📷🎬 صور وفيديو الإعلان</div><div data-current-media style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px">'+current+'</div><label>إضافة صور أو فيديو<input data-new-media type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"></label><div class="small" data-media-note style="margin-top:7px">يمكن أن يحتوي الإعلان على 4 صور مع فيديو واحد. الصورة حتى 5 MB، والفيديو حتى 12 MB.</div><div data-new-previews style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:9px"></div></div>';
    }

    openBizEdit=function(id){
      var a=bizRows.find(function(x){return x.id===id;});if(!a)return;document.querySelectorAll('.editBox').forEach(function(x){x.classList.add('hidden');});var box=$('edit-'+id);box.classList.remove('hidden');
      box.innerHTML='<div class="fields"><label>اسم النشاط *<input data-f="businessName" value="'+esc(a.businessName)+'"></label><label>صاحب النشاط *<input data-f="ownerName" value="'+esc(a.ownerName)+'"></label><label>القطاع *<input data-f="category" value="'+esc(a.category)+'"></label><label>المدينة/المنطقة<input data-f="city" value="'+esc(a.city||'')+'"></label><label>الهاتف *<input data-f="phone" value="'+esc(a.phone||'')+'"></label><label>واتساب<input data-f="whatsapp" value="'+esc(a.whatsapp||'')+'"></label><label class="full">الوصف *<textarea data-f="description">'+esc(a.description||'')+'</textarea></label><label>رابط الصفحة<input data-f="website" value="'+esc(a.website||'')+'"></label><label>رابط الموقع<input data-f="locationUrl" value="'+esc(a.locationUrl||'')+'"></label><label>تاريخ الانتهاء<input type="date" data-f="expiresAt" value="'+esc(a.expiresAt||'')+'"></label>'+mediaEditorHtml(a)+'<button class="btn full" data-save="'+esc(id)+'">💾 حفظ التعديلات</button><button class="btn light full" data-cancel="'+esc(id)+'">إلغاء</button></div><div class="status" data-edit-status></div>';
      var input=box.querySelector('[data-new-media]');
      input.onchange=function(){
        var files=Array.prototype.slice.call(input.files||[]),removed={};box.querySelectorAll('[data-remove-media]:checked').forEach(function(el){removed[Number(el.dataset.removeMedia)]=true;});var kept=(Array.isArray(a.media)?a.media:[]).filter(function(_m,i){return !removed[i];});var note=box.querySelector('[data-media-note]'),previews=box.querySelector('[data-new-previews]');
        try{validateMedia(kept,files);note.textContent=files.length?'تم اختيار '+files.length+' ملف جديد للحفظ.':'يمكن الاحتفاظ بالملفات الحالية أو إضافة ملفات جديدة.';note.style.color='#0d4b39';previews.innerHTML='';files.forEach(function(f){var u=URL.createObjectURL(f),el=document.createElement('div');el.style.cssText='border:1px solid #d7e4dc;border-radius:10px;padding:5px;overflow:hidden';el.innerHTML=f.type.indexOf('video/')===0?'<video src="'+u+'" controls muted style="width:100%;height:100px;object-fit:contain"></video>':'<img src="'+u+'" style="width:100%;height:100px;object-fit:contain" alt="">';previews.appendChild(el);});}catch(e){input.value='';previews.innerHTML='';note.textContent=e.message;note.style.color='#9f2f29';}
      };
      box.querySelector('[data-save]').onclick=function(){saveBiz(id,box);};box.querySelector('[data-cancel]').onclick=function(){box.classList.add('hidden');};
    };

    saveBiz=async function(id,box){
      var a=bizRows.find(function(x){return x.id===id;});if(!a)return;var data={adId:id,adminAction:'update'};box.querySelectorAll('[data-f]').forEach(function(el){data[el.dataset.f]=el.value.trim();});var media=Array.isArray(a.media)?a.media:[],removed={};box.querySelectorAll('[data-remove-media]:checked').forEach(function(el){removed[Number(el.dataset.removeMedia)]=true;});data.keepMediaIndexes=media.map(function(_m,i){return i;}).filter(function(i){return !removed[i];});var kept=media.filter(function(_m,i){return !removed[i];});var files=Array.prototype.slice.call((box.querySelector('[data-new-media]')||{}).files||[]),st=box.querySelector('[data-edit-status]');
      var uploadedMedia=[];try{validateMedia(kept,files);st.textContent=files.length?'جاري رفع الصور والفيديو وحفظ التعديلات...':'جاري حفظ التعديلات...';st.className='status ok';data.newMedia=[];if(files.length&&cfg.r2MediaEnabled){if(!window.NatshaR2Media||!window.NatshaR2Media.enabled())throw new Error('خدمة تخزين الوسائط الآمن غير جاهزة. أعد تحميل الصفحة وحاول مجددًا.');data.newMedia=await window.NatshaR2Media.uploadFiles(files,token,'admin',function(current,total){st.textContent='جاري رفع الملف '+current+' من '+total+' بأمان...';});uploadedMedia=data.newMedia.slice();}else{for(var i=0;i<files.length;i++)data.newMedia.push(await fileToPayload(files[i]));}await api('businessAdsSession',data);uploadedMedia=[];st.textContent='تم حفظ التعديلات والوسائط.';st.className='status ok';await loadBusinessAds();}catch(e){if(uploadedMedia.length&&window.NatshaR2Media)await window.NatshaR2Media.cleanup(uploadedMedia,token,'admin');st.textContent=e.message;st.className='status err';}
    };
  }
  ready();
})();
