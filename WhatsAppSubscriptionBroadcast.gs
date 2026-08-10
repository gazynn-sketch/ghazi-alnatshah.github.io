/*
 * Natsha Family — resilient WhatsApp subscription invitation broadcast
 *
 * Approved template: natsha_family_subscription_v2
 * Replies "تم" / "انسحب" are handled by the existing webhook.
 *
 * Safety / reliability improvements:
 * - Uses LockService to prevent overlapping batches.
 * - Freezes the campaign recipient list in a hidden queue sheet.
 * - Does not keep large phone arrays inside Script Properties.
 * - Re-checks current consent/status immediately before every send.
 * - Retries transient failures automatically up to maxAttempts.
 * - Keeps permanent failures for explicit manual retry after the cause is fixed.
 * - start() refuses to overwrite an existing campaign; use resume()/reset() explicitly.
 */

const NATSHA_SUBSCRIPTION_BROADCAST = Object.freeze({
  templateName: 'natsha_family_subscription_v2',
  language: 'ar',
  batchSize: 40,
  maxAttempts: 3,
  pacingMs: 120,
  retryDelayMs: 60 * 1000,
  queueSheetName: '_WA_SUB_BROADCAST_QUEUE',
  runningProperty: 'NATSHA_SUB_BROADCAST_RUNNING',
  campaignProperty: 'NATSHA_SUB_BROADCAST_CAMPAIGN_ID',
  startedAtProperty: 'NATSHA_SUB_BROADCAST_STARTED_AT',
  cursorProperty: 'NATSHA_SUB_BROADCAST_CURSOR', // kept for backward-compatible status output
  sentProperty: 'NATSHA_SUB_BROADCAST_SENT',     // legacy property; no longer used for storage
  triggerFunction: 'continueNatshaSubscriptionBroadcast'
});

const NATSHA_SUB_BROADCAST_QUEUE_HEADERS = Object.freeze([
  'phone',
  'sourcePhone',
  'status',
  'attempts',
  'lastError',
  'messageId',
  'updatedAt'
]);

function startNatshaSubscriptionBroadcast() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return {ok:false, error:'يوجد تشغيل آخر للبث حاليًا، حاول بعد قليل'};
  }

  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty) === '1') {
      return {
        ok:false,
        error:'يوجد بث اشتراك يعمل حاليًا. استخدم getNatshaSubscriptionBroadcastStatus للمتابعة أو stopNatshaSubscriptionBroadcast للإيقاف.'
      };
    }

    const queue = ensureNatshaSubscriptionBroadcastQueueSheet_();
    const existing = natshaSubscriptionBroadcastQueueSummary_(queue);
    const existingCampaign = props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty) || '';

    if (existingCampaign && existing.total > 0) {
      return {
        ok:false,
        error:'يوجد بث سابق محفوظ ولم يتم مسحه حتى لا تتكرر الرسائل.',
        campaignId:existingCampaign,
        status:existing,
        hint:'استخدم resumeNatshaSubscriptionBroadcast للاستكمال، أو resetNatshaSubscriptionBroadcastCampaign لمسح الحملة وبدء حملة جديدة.'
      };
    }

    const recipients = buildNatshaSubscriptionBroadcastRecipients_();
    if (!recipients.length) {
      return {ok:false, error:'لا يوجد مستلمون نشطون لديهم موافقة واتساب TRUE'};
    }

    queue.clearContents();
    queue.getRange(1, 1, 1, NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length)
      .setValues([NATSHA_SUB_BROADCAST_QUEUE_HEADERS.slice()]);

    const rows = recipients.map(function(r) {
      return [
        r.phone,
        String(r.sourcePhone || ''),
        'PENDING',
        0,
        '',
        '',
        now_()
      ];
    });
    queue.getRange(2, 1, rows.length, NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length).setValues(rows);

    try { queue.hideSheet(); } catch (ignore) {}

    const campaignId = 'WA-SUB-' + Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    props.setProperties({
      [NATSHA_SUBSCRIPTION_BROADCAST.runningProperty]:'1',
      [NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty]:campaignId,
      [NATSHA_SUBSCRIPTION_BROADCAST.startedAtProperty]:now_(),
      [NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty]:'0'
    }, false);
    props.deleteProperty(NATSHA_SUBSCRIPTION_BROADCAST.sentProperty);

    removeNatshaSubscriptionBroadcastTriggers_();
  } finally {
    lock.releaseLock();
  }

  return continueNatshaSubscriptionBroadcast();
}

