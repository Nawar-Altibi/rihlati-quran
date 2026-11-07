# إعداد Supabase لتشغيل حسابات «رِحلتي مع القرآن»

**الحالة:** الكود جاهز للاختبار؛ **إنشاء الحسابات العامة مقفل افتراضيًا** حتى تنفيذ هذه الخطوات واختبار حسابين حقيقيين. لا ترسل مفاتيح سرية عبر الدردشة أو GitHub.

## 1) أنشئ مشروع Supabase

- افتح https://supabase.com/dashboard وأنشئ مشروعًا باسم مثل `rihlati-quran`.
- استخرج **Project URL** ومفتاح **Publishable key** (`sb_publishable_...`)، وليس `service_role` أو `sb_secret_`.
- في SQL Editor نفّذ محتوى `supabase/migrations/001_user_state.sql` حرفيًا.
- تأكد أن RLS مفعّل على `public.user_state` و`public.account_recovery_proofs` وأن role `anon` ليس له أي Grants.
- يتطلب تحديث SQL إنشاء جدول إثباتات الاستعادة؛ لا تفعّل الحسابات على قاعدة بيانات لا تحتوي الجدولين وسياسات RLS الخاصة بهما.

## 2) البريد والمصادقة

- من Authentication > Providers > Email: فعّل البريد وكلمة المرور و**تأكيد البريد إلزاميًا**.
- حدد Site URL إلى `https://rihlati-quran.pages.dev`.
- في Email Templates، بدّل قالب **Confirm Signup** إلى رسالة توضّح الرمز وتحتوي `{{ .Token }}`، مثل «رمز التأكيد الخاص بك: {{ .Token }}».
- بدّل قالب **Reset Password** إلى رسالة OTP تحتوي `{{ .Token }}` بنفس الأسلوب. واجهة التطبيق تطلب الرمز ولا تتعامل مع Fragment access tokens في رابط عام.
- بعد نجاح OTP للاستعادة، يخزن الخادم بصمة nonce قصيرة العمر في `account_recovery_proofs`. قبل تغيير كلمة المرور يحذف الخادم الصف بشرط مطابقة المستخدم والبصمة؛ الحذف الذري يجعل الإثبات غير قابل لإعادة الاستخدام. يتطلب ذلك تطبيق كامل ملف SQL أعلاه.
- **SMTP مخصص للإنتاج ضروري.** خدمة التجربة الافتراضية في Supabase محدودة جدًا (2 رسالة/ساعة في وثائق Password Auth) ولا ينبغي اعتمادها لجمهور حقيقي.

## 3) حماية الحسابات من البوتات

- من Cloudflare Turnstile أنشئ Site key وSecret key مرتبطة بدومين المنصة.
- من إعدادات Supabase Auth > Bot and Abuse Protection فعّل Turnstile **بنفس** المفاتيح.
- واجهة الموقع ترسل رمز Turnstile للخادم؛ الخادم يعيد تمريره إلى Supabase Auth داخل `gotrue_meta_security.captcha_token`، وSupabase يتحقق منه. لا تستعمل رمز التحقق مرتين.
- اضبط قيود معدل الطلبات وCloudflare WAF، خصوصًا إرسال OTP وتسجيل الدخول.
- افحص رسائل تأكيد البريد/استعادة كلمة المرور مع بريدين مختلفين.

## 4) أسرار Cloudflare Pages

في مشروع `rihlati-quran` > Settings > Environment variables أضف:

| الاسم | النوع | الملاحظة |
|---|---|---|
| `SUPABASE_URL` | Text | رابط المشروع فقط (HTTPS / *.supabase.co) |
| `SUPABASE_PUBLISHABLE_KEY` | Text | **Publishable key**، لا تستخدم service_role |
| `AUTH_FLOW_SECRET` | Secret | قيمة عشوائية 32+ حرفًا، لمراجعة رمز استعادة كلمة المرور |
| `TURNSTILE_SITE_KEY` | Text | مفتاح واجهة التحقق |
| `TURNSTILE_SECRET_KEY` | Secret | مفتاح Turnstile السري للتحقق من جاهزية التسجيل |
| `ACCOUNTS_ENABLED` | Text | `true` فقط بعد تهيئة SQL والحماية |
| `ACCOUNT_REGISTRATION_ENABLED` | Text | `true` **بعد اختبار SMTP وTurnstile** |

**لا تضع مفتاح Supabase service_role في Cloudflare أو GitHub.** الـAPI يستخدم Publishable key مع JWT المستخدم وسياسات RLS.

بعد إضافة المتغيرات **أعد نشر أحدث Commit من main**؛ تغيير متغيرات البيئة وحده لا يغيّر إصدار Pages القديم.

## 5) اختبار الإطلاق قبل إعلان توفر الحسابات

