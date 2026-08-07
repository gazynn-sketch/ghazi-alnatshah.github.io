# إعداد WhatsApp Cloud API — تطبيق عائلة النتشة

## الحالة
البنية البرمجية للإرسال موجودة في `FamilyNotificationsBackend.gs`، لكن الإرسال يبقى معطلًا حتى تكتمل إعدادات Meta واعتماد القوالب.

## خطوات Meta الرسمية
1. افتح Meta App Dashboard.
2. اختر Create App.
3. اختر use case: **Connect with customers through WhatsApp**.
4. اربط Business Portfolio.
5. من Quickstart اضغط **Start using the API**.
6. اربط/أنشئ WhatsApp Business Account.
7. من API Setup أرسل رسالة اختبار باستخدام Temporary Access Token.
8. بعد نجاح الاختبار أنشئ System User في Business Settings.
9. امنح System User التحكم في التطبيق وWhatsApp Business Account.
10. أنشئ Permanent Access Token بالصلاحيات:
   - `business_management`
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

## القيم المطلوبة للتشغيل
ضع القيم التالية فقط داخل **Google Apps Script → Project Settings → Script Properties**:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `META_GRAPH_VERSION`
- `WHATSAPP_TEMPLATE_EVENT`
- `WHATSAPP_TEMPLATE_DEATH`
- `WHATSAPP_TEMPLATE_LANGUAGE` (مثال: `ar`)

> ممنوع وضع Access Token أو أي Secret داخل GitHub أو ملفات HTML/JavaScript العامة.

## سياسة المستلمين
الإرسال التلقائي عبر Cloud API يكون فقط إلى السجلات التي حالتها `نشط` ولديها `موافقة واتساب = TRUE` في جدول `المشتركون`.

قائمة الأرقام المستوردة لا تُرسل تلقائيًا قبل توثيق موافقة كل مستلم على رسائل واتساب.

## القوالب المقترحة
### قالب عام
اسم مقترح: `natsha_family_event`

متغيرات النص:
1. العنوان
2. نص الإعلان
3. التاريخ والوقت
4. المكان
5. رقم التواصل

### قالب وفاة/تعزية
اسم مقترح: `natsha_family_condolence`

بنفس المتغيرات الخمسة أعلاه.

## الاختبار قبل البث
- ابدأ برقمك الشخصي فقط.
- تأكد أن الرسالة تصل.
- تأكد من تسجيل Message ID في `سجل الإرسال`.
- بعد ذلك جرّب 2–3 مشتركين موافقين.
- لا تبدأ إرسالًا واسعًا قبل نجاح الاختبار واعتماد القالب.

## Webhook لاحقًا
يمكن إضافة Webhook لتسجيل حالات:
- sent
- delivered
- read
- failed

وهذا سيعطينا تقرير إرسال كامل داخل لوحة المدير.