function resumeNatshaSubscriptionBroadcast() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return {ok:false, error:'يوجد تشغيل آخر للبث حاليًا، حاول بعد قليل'};
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const queue = ensureNatshaSubscriptionBroadcastQueueSheet_();
    const summary = natshaSubscriptionBroadcastQueueSummary_(queue);

    if (!summary.total) {
      return {ok:false, error:'لا توجد حملة محفوظة للاستكمال'};
    }
    if (!summary.remaining) {
      return {ok:true, finished:true, status:summary};
    }

    props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '1');
    removeNatshaSubscriptionBroadcastTriggers_();
  } finally {
    lock.releaseLock();
  }

  return continueNatshaSubscriptionBroadcast();
}

function continueNatshaSubscriptionBroadcast() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty) !== '1') {
    return {ok:false, error:'الإرسال الجماعي غير مفعّل'};
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) {
    return {ok:true, busy:true, message:'هناك دفعة أخرى قيد التنفيذ؛ لم يتم تشغيل دفعة موازية.'};
  }

  try {
    const phoneId = props.getProperty(WHATSAPP.phoneIdProperty);
    const accessToken = props.getProperty(WHATSAPP.accessTokenProperty);
    const graphVersion = getWhatsAppGraphVersion_();

    if (!phoneId || !accessToken || !graphVersion) {
      throw new Error('بيانات WhatsApp Cloud API غير مكتملة في Script Properties');
    }

    const queue = ensureNatshaSubscriptionBroadcastQueueSheet_();
    const lastRow = queue.getLastRow();
    if (lastRow < 2) {
      props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
      removeNatshaSubscriptionBroadcastTriggers_();
      return {ok:true, finished:true, totalRecipients:0, sentTotal:0, failedTotal:0};
    }

    const width = NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length;
    const values = queue.getRange(2, 1, lastRow - 1, width).getValues();
    const candidates = [];

    for (let i = 0; i < values.length; i++) {
      const status = String(values[i][2] || '');
      const attempts = parseInt(values[i][3] || '0', 10) || 0;
      if ((status === 'PENDING' || status === 'RETRY') && attempts < NATSHA_SUBSCRIPTION_BROADCAST.maxAttempts) {
        candidates.push(i);
        if (candidates.length >= NATSHA_SUBSCRIPTION_BROADCAST.batchSize) break;
      }
    }

    if (!candidates.length) {
      props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
      removeNatshaSubscriptionBroadcastTriggers_();
      const done = natshaSubscriptionBroadcastQueueSummaryFromValues_(values);
      props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty, String(done.processed));
      return Object.assign({ok:true, finished:true}, done, {
        campaignId:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty) || ''
      });
    }

    // Build one current subscriber map per batch. This keeps the frozen queue stable,
    // while still honoring a later opt-out before an actual send occurs.
    const currentSubscribers = {};
    rows_(sheet_(TAB.subscribers)).forEach(function(r) {
      const key = phoneKey_(r['رقم واتساب']);
      if (key && !currentSubscribers[key]) currentSubscribers[key] = r;
    });

    let sentNow = 0;
    let failedNow = 0;
    let retryNow = 0;
    let skippedNow = 0;

    candidates.forEach(function(index) {
      const row = values[index];
      const p = phoneKey_(row[0]);
      const sourcePhone = row[1] || row[0];
      const current = p ? currentSubscribers[p] : null;

      if (!current || String(current['الحالة']) !== 'نشط' || !bool_(current['موافقة واتساب'])) {
        row[2] = 'SKIPPED';
        row[4] = 'تم التخطي: لم يعد الرقم نشطًا أو موافقة واتساب ليست TRUE';
        row[6] = now_();
        skippedNow++;
        return;
      }

      const attempts = (parseInt(row[3] || '0', 10) || 0) + 1;
      row[3] = attempts;
      row[4] = '';
      row[6] = now_();

      try {
        const payload = {
          messaging_product:'whatsapp',
          recipient_type:'individual',
          to:p,
          type:'template',
          template:{
            name:NATSHA_SUBSCRIPTION_BROADCAST.templateName,
            language:{code:NATSHA_SUBSCRIPTION_BROADCAST.language}
          }
        };

        const response = whatsappApiRequest_(phoneId, accessToken, graphVersion, payload);
        if (response.ok) {
          row[2] = 'SENT';
          row[4] = '';
          row[5] = response.messageId || '';
          sentNow++;

          logSend_(
            'SUBSCRIPTION_INVITE',
            sourcePhone,
            'WhatsApp',
            'تم',
            response.messageId || '',
            '',
            'system'
          );
        } else {
          const errorText = clean_(response.error || 'خطأ غير معروف من WhatsApp API', 500);
          const retryable = attempts < NATSHA_SUBSCRIPTION_BROADCAST.maxAttempts && isRetryableNatshaSubscriptionBroadcastError_(errorText);
          row[2] = retryable ? 'RETRY' : 'FAILED';
          row[4] = errorText;
          if (retryable) retryNow++; else failedNow++;

          logSend_(
            'SUBSCRIPTION_INVITE',
            sourcePhone,
            'WhatsApp',
            retryable ? 'إعادة محاولة' : 'فشل',
            '',
            errorText,
            'system'
          );
        }
      } catch (err) {
        const errorText = safeError_(err);
        const retryable = attempts < NATSHA_SUBSCRIPTION_BROADCAST.maxAttempts && isRetryableNatshaSubscriptionBroadcastError_(errorText);
        row[2] = retryable ? 'RETRY' : 'FAILED';
        row[4] = errorText;
        if (retryable) retryNow++; else failedNow++;

        logSend_(
          'SUBSCRIPTION_INVITE',
          sourcePhone,
          'WhatsApp',
          retryable ? 'إعادة محاولة' : 'فشل',
          '',
          errorText,
          'system'
        );
      }

      Utilities.sleep(NATSHA_SUBSCRIPTION_BROADCAST.pacingMs);
    });

    queue.getRange(2, 1, values.length, width).setValues(values);

    const summary = natshaSubscriptionBroadcastQueueSummaryFromValues_(values);
    props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty, String(summary.processed));

    if (summary.remaining > 0) {
      scheduleNatshaSubscriptionBroadcastNextBatch_();
      return Object.assign({
        ok:true,
        finished:false,
        sentNow:sentNow,
        failedNow:failedNow,
        retryNow:retryNow,
        skippedNow:skippedNow,
        campaignId:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty) || ''
      }, summary);
    }

    props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
    removeNatshaSubscriptionBroadcastTriggers_();

    return Object.assign({
      ok:true,
      finished:true,
      sentNow:sentNow,
      failedNow:failedNow,
      retryNow:retryNow,
      skippedNow:skippedNow,
      campaignId:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty) || ''
    }, summary);
  } finally {
    lock.releaseLock();
  }
}

