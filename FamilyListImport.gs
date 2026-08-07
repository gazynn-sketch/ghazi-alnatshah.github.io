// أدوات آمنة لدمج قائمة العائلة (298 رقم) مع نظام المشتركين.
// تعتمد هذه الدوال على المساعدات الموجودة في FamilyNotificationsBackend.gs.

const FAMILY_LIST_SOURCE = Object.freeze({
  spreadsheetId: '10x_pPaf7_34xxsK02c8k80DxYmrUZyCVKlwit8lGC3g',
  sheetName: 'قائمة العائلة',
  phoneHeader: 'رقم الهاتف الدولي'
});

function familyListSourceRows_() {
  const book = SpreadsheetApp.openById(FAMILY_LIST_SOURCE.spreadsheetId);
  const sheet = book.getSheetByName(FAMILY_LIST_SOURCE.sheetName);
  if (!sheet) throw new Error('ورقة قائمة العائلة غير موجودة');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  const phoneIndex = headers.indexOf(FAMILY_LIST_SOURCE.phoneHeader);
  if (phoneIndex < 0) throw new Error('عمود رقم الهاتف الدولي غير موجود في قائمة العائلة');
  return values.slice(1).map(function(row, index) {
    return {row:index + 2, phone:row[phoneIndex]};
  });
}

function validWhatsAppPhoneKey_(value) {
  const digits = phoneKey_(value);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

function previewFamilyListImport() {
  const source = familyListSourceRows_();
  const subscribers = rows_(sheet_(TAB.subscribers));
  const existing = {};
  subscribers.forEach(function(r) {
    const k = validWhatsAppPhoneKey_(r['رقم واتساب']);
    if (k) existing[k] = true;
  });

  const seen = {};
  const result = {
    sourceRows:source.length,
    sourceUniqueValid:0,
    sourceDuplicates:0,
    invalidSourceNumbers:0,
    alreadyInSubscribers:0,
    newPending:0
  };

  source.forEach(function(item) {
    const k = validWhatsAppPhoneKey_(item.phone);
    if (!k) { result.invalidSourceNumbers++; return; }
    if (seen[k]) { result.sourceDuplicates++; return; }
    seen[k] = true;
    result.sourceUniqueValid++;
    if (existing[k]) result.alreadyInSubscribers++;
    else result.newPending++;
  });

  Logger.log(JSON.stringify(result));
  return result;
}

function importFamilyListPending() {
  const source = familyListSourceRows_();
  const target = sheet_(TAB.subscribers);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const current = rows_(target);
    const existing = {};
    current.forEach(function(r) {
      const k = validWhatsAppPhoneKey_(r['رقم واتساب']);
      if (k) existing[k] = true;
    });

    const seen = {};
    const objects = [];
    let skippedExisting = 0;
    let skippedDuplicateSource = 0;
    let invalid = 0;

    source.forEach(function(item) {
      const k = validWhatsAppPhoneKey_(item.phone);
      if (!k) { invalid++; return; }
      if (seen[k]) { skippedDuplicateSource++; return; }
      seen[k] = true;
      if (existing[k]) { skippedExisting++; return; }

      const phone = '+' + k;
      objects.push({
        'ID':uid_('SUB'),
        'الاسم':'',
        'رقم واتساب':phone,
        'الدولة':countryFromPhone_(phone),
        'مصدر الاشتراك':'family-list-298',
        'موافقة واتساب':false,
        'موافقة إشعارات التطبيق':false,
        'الحالة':'بانتظار الموافقة',
        'تاريخ الانضمام':'',
        'رمز الإلغاء':Utilities.getUuid().replace(/-/g,'').slice(0,16),
        'آخر تحديث':now_(),
        'ملاحظات':'مستورد من قائمة العائلة؛ لا يتم الإرسال عبر واتساب قبل موافقة صريحة'
      });
      existing[k] = true;
    });

    if (objects.length) {
      const headers = target.getRange(1,1,1,target.getLastColumn()).getValues()[0].map(String);
      const values = objects.map(function(obj) {
        return headers.map(function(h) {
          return Object.prototype.hasOwnProperty.call(obj,h) ? obj[h] : '';
        });
      });
      target.getRange(target.getLastRow()+1,1,values.length,headers.length).setValues(values);
    }

    const result = {
      imported:objects.length,
      skippedExisting:skippedExisting,
      skippedDuplicateSource:skippedDuplicateSource,
      invalidSourceNumbers:invalid
    };
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function dedupeSubscribers() {
  const target = sheet_(TAB.subscribers);
  const values = target.getDataRange().getValues();
  if (values.length < 3) return {deleted:0, duplicateGroups:0};

  const headers = values[0].map(String);
  const phoneIndex = headers.indexOf('رقم واتساب');
  const updatedIndex = headers.indexOf('آخر تحديث');
  if (phoneIndex < 0) throw new Error('عمود رقم واتساب غير موجود');

  const groups = {};
  values.slice(1).forEach(function(row,index) {
    const key = validWhatsAppPhoneKey_(row[phoneIndex]);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      sheetRow:index + 2,
      updated:updatedIndex >= 0 ? new Date(row[updatedIndex]).getTime() || 0 : 0
    });
  });

  const deleteRows = [];
  let duplicateGroups = 0;
  Object.keys(groups).forEach(function(key) {
    const group = groups[key];
    if (group.length < 2) return;
    duplicateGroups++;
    group.sort(function(a,b) {
      if (b.updated !== a.updated) return b.updated - a.updated;
      return b.sheetRow - a.sheetRow;
    });
    group.slice(1).forEach(function(item) { deleteRows.push(item.sheetRow); });
  });

  deleteRows.sort(function(a,b) { return b - a; });
  deleteRows.forEach(function(rowNumber) { target.deleteRow(rowNumber); });

  const result = {deleted:deleteRows.length, duplicateGroups:duplicateGroups};
  Logger.log(JSON.stringify(result));
  return result;
}
