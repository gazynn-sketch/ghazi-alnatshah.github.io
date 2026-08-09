/*
 * Natsha Family — WhatsApp subscription invitation broadcast
 * Sends the approved Meta template to all subscribers whose WhatsApp consent
 * is already recorded as TRUE and whose status is active.
 *
 * Approved template: natsha_family_subscription_v2
 * Replies "تم" / "انسحب" are already handled by the existing webhook.
 */

const NATSHA_SUBSCRIPTION_BROADCAST = Object.freeze({
  templateName: 'natsha_family_subscription_v2',
  language: 'ar',
  batchSize: 40,
  cursorProperty: 'NATSHA_SUB_BROADCAST_CURSOR',
  runningProperty: 'NATSHA_SUB_BROADCAST_RUNNING',
  sentProperty: 'NATSHA_SUB_BROADCAST_SENT',
  triggerFunction: 'continueNatshaSubscriptionBroadcast'
});

function startNatshaSubscriptionBroadcast() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty, '0');
  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '1');
  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.sentProperty, '[]');
  removeNatshaSubscriptionBroadcastTriggers_();
  return continueNatshaSubscriptionBroadcast();
}

function continueNatshaSubscriptionBroadcast() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty) !== '1') {
    return {ok:false, error:'الإرسال الجماعي غير مفعّل'};
  }

  const phoneId = props.getProperty(WHATSAPP.phoneIdProperty);
  const accessToken = props.getProperty(WHATSAPP.accessTokenProperty);
  const graphVersion = getWhatsAppGraphVersion_();
  if (!phoneId || !accessToken || !graphVersion) {
    throw new Error('بيانات WhatsApp Cloud API غير مكتملة في Script Properties');
  }

  const seen = {};
  const recipients = rows_(sheet_(TAB.subscribers))
    .filter(function(r) {
      return String(r['الحالة']) === 'نشط' && bool_(r['موافقة واتساب']) && phoneKey_(r['رقم واتساب']);
    })
    .filter(function(r) {
      const p = phoneKey_(r['رقم واتساب']);
      if (!p || seen[p]) return false;
      seen[p] = true;
      return true;
    });

  let cursor = parseInt(props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty) || '0', 10);
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

  let sentPhones = [];
  try {
    sentPhones = JSON.parse(props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.sentProperty) || '[]');
    if (!Array.isArray(sentPhones)) sentPhones = [];
  } catch (ignore) {
    sentPhones = [];
  }
  const sentSet = {};
  sentPhones.forEach(function(p){ sentSet[String(p)] = true; });

  const end = Math.min(cursor + NATSHA_SUBSCRIPTION_BROADCAST.batchSize, recipients.length);
  let sentNow = 0;
  let failedNow = 0;

  for (let i = cursor; i < end; i++) {
    const r = recipients[i];
    const p = phoneKey_(r['رقم واتساب']);
    if (!p || sentSet[p]) continue;

    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: p,
        type: 'template',
        template: {
          name: NATSHA_SUBSCRIPTION_BROADCAST.templateName,
          language: {code: NATSHA_SUBSCRIPTION_BROADCAST.language}
        }
      };

      const response = whatsappApiRequest_(phoneId, accessToken, graphVersion, payload);
      if (response.ok) {
        sentNow++;
        sentSet[p] = true;
        sentPhones.push(p);
        logSend_('SUBSCRIPTION_INVITE', r['رقم واتساب'], 'WhatsApp', 'تم', response.messageId || '', '', 'system');
      } else {
        failedNow++;
        logSend_('SUBSCRIPTION_INVITE', r['رقم واتساب'], 'WhatsApp', 'فشل', '', response.error || '', 'system');
      }
    } catch (err) {
      failedNow++;
      logSend_('SUBSCRIPTION_INVITE', r['رقم واتساب'], 'WhatsApp', 'فشل', '', safeError_(err), 'system');
    }

    Utilities.sleep(100);
  }

  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty, String(end));
  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.sentProperty, JSON.stringify(sentPhones));

  if (end < recipients.length) {
    scheduleNatshaSubscriptionBroadcastNextBatch_();
    return {
      ok:true,
      finished:false,
      totalRecipients:recipients.length,
      processed:end,
      sentTotal:sentPhones.length,
      sentNow:sentNow,
      failedNow:failedNow
    };
  }

  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
  removeNatshaSubscriptionBroadcastTriggers_();
  return {
    ok:true,
    finished:true,
    totalRecipients:recipients.length,
    processed:end,
    sentTotal:sentPhones.length,
    sentNow:sentNow,
    failedNow:failedNow
  };
}

function stopNatshaSubscriptionBroadcast() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
  removeNatshaSubscriptionBroadcastTriggers_();
  return {ok:true, stopped:true};
}

function getNatshaSubscriptionBroadcastStatus() {
  const props = PropertiesService.getScriptProperties();
  let sent = [];
  try {
    sent = JSON.parse(props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.sentProperty) || '[]');
  } catch (ignore) {
    sent = [];
  }
  return {
    ok:true,
    running:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty) === '1',
    cursor:parseInt(props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty) || '0', 10) || 0,
    sentTotal:Array.isArray(sent) ? sent.length : 0,
    template:NATSHA_SUBSCRIPTION_BROADCAST.templateName
  };
}

function scheduleNatshaSubscriptionBroadcastNextBatch_() {
  removeNatshaSubscriptionBroadcastTriggers_();
  ScriptApp.newTrigger(NATSHA_SUBSCRIPTION_BROADCAST.triggerFunction)
    .timeBased()
    .after(60 * 1000)
    .create();
}

function removeNatshaSubscriptionBroadcastTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === NATSHA_SUBSCRIPTION_BROADCAST.triggerFunction) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
