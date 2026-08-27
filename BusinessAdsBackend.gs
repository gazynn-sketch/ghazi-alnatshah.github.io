/* Natsha Family — commercial ads backend. See BUSINESS_ADS_SETUP.md. */
const BUSINESS_ADS = Object.freeze({
  sheet:'الإعلانات التجارية', passwordHashProperty:'BUSINESS_ADS_PASSWORD_SHA256',
  initialPasswordProperty:'BUSINESS_ADS_INITIAL_PASSWORD', folderIdProperty:'BUSINESS_ADS_FOLDER_ID',
  sessionPrefix:'business-session:', sessionSeconds:21600, maxFiles:3,
  maxImageBytes:5*1024*1024, maxVideoBytes:12*1024*1024, maxTotalBytes:15*1024*1024
});

function setInitialBusinessAdsPassword() {
  const props=PropertiesService.getScriptProperties();
  const password=clean_(props.getProperty(BUSINESS_ADS.initialPasswordProperty),100);
  if(!/^\d{4,20}$/.test(password)) throw new Error('أضف BUSINESS_ADS_INITIAL_PASSWORD من 4 أرقام على الأقل في Script Properties');
  props.setProperty(BUSINESS_ADS.passwordHashProperty,sha256_(password));
  props.deleteProperty(BUSINESS_ADS.initialPasswordProperty);
  ensureBusinessAdsSheet_();
  return 'تم حفظ كلمة المرور مشفّرة وحذف القيمة المؤقتة.';
}

function loginBusinessAds_(body) {
  const password=clean_(body&&body.password,100);
  const expected=PropertiesService.getScriptProperties().getProperty(BUSINESS_ADS.passwordHashProperty)||'';
  if(!expected) throw new Error('لم يتم تفعيل كلمة مرور الإعلانات بعد');
  if(!/^\d{4,20}$/.test(password)||sha256_(password)!==expected) throw new Error('كلمة المرور غير صحيحة');
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put(BUSINESS_ADS.sessionPrefix+token,JSON.stringify({scope:'business-ads',createdAt:now_()}),BUSINESS_ADS.sessionSeconds);
  return {ok:true,token:token,expiresIn:BUSINESS_ADS.sessionSeconds};
}

function businessAdsSession_(body) { requireBusinessAdsSession_(body&&body.businessToken); return {ok:true}; }
function requireBusinessAdsSession_(token) {
  const raw=CacheService.getScriptCache().get(BUSINESS_ADS.sessionPrefix+clean_(token,200));
  if(!raw) throw new Error('انتهت جلسة الدخول؛ أدخل كلمة المرور من جديد');
  return JSON.parse(raw);
}

function ensureBusinessAdsSheet_() {
  const db=db_(); let sheet=db.getSheetByName(BUSINESS_ADS.sheet);
  const headers=['ID','اسم النشاط','صاحب النشاط','التصنيف','المدينة','رقم الهاتف','رقم واتساب','الوصف','رابط الصفحة','الوسائط','تاريخ الانتهاء','الحالة','وقت الإنشاء','آخر تحديث'];
  if(!sheet){sheet=db.insertSheet(BUSINESS_ADS.sheet);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1)}
  else if(sheet.getLastColumn()===0){sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1)}
  else {const current=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);const missing=headers.filter(h=>current.indexOf(h)<0);if(missing.length)sheet.getRange(1,sheet.getLastColumn()+1,1,missing.length).setValues([missing])}
  return sheet;
}

