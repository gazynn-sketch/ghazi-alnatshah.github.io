const DB_ID = '1eDulzaGE3GRrfky_yq6p8yzxS45SJWl-qz5IgmKZbSE';

const TAB = Object.freeze({
  subscribers: 'المشتركون',
  admins: 'المشرفون',
  announcements: 'الإعلانات',
  logs: 'سجل الإرسال',
  settings: 'الإعدادات'
});

const WHATSAPP = Object.freeze({
  verifyTokenProperty: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  phoneIdProperty: 'WHATSAPP_PHONE_NUMBER_ID',
  accessTokenProperty: 'WHATSAPP_ACCESS_TOKEN',
  graphVersionProperty: 'WHATSAPP_GRAPH_VERSION',
  legacyGraphVersionProperty: 'META_GRAPH_VERSION',
  templateLanguageProperty: 'WHATSAPP_TEMPLATE_LANGUAGE',
  eventTemplateProperty: 'WHATSAPP_TEMPLATE_EVENT',
  deathTemplateProperty: 'WHATSAPP_TEMPLATE_DEATH',
  legacyTemplateProperty: 'WHATSAPP_TEMPLATE_NAME'
});

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const mode = String(p['hub.mode'] || '');
    const token = String(p['hub.verify_token'] || '');
    const challenge = String(p['hub.challenge'] || '');

    if (mode === 'subscribe') {
      const expectedToken = PropertiesService.getScriptProperties().getProperty(WHATSAPP.verifyTokenProperty) || '';
      if (expectedToken && token === expectedToken) return text_(challenge);
      return text_('Forbidden');
    }

    const action = String(p.action || 'listAnnouncements');
    if (action === 'health') return json_({ok:true, service:'Natsha Family Notifications', whatsappWebhook:true});
    if (action === 'listAnnouncements') return json_({ok:true, notifications:listPublicAnnouncements_()});
    if (action === 'listBusinessAds') return json_({ok:true, ads:listPublicBusinessAds_()});
    return json_({ok:false, error:'إجراء غير معروف'});
  } catch (err) {
    return json_({ok:false, error:safeError_(err)});
  }
}

function doPost(e) {
  try {
    const raw = e && e.parameter && e.parameter.payload ? e.parameter.payload : (e && e.postData ? e.postData.contents : '{}');
    const body = JSON.parse(raw || '{}');

    if (isWhatsAppWebhook_(body)) {
      handleWhatsAppWebhook_(body);
      return text_('EVENT_RECEIVED');
    }

    const action = String(body.action || '');
    switch (action) {
      case 'subscribe': return json_(subscribe_(body, false));
      case 'unsubscribe': return json_(unsubscribe_(body));
      case 'login': return json_(login_(body));
      case 'session': return json_(session_(body.token));
      case 'changePin': return json_(changePin_(body));
      case 'publishAnnouncement': return json_(publishAnnouncement_(body));
      case 'listSubscribers': return json_(listSubscribers_(body));
      case 'addSubscriber': return json_(addSubscriber_(body));
      case 'listAdmins': return json_(listAdmins_(body));
      case 'addAdmin': return json_(addAdmin_(body));
      case 'deactivateAdmin': return json_(deactivateAdmin_(body));
      case 'loginBusinessAds': return json_(loginBusinessAds_(body));
      case 'businessAdsSession': return json_(businessAdsSession_(body));
      case 'publishBusinessAd': return json_(publishBusinessAd_(body));
      default: return json_({ok:false, error:'الإجراء غير مدعوم'});
    }
  } catch (err) {
    return json_({ok:false, error:safeError_(err)});
  }
}

function isWhatsAppWebhook_(body) {
  return Boolean(body && body.object === 'whatsapp_business_account' && Array.isArray(body.entry));
}

