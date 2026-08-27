/* Public business-ad reviews fix.
   Keeps reviews independent from the business-ad login session and retries one transient network failure. */
(function(){
  if(!/business-ads\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;

  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  function transient(err){return /Load failed|Failed to fetch|NetworkError|network request failed/i.test(String(err&&err.message||err||''));}

  function currentAdForCard(card){
    try{
      var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
      var cat=document.getElementById('categoryFilter').value||'';
      var shown=ads.filter(function(a){
        var hay=[a.businessName,a.ownerName,a.category,a.city,a.description].join(' ').toLowerCase();
        return (!cat||a.category===cat)&&(!q||hay.indexOf(q)!==-1);
      });
      var index=Number(card.getAttribute('data-ad'));
      return shown[index]||null;
    }catch(_){return null;}
  }

  async function sendReview(payload){
    var cfg=window.NATSHA_NOTICE_CONFIG||{};
    if(!cfg.apiUrl)throw new Error('رابط خادم الإعلانات غير مضبوط.');
    async function once(){
      var r=await fetch(cfg.apiUrl,{
        method:'POST',
        body:new URLSearchParams({payload:JSON.stringify(payload)})
      });
      var text=await r.text();
      var j;
      try{j=JSON.parse(text);}catch(_){throw new Error('تعذر قراءة رد الخادم. جرّب مرة أخرى.');}
      if(!j.ok)throw new Error(j.error||'تعذر حفظ التقييم.');
      return j;
    }
    try{return await once();}
    catch(err){
      if(!transient(err))throw err;
      await wait(800);
      return await once();
    }
  }

  document.addEventListener('click',async function(e){
    var button=e.target&&e.target.closest&&e.target.closest('.submitReview');
    if(!button)return;

    /* Run before the old onclick handler so an expired business login token cannot break public reviews. */
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var card=button.closest('.ad');
    if(!card)return;
    var ad=currentAdForCard(card);
    var message=card.querySelector('.reviewStatus');
    var name=(card.querySelector('.reviewName').value||'').trim();
    var rating=Number(card.querySelector('.reviewRating').value);
    var comment=(card.querySelector('.reviewText').value||'').trim();

    function show(msg,ok){
      if(!message)return;
      message.textContent=msg;
      message.className='reviewStatus status '+(ok===false?'err ':'')+'full';
    }

    if(!ad||!ad.id){show('تعذر تحديد الإعلان. اضغط تحديث الإعلانات ثم حاول مرة أخرى.',false);return;}
    if(name.length<2){show('اكتب اسمك أولًا.',false);return;}
    if(!(rating>=1&&rating<=5)){show('اختر تقييمًا من نجمة إلى خمس نجوم.',false);return;}

    button.disabled=true;
    show('جاري إرسال التقييم...',true);
    try{
      await sendReview({action:'addBusinessAdReview',adId:ad.id,name:name,rating:rating,comment:comment});
      show('تم نشر تقييمك وتعليقك بنجاح.',true);
      card.querySelector('.reviewName').value='';
      card.querySelector('.reviewText').value='';
      setTimeout(function(){try{loadAds();}catch(_){}},350);
    }catch(err){
      show(String(err&&err.message||err||'تعذر نشر التقييم. حاول مرة أخرى.'),false);
    }finally{
      button.disabled=false;
    }
  },true);
})();
