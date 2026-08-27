/* Natsha Family — commercial ads backend. See BUSINESS_ADS_SETUP.md. */
const BUSINESS_ADS = Object.freeze({
  sheet:'الإعلانات التجارية', reviewsSheet:'تفاعلات الإعلانات', passwordHashProperty:'BUSINESS_ADS_PASSWORD_SHA256',
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
  ensureBusinessAdsReviewsSheet_();
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

function businessAdsSession_(body) {
  body=body||{};
  if(body.adminAction==='update') return updateBusinessAdAdmin_(body);
  if(body.adminAction==='delete') return deleteBusinessAdAdmin_(body);
  requireBusinessAdsSession_(body.businessToken);
  return {ok:true};
}
function requireBusinessAdsSession_(token) {
  const raw=CacheService.getScriptCache().get(BUSINESS_ADS.sessionPrefix+clean_(token,200));
  if(!raw) throw new Error('انتهت جلسة الدخول؛ أدخل كلمة المرور من جديد');
  return JSON.parse(raw);
}

function ensureBusinessAdsSheet_() {
  const db=db_(); let sheet=db.getSheetByName(BUSINESS_ADS.sheet);
  const headers=['ID','اسم النشاط','صاحب النشاط','التصنيف','المدينة','رقم الهاتف','رقم واتساب','الوصف','رابط الصفحة','رابط الموقع على الخريطة','الوسائط','تاريخ الانتهاء','الحالة','وقت الإنشاء','آخر تحديث'];
  if(!sheet){sheet=db.insertSheet(BUSINESS_ADS.sheet);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1)}
  else if(sheet.getLastColumn()===0){sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1)}
  else {const current=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);const missing=headers.filter(h=>current.indexOf(h)<0);if(missing.length)sheet.getRange(1,sheet.getLastColumn()+1,1,missing.length).setValues([missing])}
  return sheet;
}

function ensureBusinessAdsReviewsSheet_() {
  const db=db_(); let sheet=db.getSheetByName(BUSINESS_ADS.reviewsSheet);
  const headers=['ID','معرّف الإعلان','اسم المعلّق','التقييم','التعليق','الحالة','وقت الإنشاء'];
  if(!sheet){sheet=db.insertSheet(BUSINESS_ADS.reviewsSheet);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1)}
  else if(sheet.getLastColumn()===0){sheet.getRange(1,1,1,sheet.getLastColumn()).setValues([headers]);sheet.setFrozenRows(1)}
  else {const current=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);const missing=headers.filter(h=>current.indexOf(h)<0);if(missing.length)sheet.getRange(1,sheet.getLastColumn()+1,1,missing.length).setValues([missing])}
  return sheet;
}