function handleWhatsAppWebhook_(body) {
  const props = PropertiesService.getScriptProperties();
  const configuredPhoneId = clean_(props.getProperty(WHATSAPP.phoneIdProperty),80);

  (body.entry || []).forEach(function(entry) {
    (entry.changes || []).forEach(function(change) {
      if (!change || change.field !== 'messages') return;
      const value = change.value || {};
      const webhookPhoneId = clean_(value.metadata && value.metadata.phone_number_id,80);
      if (configuredPhoneId && webhookPhoneId && configuredPhoneId !== webhookPhoneId) return;

      const contactNames = whatsappContactNames_(value.contacts || []);
      (value.messages || []).forEach(function(message) {
        if (!message || !message.from) return;
        const messageId = clean_(message.id,200);
        if (messageId && whatsappMessageAlreadyHandled_(messageId)) return;

        const phone = whatsappPhone_(message.from);
        const profileName = contactNames[String(message.from)] || contactNames[String(message.from).replace(/\D/g,'')] || '';
        const command = whatsappCommand_(message);

        if (command === 'subscribe') {
          const result = whatsappOptIn_(phone,profileName,messageId);
          logWebhookAction_(phone,'اشتراك',messageId,result.created ? 'مشترك جديد' : 'تم تحديث الاشتراك');
          sendWhatsAppTextSafe_(phone,'تم تسجيل اشتراكك في إشعارات عائلة النتشة بنجاح. أهلاً وسهلاً بك.');
        } else if (command === 'unsubscribe') {
          const result = whatsappOptOut_(phone,profileName,messageId);
          logWebhookAction_(phone,'إلغاء الاشتراك',messageId,result.created ? 'تم تسجيل طلب الانسحاب' : 'تم إلغاء الاشتراك');
          sendWhatsAppTextSafe_(phone,'تم إلغاء اشتراكك في إشعارات عائلة النتشة. يمكنك الاشتراك مجددًا في أي وقت بالرد بكلمة: تم');
        }

        if (messageId) markWhatsAppMessageHandled_(messageId);
      });
    });
  });
}

function whatsappContactNames_(contacts) {
  const out = {};
  (contacts || []).forEach(function(contact) {
    const waId = clean_(contact && contact.wa_id,40).replace(/\D/g,'');
    const name = clean_(contact && contact.profile && contact.profile.name,80);
    if (waId) out[waId] = name;
  });
  return out;
}

function whatsappCommand_(message) {
  let raw = '';
  if (message.type === 'text') raw = message.text && message.text.body;
  else if (message.type === 'button') raw = (message.button && message.button.text) || (message.button && message.button.payload);
  else if (message.type === 'interactive') {
    const interactive = message.interactive || {};
    if (interactive.button_reply) raw = interactive.button_reply.title || interactive.button_reply.id;
    else if (interactive.list_reply) raw = interactive.list_reply.title || interactive.list_reply.id;
  }

  const normalized = normalizeArabicCommand_(raw);
  if (normalized === 'تم') return 'subscribe';
  if (normalized === 'انسحب') return 'unsubscribe';
  return '';
}