function stopNatshaSubscriptionBroadcast() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
  removeNatshaSubscriptionBroadcastTriggers_();
  return Object.assign({ok:true, stopped:true}, getNatshaSubscriptionBroadcastStatus());
}

function retryNatshaSubscriptionBroadcastFailures() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return {ok:false, error:'يوجد تشغيل آخر للبث حاليًا، حاول بعد قليل'};
  }

  let changed = 0;
  try {
    const queue = ensureNatshaSubscriptionBroadcastQueueSheet_();
    const lastRow = queue.getLastRow();
    if (lastRow < 2) return {ok:false, error:'لا توجد حملة محفوظة'};

    const width = NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length;
    const values = queue.getRange(2, 1, lastRow - 1, width).getValues();
    values.forEach(function(row) {
      const status = String(row[2] || '');
      if (status === 'FAILED' || status === 'RETRY') {
        row[2] = 'PENDING';
        row[3] = 0;
        row[4] = '';
        row[5] = '';
        row[6] = now_();
        changed++;
      }
    });

    if (!changed) return {ok:true, changed:0, message:'لا توجد رسائل فاشلة لإعادة المحاولة'};

    queue.getRange(2, 1, values.length, width).setValues(values);
    const props = PropertiesService.getScriptProperties();
    props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '1');
    removeNatshaSubscriptionBroadcastTriggers_();
  } finally {
    lock.releaseLock();
  }

  const result = continueNatshaSubscriptionBroadcast();
  result.requeuedFailures = changed;
  return result;
}

function resetNatshaSubscriptionBroadcastCampaign() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return {ok:false, error:'يوجد تشغيل آخر للبث حاليًا، حاول بعد قليل'};
  }

  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty, '0');
    removeNatshaSubscriptionBroadcastTriggers_();

    const queue = ensureNatshaSubscriptionBroadcastQueueSheet_();
    queue.clearContents();
    queue.getRange(1, 1, 1, NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length)
      .setValues([NATSHA_SUB_BROADCAST_QUEUE_HEADERS.slice()]);
    try { queue.hideSheet(); } catch (ignore) {}

    props.deleteProperty(NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty);
    props.deleteProperty(NATSHA_SUBSCRIPTION_BROADCAST.startedAtProperty);
    props.deleteProperty(NATSHA_SUBSCRIPTION_BROADCAST.cursorProperty);
    props.deleteProperty(NATSHA_SUBSCRIPTION_BROADCAST.sentProperty);

    return {ok:true, reset:true};
  } finally {
    lock.releaseLock();
  }
}

