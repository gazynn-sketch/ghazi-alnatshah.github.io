// Natsha Family — automatic prayer-time Firebase push scheduler
// Add this file to the SAME Apps Script project as FirebasePushAddon.gs.
// Then create a time-driven trigger for prayerPushTick every minute.

const PRAYER_PUSH = Object.freeze({
  city: 'Amman',
  country: 'Jordan',
  method: 3,
  school: 0,
  timeZone: 'Asia/Amman'
});

const PRAYER_PUSH_ITEMS = Object.freeze([
  {key: 'Fajr', name: 'الفجر'},
  {key: 'Dhuhr', name: 'الظهر'},
  {key: 'Asr', name: 'العصر'},
  {key: 'Maghrib', name: 'المغرب'},
  {key: 'Isha', name: 'العشاء'}
]);

function prayerPushTick() {
  const now = new Date();
  const date = Utilities.formatDate(now, PRAYER_PUSH.timeZone, 'dd-MM-yyyy');
  const currentTime = Utilities.formatDate(now, PRAYER_PUSH.timeZone, 'HH:mm');
  const timings = getPrayerPushTimings_(date);
  const props = PropertiesService.getScriptProperties();

  PRAYER_PUSH_ITEMS.forEach(function(prayer) {
    const prayerTime = cleanPrayerTime_(timings[prayer.key]);
    if (!prayerTime || prayerTime !== currentTime) return;

    const sentKey = 'PRAYER_PUSH_SENT_' + date + '_' + prayer.key;
    if (props.getProperty(sentKey) === '1') return;

    const title = 'دخول وقت صلاة ' + prayer.name;
    const body = 'حان الآن وقت صلاة ' + prayer.name + ' في عمّان — تقبل الله طاعتكم.';

    sendFirebaseTopicMessage_(title, body, 'prayer-scheduler');
    props.setProperty(sentKey, '1');
    cleanupOldPrayerPushKeys_(props, date);
  });
}

function getPrayerPushTimings_(date) {
  const props = PropertiesService.getScriptProperties();
  const cacheDate = props.getProperty('PRAYER_PUSH_TIMINGS_DATE');
  const cacheJson = props.getProperty('PRAYER_PUSH_TIMINGS_JSON');

  if (cacheDate === date && cacheJson) {
    try {
      return JSON.parse(cacheJson);
    } catch (ignore) {}
  }

  const endpoint =
    'https://api.aladhan.com/v1/timingsByCity/' +
    encodeURIComponent(date) +
    '?city=' + encodeURIComponent(PRAYER_PUSH.city) +
    '&country=' + encodeURIComponent(PRAYER_PUSH.country) +
    '&method=' + PRAYER_PUSH.method +
    '&school=' + PRAYER_PUSH.school;

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'get',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NatshaFamilyPrayerPush/1.0'
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Prayer API HTTP ' + code + ': ' + response.getContentText().slice(0, 300));
  }

  const parsed = JSON.parse(response.getContentText() || '{}');
  if (!parsed.data || !parsed.data.timings) {
    throw new Error('لم يتم العثور على مواقيت الصلاة في رد API');
  }

  const timings = parsed.data.timings;
  props.setProperty('PRAYER_PUSH_TIMINGS_DATE', date);
  props.setProperty('PRAYER_PUSH_TIMINGS_JSON', JSON.stringify(timings));
  return timings;
}

function cleanPrayerTime_(value) {
  const match = String(value || '').match(/^(\d{1,2}:\d{2})/);
  return match ? match[1].padStart(5, '0') : '';
}

function cleanupOldPrayerPushKeys_(props, today) {
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf('PRAYER_PUSH_SENT_') !== 0) return;
    if (key.indexOf('PRAYER_PUSH_SENT_' + today + '_') === 0) return;
    props.deleteProperty(key);
  });
}

function testPrayerPushNow() {
  return sendFirebaseTopicMessage_(
    'اختبار تنبيه الصلاة',
    'سيصل التنبيه تلقائيًا عند دخول وقت كل صلاة حسب توقيت عمّان.',
    'prayer-scheduler-test'
  );
}