function normalizeArabicCommand_(value) {
  return clean_(value,100)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
    .replace(/\u0640/g,'')
    .replace(/[.,،؛;:!?؟"'()[\]{}]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function whatsappPhone_(value) {
  const digits = clean_(value,30).replace(/\D/g,'');
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('رقم واتساب الوارد غير صالح');
  return '+' + digits;
}

function whatsappOptIn_(phone,profileName,messageId) {
  const s = sheet_(TAB.subscribers);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = findSubscriberByPhone_(s,phone);
    const token = existing && existing['رمز الإلغاء'] ? String(existing['رمز الإلغاء']) : Utilities.getUuid().replace(/-/g,'').slice(0,16);
    const name = clean_(existing && existing['الاسم'],80) || clean_(profileName,80) || 'مشترك واتساب';
    const data = {
      'الاسم':name,
      'رقم واتساب':phone,
      'الدولة':countryFromPhone_(phone),
      'مصدر الاشتراك':'whatsapp-webhook',
      'موافقة واتساب':true,
      'موافقة إشعارات التطبيق':existing ? bool_(existing['موافقة إشعارات التطبيق']) : false,
      'الحالة':'نشط',
      'تاريخ الانضمام':existing && existing['تاريخ الانضمام'] ? existing['تاريخ الانضمام'] : now_(),
      'رمز الإلغاء':token,
      'آخر تحديث':now_(),
      'ملاحظات':'موافقة واتساب عبر الرد "تم"' + (messageId ? ' | '+messageId : '')
    };
    if (existing) updateRowByHeaders_(s,existing._row,data);
    else appendByHeaders_(s,Object.assign({'ID':uid_('SUB')},data));
    return {ok:true,created:!existing,phone:phone};
  } finally { lock.releaseLock(); }
}

function whatsappOptOut_(phone,profileName,messageId) {
  const s = sheet_(TAB.subscribers);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = findSubscriberByPhone_(s,phone);
    if (existing) {
      updateRowByHeaders_(s,existing._row,{
        'موافقة واتساب':false,
        'الحالة':'ملغي',
        'آخر تحديث':now_(),
        'ملاحظات':'إلغاء واتساب عبر الرد "انسحب"' + (messageId ? ' | '+messageId : '')
      });
      return {ok:true,created:false,phone:phone};
    }

    appendByHeaders_(s,{
      'ID':uid_('SUB'),
      'الاسم':clean_(profileName,80) || 'رقم منسحب من واتساب',
      'رقم واتساب':phone,
      'الدولة':countryFromPhone_(phone),
      'مصدر الاشتراك':'whatsapp-webhook',
      'موافقة واتساب':false,
      'موافقة إشعارات التطبيق':false,
      'الحالة':'ملغي',
      'تاريخ الانضمام':'',
      'رمز الإلغاء':Utilities.getUuid().replace(/-/g,'').slice(0,16),
      'آخر تحديث':now_(),
      'ملاحظات':'طلب انسحاب عبر واتساب قبل وجود اشتراك' + (messageId ? ' | '+messageId : '')
    });
    return {ok:true,created:true,phone:phone};
  } finally { lock.releaseLock(); }
}

function findSubscriberByPhone_(sheet,phone) {
  const key = phoneKey_(phone);
  return rows_(sheet).find(function(row){ return phoneKey_(row['رقم واتساب']) === key; });
}
function phoneKey_(value) { return clean_(value,40).replace(/\D/g,''); }
function countryFromPhone_(phone) {
  const digits = phoneKey_(phone);
  if (digits.indexOf('962') === 0) return '+962';
  return '+' + digits.slice(0,Math.min(3,digits.length));
}
function whatsappMessageAlreadyHandled_(messageId) { return Boolean(CacheService.getScriptCache().get('wa-message:'+messageId)); }
function markWhatsAppMessageHandled_(messageId) { CacheService.getScriptCache().put('wa-message:'+messageId,'1',21600); }
function logWebhookAction_(phone,status,providerId,note) {
  try { logSend_('WEBHOOK',phone,'WhatsApp Inbound',status,providerId || '',note || '','system'); }
  catch (err) { console.error('Webhook log failed: '+safeError_(err)); }
}

function text_(value) { return ContentService.createTextOutput(String(value == null ? '' : value)).setMimeType(ContentService.MimeType.TEXT); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function db_() { return SpreadsheetApp.openById(DB_ID); }
function sheet_(name) { const s=db_().getSheetByName(name); if(!s) throw new Error('الجدول غير موجود: '+name); return s; }
function now_() { return Utilities.formatDate(new Date(),'Asia/Amman',"yyyy-MM-dd'T'HH:mm:ss"); }
function uid_(prefix) { return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase(); }
function clean_(v,max) { return String(v == null ? '' : v).trim().slice(0,max || 2000); }
function bool_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }
function safeError_(err) { return clean_(err && err.message ? err.message : err,500); }
function phone_(v) {
  const p=clean_(v,30).replace(/[^0-9+]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(p)) throw new Error('رقم الهاتف يجب أن يكون بصيغة دولية مثل +9627...');
  return p;
}
function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function rows_(sheet) {
  const values=sheet.getDataRange().getValues(); if(!values.length) return [];
  const headers=values[0].map(String);
  return values.slice(1).map(function(row,index){ const o={_row:index+2}; headers.forEach(function(h,i){o[h]=row[i];}); return o; });
}
function appendByHeaders_(sheet,obj) {
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(function(h){return Object.prototype.hasOwnProperty.call(obj,h)?obj[h]:'';}));
}
function updateRowByHeaders_(sheet,rowIndex,changes) {
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const row=sheet.getRange(rowIndex,1,1,headers.length).getValues()[0];
  headers.forEach(function(h,i){if(Object.prototype.hasOwnProperty.call(changes,h)) row[i]=changes[h];});
  sheet.getRange(rowIndex,1,1,headers.length).setValues([row]);
}

