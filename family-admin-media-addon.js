(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }

  function setStatus(msg, ok){
    if(typeof status === 'function'){
      return status('publishStatus', msg, ok === true);
    }
    var el = byId('publishStatus');
    if(el){
      el.textContent = msg;
      el.className = 'status ' + (ok ? 'ok' : 'err');
    }
  }

  function humanSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }

  function fileToDataUrl(file){
    return new Promise(function(resolve,reject){
      var r = new FileReader();
      r.onload = function(){ resolve(String(r.result || '')); };
      r.onerror = function(){ reject(new Error('تعذر قراءة الملف من الجهاز.')); };
      r.readAsDataURL(file);
    });
  }

  function buildPayload(action, data){
    var payload = Object.assign({action: action}, data || {});
    if(typeof token !== 'undefined' && token) payload.token = token;
    return payload;
  }

  function apiXhr(action, data){
    return new Promise(function(resolve, reject){
      if(typeof cfg === 'undefined' || !cfg.apiUrl){
        reject(new Error('رابط Google Apps Script غير مضبوط.'));
        return;
      }

      var xhr = new XMLHttpRequest();

      try{
        xhr.open('POST', String(cfg.apiUrl), true);
      }catch(err){
        reject(new Error('تعذر فتح رابط الخادم: ' + (err && err.message ? err.message : err)));
        return;
      }

      xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      xhr.timeout = 120000;

      xhr.onload = function(){
        var text = String(xhr.responseText || '');
        var json;
        try{
          json = JSON.parse(text);
        }catch(_){
          reject(new Error('الخادم أعاد استجابة غير مفهومة (HTTP ' + xhr.status + ').'));
          return;
        }

        if(!json.ok){
          reject(new Error(json.error || 'فشل الطلب'));
          return;
        }

        resolve(json);
      };

      xhr.onerror = function(){
        reject(new Error('تعذر الاتصال بالخادم من التطبيق. أعد فتح التطبيق وحاول مرة أخرى.'));
      };

      xhr.ontimeout = function(){
        reject(new Error('انتهت مهلة الاتصال بالخادم. جرّب مرة أخرى.'));
      };

      try{
        xhr.send(JSON.stringify(buildPayload(action, data)));
      }catch(err){
        reject(new Error('تعذر إرسال الطلب: ' + (err && err.message ? err.message : err)));
      }
    });
  }

  function install(){
    var publishBtn = byId('publishBtn');
    var linkInput = byId('link');

    if(!publishBtn || !linkInput || byId('mediaFile')) return;

    var style = document.createElement('style');
    style.textContent =
      '.mediaBox{border:2px dashed #b9cfc5;border-radius:15px;padding:13px;background:#f8fcfa}' +
      '.mediaPreview{margin-top:10px;display:none;gap:10px;align-items:flex-start;flex-wrap:wrap}' +
      '.mediaPreview.show{display:flex}' +
      '.mediaPreview img,.mediaPreview video{max-width:280px;max-height:240px;border-radius:13px;border:1px solid #d6e4dd;background:#000}' +
      '.mediaMeta{font-size:13px;color:#6d7b75;line-height:1.7;flex:1;min-width:180px}';
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.className = 'mediaBox full';
    box.innerHTML =
      '<label>📷🎬 صورة أو فيديو لواتساب (اختياري)' +
      '<input id="mediaFile" type="file" accept="image/*,video/*">' +
      '</label>' +
      '<div class="small">يعمل حاليًا مع نوع الإعلان <b>عام</b>. الصورة تستخدم قالب <b>family_general_image_v1</b> والفيديو يستخدم <b>family_general_video_v1</b>.</div>' +
      '<div id="mediaPreview" class="mediaPreview">' +
      '<div id="mediaVisual"></div>' +
      '<div class="mediaMeta"><b id="mediaName"></b><br><span id="mediaInfo"></span><br><br>' +
      '<button id="clearMediaBtn" type="button" class="btn light">إزالة الملف</button></div>' +
      '</div>';

    var linkLabel = linkInput.closest('label');
    linkLabel.insertAdjacentElement('afterend', box);

    var objectUrl = '';

    function clearMedia(){
      if(objectUrl){
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
      }
      byId('mediaFile').value = '';
      byId('mediaVisual').innerHTML = '';
      byId('mediaName').textContent = '';
      byId('mediaInfo').textContent = '';
      byId('mediaPreview').classList.remove('show');
    }

    byId('clearMediaBtn').onclick = clearMedia;

    byId('mediaFile').onchange = function(){
      if(objectUrl){
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
      }

      var file = this.files && this.files[0];
      if(!file){
        clearMedia();
        return;
      }

      var isImage = file.type.indexOf('image/') === 0;
      var isVideo = file.type.indexOf('video/') === 0;

      if(!isImage && !isVideo){
        clearMedia();
        setStatus('الملف يجب أن يكون صورة أو فيديو.');
        return;
      }

      var max = isImage ? 5*1024*1024 : 15*1024*1024;
      if(file.size > max){
        clearMedia();
        setStatus(isImage ? 'حجم الصورة أكبر من 5 MB.' : 'حجم الفيديو أكبر من 15 MB.');
        return;
      }

      objectUrl = URL.createObjectURL(file);
      byId('mediaVisual').innerHTML = isImage
        ? '<img src="' + objectUrl + '" alt="معاينة الصورة">'
        : '<video src="' + objectUrl + '" controls muted></video>';

      byId('mediaName').textContent = file.name;
      byId('mediaInfo').textContent = (isImage ? 'صورة' : 'فيديو') + ' — ' + humanSize(file.size);
      byId('mediaPreview').classList.add('show');
      setStatus('تم تجهيز الملف للرفع عند نشر الإعلان.', true);
    };

    var originalHandler = publishBtn.onclick;

    publishBtn.onclick = async function(ev){
      var file = byId('mediaFile').files && byId('mediaFile').files[0];

      if(!file){
        if(typeof originalHandler === 'function'){
          return originalHandler.call(this, ev);
        }
        return;
      }

      var type = byId('type').value;
      var title = byId('title').value.trim();
      var message = byId('message').value.trim();

      if(!title || !message){
        setStatus('العنوان والنص مطلوبان');
        return;
      }

      if(type !== 'عام'){
        setStatus('للإرسال بصورة أو فيديو اختر نوع الإعلان «عام».');
        return;
      }

      var isImage = file.type.indexOf('image/') === 0;
      var isVideo = file.type.indexOf('video/') === 0;

      if(!isImage && !isVideo){
        setStatus('يمكن رفع صورة أو فيديو فقط.');
        return;
      }

      var max = isImage ? 5*1024*1024 : 15*1024*1024;
      if(file.size > max){
        setStatus(isImage ? 'حجم الصورة أكبر من 5 MB.' : 'حجم الفيديو أكبر من 15 MB.');
        return;
      }

      if(!confirm('هل راجعت العنوان والنص والملف المرفق؟ سيتم النشر والإرسال حسب الخيارات المحددة.')){
        return;
      }

      publishBtn.disabled = true;

      try{
        setStatus('1/2 جاري رفع ' + (isImage ? 'الصورة' : 'الفيديو') + ' إلى واتساب...', true);

        var dataUrl = await fileToDataUrl(file);
        var uploaded;

        try{
          uploaded = await apiXhr('uploadAnnouncementMedia', {
            dataUrl: dataUrl,
            fileName: file.name,
            mimeType: file.type
          });
        }catch(uploadErr){
          throw new Error('فشل رفع الوسائط: ' + (uploadErr && uploadErr.message ? uploadErr.message : uploadErr));
        }

        if(!uploaded.mediaId){
          throw new Error('فشل رفع الوسائط: لم يتم إنشاء WhatsApp Media ID.');
        }

        setStatus('2/2 تم رفع الوسائط. جاري حفظ الإعلان...', true);

        var data = {
          type: type,
          title: title,
          message: message,
          date: byId('date').value,
          time: byId('time').value,
          location: byId('location').value.trim(),
          contact: byId('contact').value.trim(),
          link: byId('link').value.trim(),
          important: byId('important').checked,
          publishApp: byId('publishApp').checked,
          sendWhatsApp: byId('sendWhatsApp').checked,
          mediaUrl: uploaded.url || '',
          mediaType: uploaded.mediaType || (isImage ? 'image' : 'video'),
          mediaId: uploaded.mediaId
        };

        var j;
        try{
          j = await apiXhr('publishAnnouncement', data);
        }catch(saveErr){
          throw new Error('فشل حفظ الإعلان: ' + (saveErr && saveErr.message ? saveErr.message : saveErr));
        }

        var label = data.mediaType === 'image' ? 'صورة' : 'فيديو';

        setStatus(
          'تم حفظ الإعلان. الحالة: ' + j.status +
          (j.sentCount != null ? ' | أُرسل واتساب إلى ' + j.sentCount : '') +
          ' | الوسائط: ' + label,
          true
        );
      }catch(e){
        setStatus(e && e.message ? e.message : String(e));
      }finally{
        publishBtn.disabled = false;
      }
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 0); });
  }else{
    setTimeout(install, 0);
  }
})();
