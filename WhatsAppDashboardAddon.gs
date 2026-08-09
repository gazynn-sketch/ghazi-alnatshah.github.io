// Natsha Family — WhatsApp delivery/read/failure dashboard add-on for Google Apps Script
// Add this file to the SAME Apps Script project that contains FamilyNotificationsBackend.gs.
// The main doPost(e) switch must include:
// case 'whatsappDashboard': return json_(listWhatsAppDashboard_(body));

const WHATSAPP_DASHBOARD = Object.freeze({
  campaignId: 'SUBSCRIPTION_INVITE',
  statusId: 'WHATSAPP_STATUS',
  webhookId: 'WEBHOOK',
  maxRecent: 80
});

/**
 * Secure admin endpoint for the WhatsApp dashboard.
 * Requires an authenticated owner/admin session and exposes no API secrets.
 */
function listWhatsAppDashboard_(body) {
  requireRole_(body.token, ['owner', 'admin']);

  const subscribers = rows_(sheet_(TAB.subscribers)).filter(function(r){ return r['ID']; });
  const logs = rows_(sheet_(TAB.logs));

  const active = subscribers.filter(function(r){
    return String(r['الحالة']) === 'نشط' && bool_(r['موافقة واتساب']);
  });
  const cancelled = subscribers.filter(function(r){
    return String(r['الحالة']) === 'ملغي' && !bool_(r['موافقة واتساب']);
  });
  const appOptIn = subscribers.filter(function(r){ return bool_(r['موافقة إشعارات التطبيق']); });

  const inviteRows = logs.filter(function(r){
    return String(r['ID الإعلان']) === WHATSAPP_DASHBOARD.campaignId &&
      String(r['القناة']) === 'WhatsApp' &&
      String(r['الحالة']) === 'تم';
  });

  const campaignMessages = {};
  let campaignStart = '';
  inviteRows.forEach(function(r){
    const providerId = clean_(r['Provider ID'], 300);
    if (!providerId) return;
    campaignMessages[providerId] = {
      phone: clean_(r['رقم المستلم'], 40),
      providerId: providerId,
      invitedAt: clean_(r['الوقت'], 40),
      status: 'تم الإرسال',
      statusAt: clean_(r['الوقت'], 40),
      error: ''
    };
    const t = clean_(r['الوقت'], 40);
    if (t && (!campaignStart || t < campaignStart)) campaignStart = t;
  });

  const statusRows = logs.filter(function(r){
    return String(r['ID الإعلان']) === WHATSAPP_DASHBOARD.statusId &&
      String(r['القناة']) === 'WhatsApp Status';
  });

  statusRows.forEach(function(r){
    const providerId = clean_(r['Provider ID'], 300);
    if (!providerId || !campaignMessages[providerId]) return;
    const next = clean_(r['الحالة'], 40);
    const current = campaignMessages[providerId].status;
    if (whatsappDashboardStatusRank_(next) >= whatsappDashboardStatusRank_(current)) {
      campaignMessages[providerId].status = next;
      campaignMessages[providerId].statusAt = clean_(r['الوقت'], 40);
      campaignMessages[providerId].error = clean_(r['الخطأ'], 500);
    }
  });

  const messages = Object.keys(campaignMessages).map(function(id){ return campaignMessages[id]; });
  const summary = {
    invited: messages.length,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0,
    active: active.length,
    cancelled: cancelled.length,
    totalSubscribers: subscribers.length,
    appOptIn: appOptIn.length
  };

  messages.forEach(function(m){
    const s = String(m.status || '');
    if (s === 'تمت القراءة') summary.read++;
    else if (s === 'تم التسليم') summary.delivered++;
    else if (s === 'فشل') summary.failed++;
    else if (s === 'تم الإرسال') summary.sent++;
    else summary.pending++;
  });

  // "deliveredOrBetter" and "sentOrBetter" are easier to read in the UI.
  summary.deliveredOrBetter = summary.delivered + summary.read;
  summary.sentOrBetter = summary.sent + summary.delivered + summary.read;
  summary.pending = Math.max(0, summary.invited - summary.sentOrBetter - summary.failed);

  const inbound = logs.filter(function(r){
    if (String(r['ID الإعلان']) !== WHATSAPP_DASHBOARD.webhookId) return false;
    if (String(r['القناة']) !== 'WhatsApp Inbound') return false;
    const t = clean_(r['الوقت'], 40);
    return !campaignStart || !t || t >= campaignStart;
  }).map(function(r){
    return {
      time: clean_(r['الوقت'], 40),
      phone: clean_(r['رقم المستلم'], 40),
      action: clean_(r['الحالة'], 40)
    };
  });

  const joinedPhones = {};
  const leftPhones = {};
  inbound.forEach(function(x){
    const key = phoneKey_(x.phone);
    if (!key) return;
    if (x.action === 'اشتراك') {
      joinedPhones[key] = true;
      delete leftPhones[key];
    } else if (x.action === 'إلغاء الاشتراك') {
      leftPhones[key] = true;
      delete joinedPhones[key];
    }
  });
  summary.campaignJoined = Object.keys(joinedPhones).length;
  summary.campaignLeft = Object.keys(leftPhones).length;

  const recent = logs.filter(function(r){
    const id = String(r['ID الإعلان']);
    return id === WHATSAPP_DASHBOARD.statusId || id === WHATSAPP_DASHBOARD.webhookId;
  }).slice(-WHATSAPP_DASHBOARD.maxRecent).reverse().map(function(r){
    return {
      time: clean_(r['الوقت'], 40),
      phone: clean_(r['رقم المستلم'], 40),
      channel: clean_(r['القناة'], 40),
      status: clean_(r['الحالة'], 40),
      error: clean_(r['الخطأ'], 260)
    };
  });

  const currentSubscribers = subscribers.map(function(r){
    return {
      name: clean_(r['الاسم'], 80),
      phone: clean_(r['رقم واتساب'], 40),
      status: clean_(r['الحالة'], 30),
      whatsappOptIn: bool_(r['موافقة واتساب']),
      appOptIn: bool_(r['موافقة إشعارات التطبيق']),
      joinedAt: clean_(r['تاريخ الانضمام'], 40),
      updatedAt: clean_(r['آخر تحديث'], 40)
    };
  });

  return {
    ok: true,
    campaignId: WHATSAPP_DASHBOARD.campaignId,
    campaignStart: campaignStart,
    summary: summary,
    recent: recent,
    subscribers: currentSubscribers,
    generatedAt: now_()
  };
}

function whatsappDashboardStatusRank_(status) {
  const s = String(status || '');
  if (s === 'تمت القراءة') return 4;
  if (s === 'تم التسليم') return 3;
  if (s === 'تم الإرسال') return 2;
  if (s === 'فشل') return 5;
  return 1;
}