function subscribe_(body,byAdmin) {
  const name=clean_(body.name,80), phone=phone_(body.phone);
  if(!name) throw new Error('الاسم مطلوب');
  if(!byAdmin && !bool_(body.privacyConsent)) throw new Error('الموافقة على الخصوصية مطلوبة');
  if(!byAdmin && !bool_(body.whatsappOptIn)) throw new Error('يجب الموافقة صراحةً على إشعارات واتساب');
  const s=sheet_(TAB.subscribers), lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const existing=findSubscriberByPhone_(s,phone);
    const token=existing && existing['رمز الإلغاء'] ? String(existing['رمز الإلغاء']) : Utilities.getUuid().replace(/-/g,'').slice(0,16);
    const data={
      'الاسم':name,'رقم واتساب':phone,'الدولة':countryFromPhone_(phone),'مصدر الاشتراك':clean_(body.source||'family-app',40),
      'موافقة واتساب':bool_(body.whatsappOptIn),'موافقة إشعارات التطبيق':bool_(body.appOptIn),'الحالة':'نشط',
      'تاريخ الانضمام':existing && existing['تاريخ الانضمام'] ? existing['تاريخ الانضمام'] : now_(),'رمز الإلغاء':token,'آخر تحديث':now_(),'ملاحظات':''
    };
    if(existing) updateRowByHeaders_(s,existing._row,data); else appendByHeaders_(s,Object.assign({'ID':uid_('SUB')},data));
    return {ok:true,phone:phone,unsubscribeToken:token};
  } finally { lock.releaseLock(); }
}
function addSubscriber_(body) { requireRole_(body.token,['owner','admin']); return subscribe_(Object.assign({},body,{privacyConsent:true}),true); }
function unsubscribe_(body) {
  const phone=phone_(body.phone), token=clean_(body.unsubscribeToken,40), s=sheet_(TAB.subscribers);
  const rec=findSubscriberByPhone_(s,phone);
  if(!rec || String(rec['رمز الإلغاء'])!==token) throw new Error('بيانات الإلغاء غير صحيحة');
  updateRowByHeaders_(s,rec._row,{'موافقة واتساب':false,'الحالة':'ملغي','آخر تحديث':now_()});
  return {ok:true};
}