function getNatshaSubscriptionBroadcastStatus() {
  const props = PropertiesService.getScriptProperties();
  const queue = ensureNatshaSubscriptionBroadcastQueueSheet_();
  const summary = natshaSubscriptionBroadcastQueueSummary_(queue);

  return Object.assign({
    ok:true,
    running:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.runningProperty) === '1',
    campaignId:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.campaignProperty) || '',
    startedAt:props.getProperty(NATSHA_SUBSCRIPTION_BROADCAST.startedAtProperty) || '',
    template:NATSHA_SUBSCRIPTION_BROADCAST.templateName,
    maxAttempts:NATSHA_SUBSCRIPTION_BROADCAST.maxAttempts
  }, summary);
}

function buildNatshaSubscriptionBroadcastRecipients_() {
  const seen = {};
  const out = [];

  rows_(sheet_(TAB.subscribers)).forEach(function(r) {
    if (String(r['الحالة']) !== 'نشط' || !bool_(r['موافقة واتساب'])) return;
    const p = phoneKey_(r['رقم واتساب']);
    if (!p || seen[p]) return;
    seen[p] = true;
    out.push({phone:p, sourcePhone:r['رقم واتساب']});
  });

  return out;
}

function ensureNatshaSubscriptionBroadcastQueueSheet_() {
  const ss = db_();
  let s = ss.getSheetByName(NATSHA_SUBSCRIPTION_BROADCAST.queueSheetName);
  if (!s) {
    s = ss.insertSheet(NATSHA_SUBSCRIPTION_BROADCAST.queueSheetName);
    s.getRange(1, 1, 1, NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length)
      .setValues([NATSHA_SUB_BROADCAST_QUEUE_HEADERS.slice()]);
    try { s.hideSheet(); } catch (ignore) {}
  }
  return s;
}

function natshaSubscriptionBroadcastQueueSummary_(queue) {
  const lastRow = queue.getLastRow();
  if (lastRow < 2) return natshaSubscriptionBroadcastQueueSummaryFromValues_([]);
  const values = queue.getRange(2, 1, lastRow - 1, NATSHA_SUB_BROADCAST_QUEUE_HEADERS.length).getValues();
  return natshaSubscriptionBroadcastQueueSummaryFromValues_(values);
}

function natshaSubscriptionBroadcastQueueSummaryFromValues_(values) {
  const counts = {PENDING:0, RETRY:0, SENT:0, FAILED:0, SKIPPED:0};
  (values || []).forEach(function(row) {
    const status = String(row[2] || 'PENDING');
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
    else counts.PENDING++;
  });

  const total = (values || []).length;
  const remaining = counts.PENDING + counts.RETRY;
  const processed = counts.SENT + counts.FAILED + counts.SKIPPED;

  return {
    totalRecipients:total,
    total:total,
    processed:processed,
    remaining:remaining,
    pendingTotal:counts.PENDING,
    retryingTotal:counts.RETRY,
    sentTotal:counts.SENT,
    failedTotal:counts.FAILED,
    skippedTotal:counts.SKIPPED
  };
}

function isRetryableNatshaSubscriptionBroadcastError_(errorText) {
  const s = String(errorText || '').toLowerCase();
  if (!s) return false;

  // Explicitly non-retryable client/config/auth failures.
  if (/http\s*400\b/.test(s) || /http\s*401\b/.test(s) || /http\s*403\b/.test(s)) return false;
  if (/access blocked|invalid.*token|oauth|permission|not authorized|unsupported post request/.test(s)) return false;

  // Typical transient provider/network failures.
  return /http\s*429\b|http\s*5\d\d\b|rate.?limit|temporar|timeout|timed out|connection|network|server error|try again/.test(s);
}

function scheduleNatshaSubscriptionBroadcastNextBatch_() {
  removeNatshaSubscriptionBroadcastTriggers_();
  ScriptApp.newTrigger(NATSHA_SUBSCRIPTION_BROADCAST.triggerFunction)
    .timeBased()
    .after(NATSHA_SUBSCRIPTION_BROADCAST.retryDelayMs)
    .create();
}

function removeNatshaSubscriptionBroadcastTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === NATSHA_SUBSCRIPTION_BROADCAST.triggerFunction) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