function publishBusinessAd_(body) {
  requireBusinessAdsSession_(body&&body.businessToken);
  const businessName=clean_(body.businessName,100),ownerName=clean_(body.ownerName,80),category=clean_(body.category,60),city=clean_(body.city,80);
  const phone=clean_(body.phone,30),whatsapp=clean_(body.whatsapp||body.phone,30),description=clean_(body.description,1200),website=safeBusinessUrl_(body.website),expiresAt=clean_(body.expiresAt,20);
  if(!businessName||!ownerName||!category||!phone||!description) throw new Error('أكمل بيانات الإعلان المطلوبة');
  if(!/^[0-9+()\-\s]{7,30}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح');
  if(whatsapp&&!/^[0-9+()\-\s]{7,30}$/.test(whatsapp)) throw new Error('رقم واتساب غير صحيح');
  const media=saveBusinessAdsMedia_(body.media||[],businessName),id=uid_('BIZ');
  const row={'ID':id,'اسم النشاط':businessName,'صاحب النشاط':ownerName,'التصنيف':category,'المدينة':city,'رقم الهاتف':phone,'رقم واتساب':whatsapp,'الوصف':description,'رابط الصفحة':website,'الوسائط':JSON.stringify(media),'تاريخ الانتهاء':expiresAt,'الحالة':'منشور','وقت الإنشاء':now_(),'آخر تحديث':now_()};
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{appendByHeaders_(ensureBusinessAdsSheet_(),row)}finally{lock.releaseLock()}
  return {ok:true,id:id,businessName:businessName,status:'منشور'};
}

function listPublicBusinessAds_() {
  const today=Utilities.formatDate(new Date(),'Asia/Amman','yyyy-MM-dd');
  return rows_(ensureBusinessAdsSheet_()).filter(r=>{const expiry=clean_(r['تاريخ الانتهاء'],20);return String(r['الحالة'])==='منشور'&&(!expiry||expiry>=today)}).map(r=>{
    let media=[];try{media=JSON.parse(String(r['الوسائط']||'[]'))}catch(ignore){}
    return {id:r['ID'],businessName:r['اسم النشاط'],ownerName:r['صاحب النشاط'],category:r['التصنيف'],city:r['المدينة'],phone:r['رقم الهاتف'],whatsapp:r['رقم واتساب'],description:r['الوصف'],website:r['رابط الصفحة'],media:Array.isArray(media)?media:[],expiresAt:r['تاريخ الانتهاء'],createdAt:r['وقت الإنشاء']};
  }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}

function saveBusinessAdsMedia_(items,businessName) {
  if(!Array.isArray(items)||items.length>BUSINESS_ADS.maxFiles) throw new Error('الحد الأقصى 3 ملفات');
  let total=0,videoCount=0;
  const prepared=items.map((item,index)=>{
    const mime=clean_(item&&item.mimeType,100).toLowerCase(),isImage=/^image\/(jpeg|png|webp|gif)$/.test(mime),isVideo=/^video\/(mp4|webm|quicktime)$/.test(mime);
    if(!isImage&&!isVideo) throw new Error('نوع الملف غير مسموح');if(isVideo)videoCount++;
    const dataUrl=String(item&&item.dataUrl||''),comma=dataUrl.indexOf(',');if(comma<0)throw new Error('تعذر قراءة الملف رقم '+(index+1));
    const bytes=Utilities.base64Decode(dataUrl.slice(comma+1));
    if(isImage&&bytes.length>BUSINESS_ADS.maxImageBytes)throw new Error('إحدى الصور أكبر من 5 MB');if(isVideo&&bytes.length>BUSINESS_ADS.maxVideoBytes)throw new Error('الفيديو أكبر من 12 MB');total+=bytes.length;
    return {mime:mime,isVideo:isVideo,bytes:bytes,fileName:safeBusinessFileName_(item.fileName,mime,index)};
  });
  if(videoCount>1||(videoCount&&prepared.length>1))throw new Error('يسمح بفيديو واحد فقط ومن دون صور إضافية');if(total>BUSINESS_ADS.maxTotalBytes)throw new Error('إجمالي الملفات أكبر من 15 MB');if(!prepared.length)return [];
  const folder=getBusinessAdsFolder_();
  return prepared.map(item=>{const file=folder.createFile(Utilities.newBlob(item.bytes,item.mime,clean_(businessName,40)+'-'+item.fileName));file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);const id=file.getId();return {type:item.isVideo?'video':'image',url:'https://drive.google.com/uc?export=view&id='+encodeURIComponent(id),fileId:id}});
}

function getBusinessAdsFolder_() {
  const props=PropertiesService.getScriptProperties(),id=props.getProperty(BUSINESS_ADS.folderIdProperty);if(id){try{return DriveApp.getFolderById(id)}catch(ignore){}}
  const folder=DriveApp.createFolder('وسائط الإعلانات التجارية - عائلة النتشة');props.setProperty(BUSINESS_ADS.folderIdProperty,folder.getId());return folder;
}
function safeBusinessUrl_(value){const url=clean_(value,500);if(!url)return '';if(!/^https?:\/\//i.test(url))throw new Error('رابط الصفحة يجب أن يبدأ بـ https://');return url}
function safeBusinessFileName_(value,mime,index){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};return clean_(value,100).replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-')||('media-'+(index+1)+'.'+(ext[mime]||'bin'))}