function login_(body) {
  const email=clean_(body.email,120).toLowerCase(), pin=clean_(body.pin,50);
  if(!email || pin.length<6) throw new Error('بيانات الدخول غير صحيحة');
  const admin=findAdmin_(email);
  if(!admin || !bool_(admin['فعال']) || String(admin['PIN_SHA256'])!==sha256_(pin)) throw new Error('بيانات الدخول غير صحيحة');
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  const data={email:email,name:String(admin['الاسم']||''),role:String(admin['الدور']||'editor')};
  CacheService.getScriptCache().put('session:'+token,JSON.stringify(data),21600);
  return {ok:true,token:token,admin:data};
}
function session_(token) { const a=requireSession_(token); return {ok:true,admin:a}; }
function requireSession_(token) {
  const raw=CacheService.getScriptCache().get('session:'+clean_(token,200));
  if(!raw) throw new Error('انتهت جلسة المشرف، سجّل الدخول من جديد');
  return JSON.parse(raw);
}
function requireRole_(token,roles) { const a=requireSession_(token); if(roles.indexOf(a.role)<0) throw new Error('ليس لديك صلاحية لهذا الإجراء'); return a; }
function findAdmin_(email) { return rows_(sheet_(TAB.admins)).find(function(r){return String(r['البريد الإلكتروني']).toLowerCase()===email;}); }
function changePin_(body) {
  const a=requireSession_(body.token), oldPin=clean_(body.oldPin,50), newPin=clean_(body.newPin,50);
  if(newPin.length<6) throw new Error('الرمز الجديد يجب ألا يقل عن 6 أرقام');
  const s=sheet_(TAB.admins), rec=findAdmin_(a.email);
  if(!rec || String(rec['PIN_SHA256'])!==sha256_(oldPin)) throw new Error('الرمز الحالي غير صحيح');
  updateRowByHeaders_(s,rec._row,{'PIN_SHA256':sha256_(newPin),'ملاحظات':'تم تغيير الرمز '+now_()});
  return {ok:true};
}
function listAdmins_(body) {
  requireRole_(body.token,['owner']);
  const admins=rows_(sheet_(TAB.admins)).filter(function(r){return r['ID'];}).map(function(r){return {name:r['الاسم'],email:r['البريد الإلكتروني'],phone:r['رقم الهاتف'],role:r['الدور'],active:bool_(r['فعال'])};});
  return {ok:true,admins:admins};
}
function addAdmin_(body) {
  const owner=requireRole_(body.token,['owner']), name=clean_(body.name,80), email=clean_(body.email,120).toLowerCase(), phone=clean_(body.phone,30), role=clean_(body.role,20), pin=clean_(body.pin,50);
  if(!name || !/^\S+@\S+\.\S+$/.test(email) || ['owner','admin','editor'].indexOf(role)<0 || pin.length<6) throw new Error('أكمل بيانات المشرف ورمزًا من 6 خانات على الأقل');
  const s=sheet_(TAB.admins), existing=findAdmin_(email);
  const data={'الاسم':name,'البريد الإلكتروني':email,'رقم الهاتف':phone,'الدور':role,'PIN_SHA256':sha256_(pin),'فعال':true,'أضيف بواسطة':owner.email,'تاريخ الإضافة':now_(),'ملاحظات':''};
  if(existing) updateRowByHeaders_(s,existing._row,data); else appendByHeaders_(s,Object.assign({'ID':uid_('ADM')},data));
  return {ok:true,email:email};
}
function deactivateAdmin_(body) {
  const owner=requireRole_(body.token,['owner']), email=clean_(body.email,120).toLowerCase();
  if(email===owner.email) throw new Error('لا يمكنك إيقاف حسابك الحالي');
  const s=sheet_(TAB.admins), rec=findAdmin_(email);
  if(!rec) throw new Error('المشرف غير موجود');
  if(String(rec['الدور'])==='owner') throw new Error('لا يمكن إيقاف مالك آخر من هذه الواجهة');
  updateRowByHeaders_(s,rec._row,{'فعال':false,'ملاحظات':'أوقفه '+owner.email+' في '+now_()});
  return {ok:true};
}
function listSubscribers_(body) {
  requireRole_(body.token,['owner','admin']);
  const subscribers=rows_(sheet_(TAB.subscribers)).filter(function(r){return r['ID'];}).map(function(r){return {name:r['الاسم'],phone:r['رقم واتساب'],status:r['الحالة'],whatsappOptIn:bool_(r['موافقة واتساب']),appOptIn:bool_(r['موافقة إشعارات التطبيق']),joinedAt:r['تاريخ الانضمام']};});
  return {ok:true,subscribers:subscribers};
}

