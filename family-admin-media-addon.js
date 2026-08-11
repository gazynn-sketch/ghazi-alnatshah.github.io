(function(){
  'use strict';

  function byId(id){return document.getElementById(id)}
  function setStatus(msg,ok){
    if(typeof status==='function')return status('publishStatus',msg,ok===true);
    var el=byId('publishStatus');
    if(el){el.textContent=msg;el.className='status '+(ok?'ok':'err')}
  }
  function humanSize(bytes){
    if(bytes<1024)return bytes+' B';
    if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
    return (bytes/(1024*1024)).toFixed(1)+' MB';
  }
  function fileToDataUrl(file){
    return new Promise(function(resolve,reject){
      var r=new FileReader();
      r.onload=function(){resolve(String(r.result||''))};
      r.onerror=function(){reject(new Error('تعذر قراءة الملف من الجهاز.'))};
      r.readAsDataURL(file);
    });
  }
  async function largeApi(action,data){
    if(typeof cfg==='undefined'||!cfg.apiUrl)throw new Error('رابط Google Apps Script غير مضبوط.');
    var payload=Object.assign({action:action},data||{});
    if(typeof token!=='undefined'&&token)payload.token=token;
    var r=await fetch(cfg.apiUrl,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(payload)
    });
    var j=await r.json();
    if(!j.ok)throw new Error(j.error||'فشل الطلب');
    return j;
  }

  function install(){
    var publishBtn=byId('publishBtn');
    var linkInput=byId('link');
    if(!publishBtn||!linkInput||byId('mediaFile'))return;

    var style=document.createElement('style');
    style.textContent='\n.mediaBox{border:2px dashed #b9cfc5;border-radius:15px;padding:13px;background:#f8fcfa}\n.mediaPreview{margin-top:10px;display:none;gap:10px;align-items:flex-start;flex-wrap:wrap}\n.mediaPreview.show{display:flex}\n.mediaPreview img,.mediaPreview video{max-width:280px;max-height:240px;border-radius:13px;border:1px solid #d6e4dd;background:#000}\n.mediaMeta{font-size:13px;color:#6d7b75;line-height:1.7;flex:1;min-width:180px}\n';
    document.head.appendChild(style);

    var box=document.createElement('div');
    box.className='mediaBox full';
    box.innerHTML='\n<label>📷🎬 صورة أو فيديو لواتساب (اختياري)\n<input id="mediaFile" type="file" accept="image/*,video/*">\n</label>\n<div class="small">يعمل حاليًا مع نوع الإعلان <b>عام</b>. الصورة تستخدم قالب <b>family_general_image_v1</b> والفيديو يستخدم <b>family_general_video_v1</b>.</div>\n<div id="mediaPreview" class="mediaPreview">\n<div id="mediaVisual"></div>\n<div class="mediaMeta"><b id="mediaName"></b><br><span id="mediaInfo"></span><br><br><button id="clearMediaBtn" type="button" class="btn light">إزالة الملف</button></div>\n</div>';

    var linkLabel=linkInput.closest('label');
    linkLabel.insertAdjacentElement('afterend',box);

    var objectUrl='';
    function clearMedia(){
      if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}
      byId('mediaFile').value='';
      byId('mediaVisual').innerHTML='';
      byId('mediaName').textContent='';
      byId('mediaInfo').textContent='';
      byId('mediaPreview').classList.remove('show');
    }
    byId('clearMediaBtn').onclick=clearMedia;

    byId('mediaFile').onchange=function(){
      if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}
      var file=this.files&&this.files[0];
      if(!file){clearMedia();return}
      var isImage=file.type.indexOf('image/')===0;
      var isVideo=file.type.indexOf('video/')===0;
      if(!isImage&&!isVideo){clearMedia();return setStatus('الملف يجب أن يكون صورة أو فيديو.')}
      var max=isImage?5*1024*1024:15*1024*1024;
      if(file.size>max){clearMedia();return setStatus(isImage?'حجم الصورة أكبر من 5 MB.':'حجم الفيديو أكبر من 15 MB.')}
      objectUrl=URL.createObjectURL(file);
      byId('mediaVisual').innerHTML=isImage?'<img src="'+objectUrl+'" alt="معاينة الصورة">':'<video src="'+objectUrl+'" controls muted></video>';
      byId('mediaName').textContent=file.name;
      byId('mediaInfo').textContent=(isImage?'صورة':'فيديو')+' — '+humanSize(file.size);
      byId('mediaPreview').classList.add('show');
      setStatus('تم تجهيز الملف للرفع عند نشر الإعلان.',true);
    };

    var originalHandler=publishBtn.onclick;
    publishBtn.onclick=async function(ev){
      var file=byId('mediaFile').files&&byId('mediaFile').files[0];
      if(!file){
        if(typeof originalHandler==='function')return originalHandler.call(this,ev);
        return;
      }

      var type=byId('type').value;
      var title=byId('title').value.trim();
      var message=byId('message').value.trim();
      if(!title||!message)return setStatus('العنوان والنص مطلوبان');
      if(type!=='عام')return setStatus('للإرسال بصورة أو فيديو اختر نوع الإعلان «عام».');

      var isImage=file.type.indexOf('image/')===0;
      var isVideo=file.type.indexOf('video/')===0;
      if(!isImage&&!isVideo)return setStatus('يمكن رفع صورة أو فيديو فقط.');
      var max=isImage?5*1024*1024:15*1024*1024;
      if(file.size>max)return setStatus(isImage?'حجم الصورة أكبر من 5 MB.':'حجم الفيديو أكبر من 15 MB.');

      if(!confirm('هل راجعت العنوان والنص والملف المرفق؟ سيتم نشر الإعلان وإرسال الوسائط عبر واتساب حسب صلاحيتك.'))return;

      publishBtn.disabled=true;
      try{
        setStatus('جاري رفع '+(isImage?'الصورة':'الفيديو')+' وتجهيزها لواتساب...',true);
        var dataUrl=await fileToDataUrl(file);
        var uploaded=await largeApi('uploadAnnouncementMedia',{
          dataUrl:dataUrl,
          fileName:file.name,
          mimeType:file.type
        });

        if(!uploaded.mediaId)throw new Error('تم رفع الملف لكن لم يتم إنشاء WhatsApp Media ID.');

        setStatus('تم تجهيز الوسائط. جاري حفظ الإعلان وإرسال واتساب...',true);
        var data={
          type:type,
          title:title,
          message:message,
          date:byId('date').value,
          time:byId('time').value,
          location:byId('location').value.trim(),
          contact:byId('contact').value.trim(),
          link:byId('link').value.trim(),
          important:byId('important').checked,
          publishApp:byId('publishApp').checked,
          sendWhatsApp:byId('sendWhatsApp').checked,
          mediaUrl:uploaded.url||'',
          mediaType:uploaded.mediaType||'',
          mediaId:uploaded.mediaId||''
        };
        var j=await api('publishAnnouncement',data);
        var label=uploaded.mediaType==='image'?'صورة':'فيديو';
        setStatus('تم حفظ الإعلان. الحالة: '+j.status+(j.sentCount!=null?' | أُرسل واتساب إلى '+j.sentCount:'')+' | الوسائط: '+label,true);
      }catch(e){
        setStatus(e&&e.message?e.message:String(e));
      }finally{
        publishBtn.disabled=false;
      }
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,0)});
  else setTimeout(install,0);
})();
