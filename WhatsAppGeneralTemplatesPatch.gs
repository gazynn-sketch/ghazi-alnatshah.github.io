/*
 * Natsha Family — general WhatsApp templates patch
 *
 * Purpose:
 * - "عام" uses family_general_v1 with exactly 2 body variables:
 *   {{1}} title, {{2}} message.
 * - "مناسبة" / "اجتماع" use family_event_v1 with 7 body variables.
 * - "وفاة" / "تعزية" continue using the existing sendWhatsAppBroadcast_ implementation.
 *
 * Required Script Properties:
 * WHATSAPP_TEMPLATE_GENERAL=family_general_v1
 * WHATSAPP_TEMPLATE_EVENT=family_event_v1
 * WHATSAPP_TEMPLATE_DEATH=family_condolence_v1
 * WHATSAPP_TEMPLATE_GENERAL_IMAGE=family_general_image_v1   (reserved for media UI)
 * WHATSAPP_TEMPLATE_GENERAL_VIDEO=family_general_video_v1   (reserved for media UI)
 *
 * Integration in FamilyNotificationsBackend.gs:
 * Replace only this line inside publishAnnouncement_:
 *   sendWhatsAppBroadcast_(row,admin)
 * with:
 *   sendWhatsAppBroadcastV2_(row,admin)
 */

function sendWhatsAppBroadcastV2_(announcement, admin) {
  const type = String(announcement['النوع'] || 'عام');

  // Keep the current condolence/death flow unchanged until its variable map is separately verified.
  if (type === 'وفاة' || type === 'تعزية') {
    return sendWhatsAppBroadcast_(announcement, admin);
  }

  const props = PropertiesService.getScriptProperties();
  const phoneId = props.getProperty('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = props.getProperty('WHATSAPP_ACCESS_TOKEN');
  const graphVersion = getWhatsAppGraphVersion_();
  if (!phoneId || !accessToken || !graphVersion) {
    throw new Error('بيانات WhatsApp Cloud API غير مكتملة في Script Properties');
  }

  const language = props.getProperty('WHATSAPP_TEMPLATE_LANGUAGE') || 'ar';
  let template = '';
  let bodyParameters = [];

  if (type === 'عام') {
    template = clean_(props.getProperty('WHATSAPP_TEMPLATE_GENERAL'), 120) || 'family_general_v1';
    bodyParameters = [
      {type:'text', text:clean_(announcement['العنوان'],120) || '-'},
      {type:'text', text:clean_(announcement['النص'],900) || '-'}
    ];
  } else {
    // family_event_v1 mapping verified from the approved Meta template:
    // {{1}} event type, {{2}} description, {{3}} title/name,
    // {{4}} date, {{5}} time, {{6}} location, {{7}} link.
    template = clean_(props.getProperty('WHATSAPP_TEMPLATE_EVENT'), 120) || 'family_event_v1';
    bodyParameters = [
      {type:'text', text:clean_(announcement['النوع'],30) || '-'},
      {type:'text', text:clean_(announcement['النص'],900) || '-'},
      {type:'text', text:clean_(announcement['العنوان'],120) || '-'},
      {type:'text', text:clean_(announcement['التاريخ'],20) || '-'},
      {type:'text', text:clean_(announcement['الوقت'],20) || '-'},
      {type:'text', text:clean_(announcement['المكان'],160) || '-'},
      {type:'text', text:clean_(announcement['رابط التفاصيل'],500) || '-'}
    ];
  }

  const recipients = rows_(sheet_(TAB.subscribers)).filter(function(r) {
    return String(r['الحالة']) === 'نشط' && bool_(r['موافقة واتساب']);
  }).slice(0,250);

  let sent = 0;
  recipients.forEach(function(r) {
    const p = phoneKey_(r['رقم واتساب']);
    try {
      const payload = {
        messaging_product:'whatsapp',
        to:p,
        type:'template',
        template:{
          name:template,
          language:{code:language},
          components:[{type:'body', parameters:bodyParameters}]
        }
      };
      const response = whatsappApiRequest_(phoneId, accessToken, graphVersion, payload);
      if (response.ok) {
        sent++;
        logSend_(announcement['ID'], r['رقم واتساب'], 'WhatsApp', 'تم', response.messageId, '', admin.email);
      } else {
        logSend_(announcement['ID'], r['رقم واتساب'], 'WhatsApp', 'فشل', '', response.error, admin.email);
      }
    } catch (err) {
      logSend_(announcement['ID'], r['رقم واتساب'], 'WhatsApp', 'فشل', '', safeError_(err), admin.email);
    }
    Utilities.sleep(80);
  });

  return sent;
}