function publishAnnouncement_(body) {
  const admin=requireRole_(body.token,['owner','admin','editor']);
  const title=clean_(body.title,120), message=clean_(body.message,1200), type=clean_(body.type,30);
  if(!title || !message || ['وفاة','تعزية','مناسبة','اجتماع','عام'].indexOf(type)<0) throw new Error('نوع الإعلان والعنوان والنص مطلوبة');
  const status=admin.role==='editor'?'بانتظار المراجعة':'منشور', id=uid_('ANN');
  const row={'ID':id,'النوع':type,'العنوان':title,'النص':message,'التاريخ':clean_(body.date,20),'الوقت':clean_(body.time,20),'المكان':clean_(body.location,160),'رقم التواصل':clean_(body.contact,40),'عاجل':bool_(body.important),'النشر في التطبيق':bool_(body.publishApp),'إرسال واتساب':bool_(body.sendWhatsApp),'الحالة':status,'أنشأه':admin.email,'وقت الإنشاء':now_(),'رابط التفاصيل':clean_(body.link,500)};
  appendByHeaders_(sheet_(TAB.announcements),row);
  let sentCount=0;
  if(status==='منشور' && bool_(body.sendWhatsApp)) sentCount=sendWhatsAppBroadcast_(row,admin);
  return {ok:true,id:id,status:status,sentCount:sentCount};
}
function listPublicAnnouncements_() {
  return rows_(sheet_(TAB.announcements)).filter(function(r){return String(r['الحالة'])==='منشور' && bool_(r['النشر في التطبيق']);}).map(function(r){
    const type=String(r['النوع']||'عام'), icons={'وفاة':'🕊️','تعزية':'🤲','مناسبة':'🎉','اجتماع':'👥','عام':'📢'};
    return {id:r['ID'],type:type,title:r['العنوان'],message:r['النص'],date:r['التاريخ'],time:r['الوقت'],location:r['المكان'],contact:r['رقم التواصل'],important:bool_(r['عاجل']),active:true,icon:icons[type]||'🔔',link:r['رابط التفاصيل']};
  }).sort(function(a,b){return String(b.date+' '+b.time).localeCompare(String(a.date+' '+a.time));});
}

function sendWhatsAppBroadcast_(announcement,admin) {
  const props=PropertiesService.getScriptProperties();
  const phoneId=props.getProperty(WHATSAPP.phoneIdProperty), accessToken=props.getProperty(WHATSAPP.accessTokenProperty), graphVersion=getWhatsAppGraphVersion_();
  if(!phoneId || !accessToken || !graphVersion) throw new Error('بيانات WhatsApp Cloud API غير مكتملة في Script Properties');

  const death=['وفاة','تعزية'].indexOf(String(announcement['النوع']))>=0;
  const eventTemplate=props.getProperty(WHATSAPP.eventTemplateProperty) || props.getProperty(WHATSAPP.legacyTemplateProperty) || '';
  const deathTemplate=props.getProperty(WHATSAPP.deathTemplateProperty) || eventTemplate;
  const template=death ? deathTemplate : eventTemplate;
  if(!template) throw new Error('اسم قالب واتساب غير مضبوط');
  const language=props.getProperty(WHATSAPP.templateLanguageProperty) || 'ar';

  const recipients=rows_(sheet_(TAB.subscribers)).filter(function(r){return String(r['الحالة'])==='نشط' && bool_(r['موافقة واتساب']);}).slice(0,250);
  let sent=0;
  recipients.forEach(function(r){
    const p=phoneKey_(r['رقم واتساب']);
    try {
      const payload={messaging_product:'whatsapp',to:p,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[
        {type:'text',text:clean_(announcement['العنوان'],120)||'-'},
        {type:'text',text:clean_(announcement['النص'],900)||'-'},
        {type:'text',text:(clean_(announcement['التاريخ'],20)+' '+clean_(announcement['الوقت'],20)).trim()||'-'},
        {type:'text',text:clean_(announcement['المكان'],160)||'-'},
        {type:'text',text:clean_(announcement['رقم التواصل'],40)||'-'}
      ]}]}};
      const response=whatsappApiRequest_(phoneId,accessToken,graphVersion,payload);
      if(response.ok){
        sent++;
        logSend_(announcement['ID'],r['رقم واتساب'],'WhatsApp','تم',response.messageId,'',admin.email);
      } else logSend_(announcement['ID'],r['رقم واتساب'],'WhatsApp','فشل','',response.error,admin.email);
    } catch(err){
      logSend_(announcement['ID'],r['رقم واتساب'],'WhatsApp','فشل','',safeError_(err),admin.email);
    }
    Utilities.sleep(80);
  });
  return sent;
}