function publishBusinessAd_(body) {
  requireBusinessAdsSession_(body&&body.businessToken);
  const businessName=clean_(body.businessName,100),ownerName=clean_(body.ownerName,80),category=clean_(body.category,60),city=clean_(body.city,80);
  const phone=clean_(body.phone,30),whatsapp=clean_(body.whatsapp||body.phone,30),description=clean_(body.description,1200),website=safeBusinessUrl_(body.website),locationUrl=safeBusinessUrl_(body.locationUrl),expiresAt=clean_(body.expiresAt,20);
  if(!businessName||!ownerName||!category||!phone||!description) throw new Error('أكمل بيانات الإعلان المطلوبة');
  if(!/^[0-9+()\-\s]{7,30}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح');
  if(whatsapp&&!/^[0-9+()\-\s]{7,30}$/.test(whatsapp)) throw new Error('رقم واتساب غير صحيح');
  const media=saveBusinessAdsMedia_(body.media||[],businessName),id=uid_('BIZ');
  const row={'ID':id,'اسم النشاط':businessName,'صاحب النشاط':ownerName,'التصنيف':category,'المدينة':city,'رقم الهاتف':phone,'رقم واتساب':whatsapp,'الوصف':description,'رابط الصفحة':website,'رابط الموقع على الخريطة':locationUrl,'الوسائط':JSON.stringify(media),'تاريخ الانتهاء':expiresAt,'الحالة':'منشور','وقت الإنشاء':now_(),'آخر تحديث':now_()};
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{appendByHeaders_(ensureBusinessAdsSheet_(),row)}finally{lock.releaseLock()}
  return {ok:true,id:id,businessName:businessName,status:'منشور'};
}

function findBusinessAd_(adId) {
  const id=clean_(adId,80);
  if(!id) throw new Error('معرّف الإعلان مفقود');
  const sheet=ensureBusinessAdsSheet_();
  const rec=rows_(sheet).find(r=>String(r['ID'])===id);
  if(!rec) throw new Error('الإعلان غير موجود');
  return {sheet:sheet,rec:rec};
}

function parseBusinessMedia_(value){
  try{const list=JSON.parse(String(value||'[]'));return Array.isArray(list)?list:[]}catch(_){return []}
}

function validateCombinedBusinessMedia_(media){
  if(!Array.isArray(media)||media.length>BUSINESS_ADS.maxFiles) throw new Error('الحد الأقصى 3 صور، أو فيديو واحد فقط');
  const videos=media.filter(x=>x&&x.type==='video').length;
  if(videos>1||(videos&&media.length>1)) throw new Error('يسمح بفيديو واحد فقط ومن دون صور إضافية');
}

function updateBusinessAdAdmin_(body) {
  const admin=requireRole_(body.token,['owner','admin','editor']);
  const found=findBusinessAd_(body.adId),rec=found.rec;
  if(String(rec['الحالة'])!=='منشور') throw new Error('لا يمكن تعديل إعلان محذوف');
  const businessName=clean_(body.businessName,100),ownerName=clean_(body.ownerName,80),category=clean_(body.category,60),city=clean_(body.city,80);
  const phone=clean_(body.phone,30),whatsapp=clean_(body.whatsapp||body.phone,30),description=clean_(body.description,1200),website=safeBusinessUrl_(body.website),locationUrl=safeBusinessUrl_(body.locationUrl),expiresAt=clean_(body.expiresAt,20);
  if(!businessName||!ownerName||!category||!phone||!description) throw new Error('أكمل بيانات الإعلان المطلوبة');
  if(!/^[0-9+()\-\s]{7,30}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح');
  if(whatsapp&&!/^[0-9+()\-\s]{7,30}$/.test(whatsapp)) throw new Error('رقم واتساب غير صحيح');

  const oldMedia=parseBusinessMedia_(rec['الوسائط']);
  let keepIndexes=Array.isArray(body.keepMediaIndexes)?body.keepMediaIndexes.map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<oldMedia.length):oldMedia.map((_x,i)=>i);
  keepIndexes=[...new Set(keepIndexes)];
  const kept=keepIndexes.map(i=>oldMedia[i]).filter(Boolean);
  const newMedia=saveBusinessAdsMedia_(Array.isArray(body.newMedia)?body.newMedia:[],businessName);
  const combined=kept.concat(newMedia);
  validateCombinedBusinessMedia_(combined);

  updateRowByHeaders_(found.sheet,rec._row,{
    'اسم النشاط':businessName,'صاحب النشاط':ownerName,'التصنيف':category,'المدينة':city,'رقم الهاتف':phone,'رقم واتساب':whatsapp,
    'الوصف':description,'رابط الصفحة':website,'رابط الموقع على الخريطة':locationUrl,'الوسائط':JSON.stringify(combined),'تاريخ الانتهاء':expiresAt,'آخر تحديث':now_()
  });
  return {ok:true,id:body.adId,businessName:businessName,mediaCount:combined.length,updatedBy:admin.email};
}

function deleteBusinessAdAdmin_(body) {
  const admin=requireRole_(body.token,['owner','admin']);
  const found=findBusinessAd_(body.adId),rec=found.rec;
  if(String(rec['الحالة'])==='محذوف') return {ok:true,id:body.adId,alreadyDeleted:true};
  updateRowByHeaders_(found.sheet,rec._row,{'الحالة':'محذوف','آخر تحديث':now_()});
  return {ok:true,id:body.adId,deletedBy:admin.email};
}

function addBusinessAdReview_(body) {
  const adId=clean_(body&&body.adId,80),name=clean_(body&&body.name,80),comment=clean_(body&&body.comment,500),rating=Number(body&&body.rating);
  if(!adId||name.length<2) throw new Error('اكتب اسمك لإضافة التقييم');
  if(!Number.isInteger(rating)||rating<1||rating>5) throw new Error('اختر تقييمًا من نجمة إلى 5 نجوم');
  const throttleKey='business-review:'+sha256_(adId+'|'+name.toLowerCase());
  if(CacheService.getScriptCache().get(throttleKey)) throw new Error('تم إرسال تقييمك؛ انتظر قليلًا قبل إضافة تقييم آخر');
  const exists=rows_(ensureBusinessAdsSheet_()).some(r=>String(r['ID'])===adId&&String(r['الحالة'])==='منشور');
  if(!exists) throw new Error('الإعلان غير موجود أو غير متاح');
  const row={'ID':uid_('REV'),'معرّف الإعلان':adId,'اسم المعلّق':name,'التقييم':rating,'التعليق':comment,'الحالة':'منشور','وقت الإنشاء':now_()};
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{appendByHeaders_(ensureBusinessAdsReviewsSheet_(),row)}finally{lock.releaseLock()}
  CacheService.getScriptCache().put(throttleKey,'1',60);
  return {ok:true,rating:rating,name:name};
}

function listPublicBusinessAds_() {
  const today=Utilities.formatDate(new Date(),'Asia/Amman','yyyy-MM-dd');
  const grouped={};
  rows_(ensureBusinessAdsReviewsSheet_()).filter(r=>String(r['الحالة'])==='منشور').forEach(r=>{
    const adId=String(r['معرّف الإعلان']||''),rating=Number(r['التقييم']);if(!adId||rating<1||rating>5)return;
    const group=grouped[adId]||(grouped[adId]={sum:0,count:0,reviews:[]});group.sum+=rating;group.count++;
    group.reviews.push({id:r['ID'],name:r['اسم المعلّق'],rating:rating,comment:r['التعليق'],createdAt:r['وقت الإنشاء']});
  });
  return rows_(ensureBusinessAdsSheet_()).filter(r=>{const expiry=clean_(r['تاريخ الانتهاء'],20);return String(r['الحالة'])==='منشور'&&(!expiry||expiry>=today)}).map(r=>{
    let media=[];try{media=JSON.parse(String(r['الوسائط']||'[]'))}catch(ignore){}
    const group=grouped[String(r['ID'])]||{sum:0,count:0,reviews:[]};
    const reviews=group.reviews.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,20);
    return {id:r['ID'],businessName:r['اسم النشاط'],ownerName:r['صاحب النشاط'],category:r['التصنيف'],city:r['المدينة'],phone:r['رقم الهاتف'],whatsapp:r['رقم واتساب'],description:r['الوصف'],website:r['رابط الصفحة'],locationUrl:r['رابط الموقع على الخريطة'],media:Array.isArray(media)?media:[],averageRating:group.count?Number((group.sum/group.count).toFixed(1)):0,ratingCount:group.count,reviews:reviews,expiresAt:r['تاريخ الانتهاء'],createdAt:r['وقت الإنشاء']};
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
  return prepared.map(item=>{const file=folder.createFile(Utilities.newBlob(item.bytes,item.mime,clean_(businessName,40)+'-'+item.fileName));file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);const id=file.getId();return {type:item.isVideo?'video':'image',url:'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1600',fileId:id}});
}

function getBusinessAdsFolder_() {
  const props=PropertiesService.getScriptProperties(),id=props.getProperty(BUSINESS_ADS.folderIdProperty);if(id){try{return DriveApp.getFolderById(id)}catch(ignore){}}
  const folder=DriveApp.createFolder('وسائط الإعلانات التجارية - عائلة النتشة');props.setProperty(BUSINESS_ADS.folderIdProperty,folder.getId());return folder;
}

// الرابطان (صفحة النشاط وموقع المحل) اختياريان بالكامل.
// إذا كان الحقل فارغًا أو غير صالح، لا نوقف نشر الإعلان.
// وإذا كتب المستخدم نطاقًا بدون https:// نضيفه تلقائيًا.
function safeBusinessUrl_(value){
  const url=clean_(value,500);
  if(!url)return '';
  if(/^https?:\/\//i.test(url))return url;
  if(/^www\./i.test(url))return 'https://'+url;
  if(/^[a-z0-9.-]+\.[a-z]{2,}(?:[\/:?#].*)?$/i.test(url))return 'https://'+url;
  return '';
}

function safeBusinessFileName_(value,mime,index){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};return clean_(value,100).replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-')||('media-'+(index+1)+'.'+(ext[mime]||'bin'))}