1. ابدأ بـ `ACCOUNT_REGISTRATION_ENABLED=false`، وافحص `GET /api/account` و`GET /api/account/state` بدون دخول.
2. في بيئة تجريبية **مع SMTP وTurnstile** فعّل التسجيل وأكّد حساب A بالبريد ثم سجّل الدخول.
3. أنشئ خطة A واحفظها، ثم افتح الموقع من متصفح/جهاز آخر وسجّل دخول A: يجب ظهور الخطة نفسها.
4. سجّل خروج A. افتح B: لا تظهر بيانات A مطلقًا. جرّب طلبات REST بالـJWT من B نحو `user_id` لـA؛ يجب أن تعيد 0 صفوف بفضل RLS.
5. جرّب تعارض تعديلين من جهازين: يجب أن تظهر رسالة حفظ نسخة احتياطية، ولا يمسح أحدهما الآخر.
6. جرّب «نسيت كلمة المرور»: تحقق OTP، عيّن كلمة جديدة. أعد طلب تعيين كلمة المرور بنفس جلسة الاستعادة؛ يجب رفضه لأن إثبات OTP استُهلك. جرّب أيضًا رفض التغيير من جلسة عادية بلا OTP.
7. جرّب نقل سجل ضيف موجود **فقط بموافقة**. يجب ألا تختفي بياناته بعد الخروج.
8. جرّب تعطيل/انقطاع الإنترنت وتجنّب إغلاق النافذة أثناء ظهور «جاري الحفظ»؛ صدّر نسخة عند أخطاء المزامنة.
9. اختبر الواجهة على شاشات 390 و430 و768 و1512، والـDark/Light، ولوحة المفاتيح.
10. أكمل سياسة خصوصية ومراجعة الاحتفاظ بالبيانات وحذف حسابات المستخدمين ودعم الاستعادة قبل إطلاق عام.

## حالة الإعداد الفعلية — 2026-11-07

- **Supabase المتصل:** مشروع `xjalftonhiipohjophyv` في `us-east-1`، وقد أكد مالك المشروع أنه مخصص لرِحلتي مع القرآن.
- **SQL:** طُبقت migration `20261107085937_001_user_state` على المشروع. الجدولان `public.user_state` و`public.account_recovery_proofs` موجودان، كلاهما RLS مفعّل، و`anon` لا يملك SELECT، وSecurity Advisor لم يُظهر ملاحظات لحظة الفحص.
- **Cloudflare Pages / Preview فقط:** أُضيفت متغيرات `SUPABASE_URL` و`SUPABASE_PUBLISHABLE_KEY` و`AUTH_FLOW_SECRET` و`TURNSTILE_SITE_KEY` و`TURNSTILE_SECRET_KEY` مع `ACCOUNTS_ENABLED=true` و`ACCOUNT_REGISTRATION_ENABLED=false`. الأسرار غير مدرجة في المستودع.
- **Cloudflare Turnstile:** أُنشئ widget باسم `Rihlati Quran — account protection` للدومين `rihlati-quran.pages.dev` والنطاقات الفرعية. هذا لا يعني أنه فُعّل داخل إعدادات **Supabase Auth** بعد.
- **Production:** لم تُضبط متغيرات الحسابات في بيئة production؛ تبقى وظيفة الحسابات غير مفعّلة في النسخة العامة.
- **الإعدادات المعلقة:** تغيير اسم عرض مشروع Supabase إلى `Rihlati Quran` من لوحة التحكم، تأكيد البريد و`Site URL`، SMTP مخصص وقوالب OTP، ربط Turnstile ضمن Supabase Auth، الحماية من كثرة الطلبات، حقوق المستخدم والخصوصية والحذف، والاختبارات الحقيقية بحسابين.
- **ملاحظة 2026:** المشاريع الجديدة على خطة Supabase Free مع مزوّد البريد الافتراضي قد لا تسمح بتعديل قوالب البريد؛ إعداد SMTP مخصص مطلوب لاستخدام قوالب OTP المقصودة.
- **بوابة الإطلاق:** لا يُفعّل `ACCOUNT_REGISTRATION_ENABLED=true` ولا يُدمج هذا الفرع بغرض الإطلاق حتى تكتمل التحققات أعلاه.

## حالة التنفيذ والربط

- المتصفح في وضع ضيف يعمل كما كان، باستثناء أن الزائر الجديد يبدأ بسجل فارغ بدل بيانات صاحب المشروع.
- `GET /api/account` يعيد `enabled:false` إذا لم تضبط متغيرات Supabase السابقة؛ نافذة الحساب تشرح أن التفعيل غير جاهز.
- لا تستخدم نسخة Preview كإثبات على نجاح تسجيل حساب حقيقي قبل وجود مشروع Supabase وإرسال البريد.
- بيانات الضيف القديمة محفوظة بنفس المفتاح `rihlati-quran-v1` ولا تُنقل إلى الحساب أو تُحذف تلقائيًا.

**مراجع موثقة:**
https://supabase.com/docs/guides/auth/passwords
https://supabase.com/docs/guides/auth/auth-email-templates
https://supabase.com/docs/guides/auth/auth-captcha
https://supabase.com/docs/guides/database/postgres/row-level-security