function getWhatsAppGraphVersion_() {
  const props=PropertiesService.getScriptProperties();
  return clean_(props.getProperty(WHATSAPP.graphVersionProperty),20) || clean_(props.getProperty(WHATSAPP.legacyGraphVersionProperty),20) || 'v23.0';
}

function whatsappApiRequest_(phoneId,accessToken,graphVersion,payload) {
  const url='https://graph.facebook.com/'+graphVersion+'/'+phoneId+'/messages';
  const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+accessToken},payload:JSON.stringify(payload),muteHttpExceptions:true});
  const code=res.getResponseCode();
  let out={}; try { out=JSON.parse(res.getContentText()||'{}'); } catch(ignore) {}
  if(code>=200 && code<300) return {ok:true,code:code,messageId:out.messages&&out.messages[0]?String(out.messages[0].id||''):''};
  return {ok:false,code:code,error:'HTTP '+code+': '+clean_(res.getContentText(),500)};
}

function sendWhatsAppTextSafe_(phone,message) {
  try {
    const props=PropertiesService.getScriptProperties();
    const phoneId=props.getProperty(WHATSAPP.phoneIdProperty), accessToken=props.getProperty(WHATSAPP.accessTokenProperty), graphVersion=getWhatsAppGraphVersion_();
    if(!phoneId || !accessToken) return false;
    const payload={messaging_product:'whatsapp',recipient_type:'individual',to:phoneKey_(phone),type:'text',text:{preview_url:false,body:clean_(message,1000)}};
    const response=whatsappApiRequest_(phoneId,accessToken,graphVersion,payload);
    if(!response.ok) logSend_('WEBHOOK_ACK',phone,'WhatsApp','فشل','',response.error,'system');
    return response.ok;
  } catch(err) {
    try { logSend_('WEBHOOK_ACK',phone,'WhatsApp','فشل','',safeError_(err),'system'); } catch(ignore) {}
    return false;
  }
}

function logSend_(annId,phone,channel,status,providerId,error,adminEmail) {
  appendByHeaders_(sheet_(TAB.logs),{'الوقت':now_(),'ID الإعلان':annId,'رقم المستلم':phone,'القناة':channel,'الحالة':status,'Provider ID':providerId,'الخطأ':error,'المشرف':adminEmail});
}

function setInitialOwnerPin() {
  const props=PropertiesService.getScriptProperties();
  const email=clean_(props.getProperty('INITIAL_OWNER_EMAIL'),120).toLowerCase();
  const newPin=clean_(props.getProperty('INITIAL_OWNER_PIN'),50);
  if(!email || newPin.length<6) throw new Error('أضف INITIAL_OWNER_EMAIL و INITIAL_OWNER_PIN مؤقتًا في Script Properties');
  const s=sheet_(TAB.admins), rec=findAdmin_(email);
  if(!rec) throw new Error('المشرف الرئيسي غير موجود');
  updateRowByHeaders_(s,rec._row,{'PIN_SHA256':sha256_(newPin),'فعال':true});
  props.deleteProperty('INITIAL_OWNER_PIN');
}

function testWhatsApp() {
  const props=PropertiesService.getScriptProperties();
  const phoneId=props.getProperty(WHATSAPP.phoneIdProperty), token=props.getProperty(WHATSAPP.accessTokenProperty), version=getWhatsAppGraphVersion_();
  const recipient=phoneKey_(props.getProperty('WHATSAPP_TEST_RECIPIENT'));
  const templateName=clean_(props.getProperty(WHATSAPP.legacyTemplateProperty),120) || 'hello_world';
  const templateLanguage=clean_(props.getProperty(WHATSAPP.templateLanguageProperty),20) || (templateName==='hello_world'?'en_US':'ar');
  if(!phoneId || !token) throw new Error('بيانات WhatsApp Cloud API غير مكتملة');
  if(!recipient) throw new Error('أضف WHATSAPP_TEST_RECIPIENT في Script Properties');
  const payload={messaging_product:'whatsapp',to:recipient,type:'template',template:{name:templateName,language:{code:templateLanguage}}};
  const response=whatsappApiRequest_(phoneId,token,version,payload);
  Logger.log(JSON.stringify(response));
}
