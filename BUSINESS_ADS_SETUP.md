# تفعيل قسم الإعلانات التجارية

الواجهة في `business-ads.html` وكود الخادم في `BusinessAdsBackend.gs`.

1. أضف ملف Script جديدًا داخل مشروع Google Apps Script الحالي والصق فيه `BusinessAdsBackend.gs`.
2. أضف داخل `doGet`: `if (action === 'listBusinessAds') return json_({ok:true, ads:listPublicBusinessAds_()});`
3. أضف داخل `switch (action)` في `doPost` الحالات: `loginBusinessAds` و`businessAdsSession` و`publishBusinessAd` كما هي موجودة في نسخة `FamilyNotificationsBackend.gs` المحدثة.
4. من **Project Settings → Script Properties** أضف مؤقتًا `BUSINESS_ADS_INITIAL_PASSWORD` بقيمة كلمة المرور الموحّدة المختارة (4 أرقام على الأقل).
5. شغّل `setInitialBusinessAdsPassword` مرة واحدة ووافق على صلاحية Google Drive. ستُحفظ بصمة مشفرة فقط وتُحذف كلمة المرور المؤقتة.
6. انشر نسخة جديدة من Web App مع إبقاء الرابط الحالي نفسه.

سيُنشأ تلقائيًا جدول `الإعلانات التجارية` ومجلد Drive لوسائط الإعلانات. لإيقاف إعلان، غيّر خانة `الحالة` من `منشور` إلى `موقوف`.

لتغيير كلمة المرور لاحقًا، أضف `BUSINESS_ADS_INITIAL_PASSWORD` بالقيمة الجديدة ثم شغّل `setInitialBusinessAdsPassword` مجددًا. الجلسات تنتهي تلقائيًا خلال 6 ساعات.
