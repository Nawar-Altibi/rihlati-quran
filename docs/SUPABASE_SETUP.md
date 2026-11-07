# إعداد Supabase Auth والبريد لرِحلتي مع القرآن

**حالة 2026-11-07:** قاعدة البيانات وBindings الخاصة بـPreview موجودة. أضيف تدفق Google OAuth برمجيًا، لكن مزود Google لم يُضبط بعد، و`GOOGLE_SIGNIN_ENABLED=false` افتراضيًا. إرسال البريد المخصص والتحقق الواقعي ما زالا معلقين. لا تفعّل التسجيل العام؛ `ACCOUNT_REGISTRATION_ENABLED=false` يظل كما هو.

## ما تم التحقق منه

- مشروع Supabase `xjalftonhiipohjophyv` بحالة `ACTIVE_HEALTHY` في `us-east-1`.
- Migration `20261107085937_001_user_state` مطبقة. جدولا `public.user_state` و`public.account_recovery_proofs` موجودان مع RLS، كما هو موثق في PR #16.
- مشروع Cloudflare Pages هو `rihlati-quran`. نطاقاته المخصصة فارغة؛ النطاق الوحيد هو `rihlati-quran.pages.dev`.
- Preview bindings موجودة و`ACCOUNT_REGISTRATION_ENABLED=false`. إعدادات Production غير مضبوطة للحسابات ويجب أن تظل كذلك.
- لا يوجد اتصال Resend في أدوات هذه الجلسة، ولا توفر وصلة Supabase الحالية تحرير إعدادات Auth/SMTP. لم يُنشأ API key أو يُفحص DNS أو يُرسل بريد حقيقي.
- لا توجد وصلة Google Cloud لإدارة OAuth clients ولا تتيح وصلة Supabase الحالية تعديل إعدادات Auth. لذلك لم يُنشأ OAuth Client ID ولم تُرسل أسرار Google ولم يُفعّل مزود Google.
- تكامل Google منفصل عن SMTP: لا يحتاج OAuth إلى Resend أو نطاق مرسل أو OTP بالبريد. `GOOGLE_SIGNIN_ENABLED` افتراضيًا مغلق، وواجهة الدخول لا تعرض زرًا فعالًا إلا عندما يكون العلم مفعّلًا ويعلن Supabase أن `external.google` مفعّل.

## إعداد Sign in with Google

التدفق البرمجي جاهز خلف `GOOGLE_SIGNIN_ENABLED=false`. ينفذ Pages Function تدفق Authorization Code مع PKCE: ينشئ `state` و`code_verifier` عشوائيين، ويحفظهما موقّعين في cookie مؤقت `Secure; HttpOnly; SameSite=Lax` مدته عشر دقائق. Supabase يدير التحقق من حالة OAuth مع Google؛ عند العودة يتحقق التطبيق أيضًا من `state` والـcookie، ثم يرسل `code` و`code_verifier` إلى Supabase من الخادم. لا تظهر access/refresh tokens في الرابط أو JavaScript أو `localStorage`؛ تحفظ الجلسة في كوكيز HttpOnly الموجودة وتستخدمها عمليات التجديد والخروج الحالية. يُطلب فقط `openid email profile` ولا يُخزن Google provider token.

### Google Cloud

لا توجد وصلة Google Cloud في هذه الجلسة، لذلك لم تُنشأ موارد أو تُغيّر إعدادات. أكمل يدويًا في [Google Cloud Console](https://console.cloud.google.com/auth/overview):

1. اختر المشروع الصحيح أو أنشئ مشروعًا مخصصًا، وأكمل Branding/Consent Screen. لتطبيق External في وضع Testing أضف فقط حسابات Google الاختبارية المصرح بها.
2. أنشئ OAuth Client من نوع **Web application**. استخدم URI الإرجاع الذي تعرضه لوحة Supabase ضمن إعداد Google provider. عنوان API الذي قرأناه من مشروع Supabase هو `https://xjalftonhiipohjophyv.supabase.co`؛ عادةً يظهر callback بالشكل `https://xjalftonhiipohjophyv.supabase.co/auth/v1/callback`. انسخ القيمة النهائية من لوحة المزود ولا تخمّنها أو تستبدلها بعنوان Pages.
3. لا تطلب Drive أو Calendar أو أي نطاقات Google API. يحتاج تسجيل الدخول إلى هوية الحساب والبريد والاسم فقط (`openid email profile`). أضف Authorized JavaScript origins فقط إذا طلبتها صفحة إنشاء العميل؛ عندها استخدم أصل التطبيق الدقيق `https://rihlati-quran.pages.dev` وأصول Preview الفعلية التي ستختبرها، دون wildcard أو أصل غير مملوك.
4. خزّن Client ID وClient Secret بأمان مؤقتًا لإدخالهما في Supabase فقط. لا تضع السر في Cloudflare، GitHub، ملفات المشروع، أو المحادثة.

### Supabase Auth وCloudflare Pages

1. في مشروع `xjalftonhiipohjophyv` افتح **Authentication → Sign In / Providers → Google**، فعّل Google، وأدخل Client ID وClient Secret. يجب أن يكون OAuth callback في Google مطابقًا حرفيًا للقيمة التي يعرضها Supabase.
2. افتح **Authentication → URL Configuration**. Site URL للإنتاج هو `https://rihlati-quran.pages.dev`. أضف Redirect URLs الدقيقة التالية، مع wildcard في نهاية مسار callback للسماح بمعامل `state` العشوائي الذي يتحقق منه التطبيق:
   - `https://rihlati-quran.pages.dev/api/account/google/callback*`
   - Preview فقط: `https://feature-multiuser-auth-found.rihlati-quran.pages.dev/api/account/google/callback*`، أو استخدم اسم فرع Preview الحالي كما يظهر في Cloudflare.
   لا تستخدم `next`, `return_to` أو وجهة يحددها المستخدم؛ callback يحوّل دائمًا إلى الصفحة الرئيسية على نفس الأصل.
3. في Cloudflare Pages اضبط `GOOGLE_SIGNIN_ENABLED=false` في Preview وProduction إلى أن تنجح مراجعة الإعداد. عند غياب المتغير يُغلق التكامل أيضًا. لا تغيّر `ACCOUNT_REGISTRATION_ENABLED`; يجب أن يبقى `false`. لا تحفظ Google Client Secret في Cloudflare؛ يبقى في إعداد مزود Supabase.
4. بعد إدخال إعدادات المزود، تحقق من `Authentication → Sign In / Providers → Google` ومن أن Auth settings تعرض `external.google: true`. لا تفعّل العلم لمجرد وجود Client ID في Google.
5. فعّل `GOOGLE_SIGNIN_ENABLED=true` على **Preview فقط** بعد اكتمال Redirect URLs، ثم اختبر حسابين مصرحًا بهما. يجب أن يبدأ حساب كل مستخدم برحلة خاصة فارغة وخيار استيراد الضيف الصريح، وأن يستعيد المستخدم العائد تقدمه من `user_state` دون استبداله. افحص حسابين وRLS من الخدمة الحية قبل التفكير في Production.
6. إعادة العلم إلى `false` توقف زر Google. تبقى جلسات Supabase القائمة صالحة حتى تنتهي أو يُسجل المستخدم الخروج؛ أوقف جلسة الحساب من الواجهة عند التراجع إذا احتجت إنهاءها فورًا.

### ربط حساب بريد موجود

اترك ربط الهويات لـSupabase Auth. عند تطابق بريد موثق من Google مع بريد موثق موجود، استخدم سلوك الربط المدعوم في Supabase. لا تنشئ مستخدمًا ثانيًا ولا تنقل صفوف `user_state` يدويًا بناءً على مقارنة نص البريد. اختبر حسابًا موجودًا قبل الإنتاج وتأكد أن هوية Google تضاف إلى المستخدم نفسه وأن `user_id` ورقم `revision` لا يتغيران. لا يطلب التطبيق كلمات مرور أو Google tokens، ولا ينفذ دمجًا مخصصًا.

### استكشاف أعطال Google

- `google-unavailable`: تحقق من العلم في بيئة Pages ومن ظهور `external.google: true` في Supabase Auth settings.
- `redirect_uri_mismatch` في Google: انسخ URI الذي تعرضه لوحة Supabase كاملًا، مع HTTPS والمسار `/auth/v1/callback`، إلى Authorized redirect URIs في عميل Google.
- رجوع التطبيق برسالة OAuth عامة: تحقق من Redirect URLs في Supabase لمضيف Pages الصحيح ومسار `/api/account/google/callback*`، ثم تحقق من تفعيل Google ومطابقة Client ID/Secret.
- فشل PKCE/الحالة: أعد التدفق في المتصفح نفسه خلال عشر دقائق؛ لا تعِد فتح رابط callback أو تستخدم code سابقًا.
- لا تتجاوز رسائل الخطأ العامة بإظهار رد المزود للمستخدم؛ افحص سجلات Auth دون نسخ أكواد أو tokens إلى issues.

## مانع النطاق المرسل

Resend يتطلب نطاق إرسال تملكه وتستطيع إضافة سجلات DNS إليه. `rihlati-quran.pages.dev` نطاق فرعي تديره Cloudflare، وليس منطقة DNS يملكها المشروع؛ لا يمكن إثبات ملكيته أو إضافة DKIM/SPF إليه. يلزم أن يختار مالك المشروع نطاقًا مخصصًا يملكه (يفضل نطاقًا فرعيًا مخصصًا لبريد المصادقة مثل `auth.<نطاق-يملكه-المالك>`). لا تستخدم `pages.dev` كعنوان From ولا تخمّن اسم نطاق أو عنوان مرسل.

**توقف عند هذه الخطوة حتى يختار المالك النطاق ويمتلك الوصول إلى DNS وحساب Resend.** لا يمكن تفعيل التسليم الحقيقي بأمان قبل ذلك.

## إعداد Resend والنطاق بعد توفيرهما

1. في Resend افتح **Domains** ثم **Add Domain** وأدخل النطاق أو النطاق الفرعي الذي اختاره المالك.
2. انسخ سجلات DNS التي يعرضها Resend لهذا النطاق حرفيًا إلى مزود DNS authoritative. قد تتضمن سجلات DKIM وSPF، وسجل DMARC موصى به. لا تستبدل سجل SPF موجودًا بسجل ثانٍ؛ ادمج التفويض حسب تعليمات مزود DNS.
3. انتظر انتشار DNS ثم اضغط **Verify** في Resend. تابع حتى تظهر حالة النطاق **Verified** وسجلات الإرسال المطلوبة ناجحة. احفظ لقطة الحالة ووقت التحقق في سجل الإطلاق؛ لا تسجل أي API key.
4. أنشئ Resend API key بصلاحية إرسال لازمة فقط. أدخله مباشرةً في إعداد SMTP الآمن في Supabase، ولا تحفظه في المستودع أو Cloudflare أو دردشة/تعليق PR.
5. بعد التحقق من النطاق، افتح **Resend Dashboard → Integrations → Supabase** واربط مشروع `xjalftonhiipohjophyv` إن كان التكامل الأصلي متاحًا للحساب. وإلا انتقل إلى إعداد SMTP المخصص في Supabase وأدخل القيم التالية:

   | الحقل | القيمة |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Security | SSL/TLS ضمني |
   | Username | `resend` |
   | Password | Resend API key، يُدخل في حقل سرّي |
   | Sender name | `Rihlati Quran` |
   | Sender email | `no-reply@<النطاق الذي تحقّق منه المالك>` |

   إعداد Resend الرسمي يسمح أيضًا بـ587/STARTTLS؛ نستخدم 465/SSL-TLS وفق إعداد المشروع المطلوب. لا تستخدم `onboarding@resend.dev` كمرسل إنتاج.

## إعداد Supabase Auth

في [لوحة Supabase](https://supabase.com/dashboard/project/xjalftonhiipohjophyv):

1. **Authentication → Sign In / Providers → Email**: فعّل Email provider، وأبقِ Email confirmations مفعّلًا. تحقق أن إنشاء المستخدم لا يمنح جلسة قبل تأكيد البريد.
2. **Authentication → URL Configuration**: Site URL هو `https://rihlati-quran.pages.dev`. أضف فقط عناوين Redirect التي تستخدمها فعلًا، ومنها فرع Preview `https://feature-multiuser-auth-found.rihlati-quran.pages.dev` للاختبار. لا تسمح بنطاقات عامة أو wildcard غير لازمة.
3. **Authentication → SMTP Settings**: فعّل Custom SMTP أو أكمل التكامل الأصلي الموثق من Resend. أدخل الإعدادات أعلاه بعد التحقق من النطاق. Supabase يقيّد الإرسال الافتراضي (حاليًا رسالتان/ساعة، وإلى أعضاء فريق المشروع فقط) ولا يصلح لإطلاق عام.
4. **Authentication → Email Templates**:
   - **Confirm signup**: Subject `تأكيد بريدك الإلكتروني | رحلتي مع القرآن`، والصق `supabase/templates/confirm-signup.html` في محتوى HTML.
   - **Reset password**: Subject `استعادة كلمة المرور | رحلتي مع القرآن`، والصق `supabase/templates/reset-password.html`.
   - أبقِ `{{ .Token }}` كما هو. القالبان يذكران صلاحية 10 دقائق؛ لذلك اضبط مدة صلاحية OTP في إعدادات Auth إلى 600 ثانية، وتحقق من القيمة الفعلية قبل اعتماد القالبين. إذا تعذر تطبيق 600 ثانية، عدّل نص القالبين إلى المدة الفعلية قبل الحفظ.
   - محرر قوالب المشروع المستضاف يقدم محتوى HTML ولا يعرض حقلًا مستقلًا للنص العادي؛ القوالب هنا متوافقة مع البريد HTML ولا تعتمد على صور أو خطوط أو سكربتات خارجية.
5. **Authentication → Bot and Abuse Protection / CAPTCHA**: فعّل Turnstile بمفتاح الموقع والسر المطابقين لبيئة الاختبار. لا تعتبر وجود Widget في Cloudflare دليلًا على تفعيله هنا.
6. **Authentication → Rate Limits**: راجع قيود إرسال البريد والتحقق، واحفظ قيمًا تقلل الإساءة وتطابق حد مزود SMTP. اترك حد إعادة الطلب لكل مستخدم عند 60 ثانية على الأقل (متوافق مع عدّاد الواجهة)، وراجع حد IP وإرسال البريد؛ لا ترفع الحدود لمجرد تمرير الاختبارات.
7. راجع إعدادات Security Notifications المدعومة في **Authentication → Email Templates**. أبقِ إشعارات تغيير كلمة المرور/البريد مفعلة وفق سياسة المنتج، وخصصها بالعربية عند الحاجة. لا نرسل هذه الرسائل من Pages Functions؛ يرسلها Supabase Auth.

## قوالب البريد

المصدر الآمن للقوالب:

- `supabase/templates/confirm-signup.html`
- `supabase/templates/reset-password.html`

انقل كل قالب إلى خانة HTML المقابلة في لوحة Auth، ثم احفظ Subject بشكل منفصل كما في الخطوات أعلاه. لا تلصق بيانات المستخدم أو أسرارًا في القوالب. OTP هو الرمز فقط؛ لا تضف access token أو رابط جلسة. لا يتضمن القالب تعقبًا خارجيًا.

## اختبار التسليم قبل فتح التسجيل

1. ابدأ على Preview مع `ACCOUNT_REGISTRATION_ENABLED=false`. افحص `GET /api/account` وتأكد أن `registrationEnabled:false`.
2. بعد التحقق من النطاق وضبط SMTP والقوالب وCAPTCHA والحدود، فعّل التسجيل على **Preview فقط** لفترة الاختبار، باستخدام حسابين بريديين اختباريين مصرّح بهما من المالك.
3. أنشئ حسابًا جديدًا في كل بريد، وافحص رسالة تأكيد البريد: عنوان المرسل، RTL على الهاتف، رمز OTP، ومدة الصلاحية. سجّل نتيجة Supabase Auth logs وResend **Emails/Logs** لكل رسالة.
4. اختبر طلب Resend فورًا (يجب أن يمنع العدّاد ذلك)، وبعد انتهاء 60 ثانية، ثم اختبر 429/حد المزود. اختبر OTP خطأ، منتهي، ومستعمل سابقًا.
5. اختبر الاستعادة لحساب موجود وغير موجود، وتأكد أن واجهة المستخدم تعرض رسالة عامة متطابقة ولا تكشف وجود البريد. تحقق من رسالة الاستعادة ثم إثبات التغيير أحادي الاستخدام.
6. لا تعتبر `200` من Auth أو اختبارًا mock دليلًا على وصول البريد. النجاح يتطلب سجلات Resend بحالة `Delivered` وفحص صندوقي البريد الفعليين (الوارد/Spam) بموافقة المالك. الاستعادة وإعادة الإرسال تعرضان النص نفسه للحساب الموجود/غير الموجود، والحدود، وتعطل SMTP أو الشبكة؛ ولا تدّعي الواجهة أن الرسالة وصلت.
7. بعد الاختبار، أعد `ACCOUNT_REGISTRATION_ENABLED=false`، وتحقق من أن Production لا يحتوي إعدادات الحسابات الجديدة. لا تستخدم بيانات أشخاص حقيقيين للاختبار.

## التراجع واستكشاف الأعطال

- لإيقاف التسجيل فورًا، أعد `ACCOUNT_REGISTRATION_ENABLED=false` في **Preview** ثم انشر إعداد Pages. لا تحذف حسابات أو جداول ولا تغيّر RLS.
- عند فشل الإرسال، افحص Supabase **Logs → Auth** أولًا بحثًا عن SMTP/قالب/حد معدل، ثم Resend **Emails/Logs** وحالة النطاق/DNS. راجع عنوان From ليطابق النطاق الموثق، والمنفذ/TLS، وقيود معدل Resend.
- إذا أفسد قالب الإرسال، أعد HTML السابق من سجل المراجعة أو استخدم قالبًا بسيطًا مؤقتًا يتضمن `{{ .Token }}`. لا تعطل تأكيد البريد كحل مؤقت.
- عند فشل Turnstile، تحقق من تطابق مفتاح الموقع والسر في Supabase وCloudflare Preview، ومن قائمة أسماء النطاقات المسموح بها في Widget.
- لا تضع SMTP key أو Resend API key في سجل build أو console أو GitHub. إذا انكشف مفتاح، دوّره من Resend فورًا ثم حدّث Supabase.

## المتبقي وقرار الإطلاق

- [ ] اختيار نطاق مخصص يملكه المشروع والوصول إلى DNS.
- [ ] توثيق حالة DNS Verified في Resend.
- [ ] إعداد SMTP/التكامل الأصلي في Supabase، إعداد قوالب OTP ومدة 600 ثانية.
- [ ] تفعيل Turnstile داخل Supabase Auth وضبط/مراجعة rate limits.
- [ ] إرسال فعلي إلى صندوقين اختباريين ومراجعة سجلات التسليم.
- [ ] اختبار عزل حسابين، الاستعادة، والمزامنة الحية، واستكمال سياسة الخصوصية والحذف والدعم.

**الحسابات العامة غير آمنة للتفعيل حاليًا.** لا يوجد نطاق إرسال موثق ولا SMTP حي ولا اختبار تسليم حقيقي. أبقِ تسجيل الحسابات معطلًا.

## المراجع

- [Resend SMTP](https://resend.com/docs/send-with-smtp)
- [Resend + Supabase](https://resend.com/supabase)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Auth CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/deployment/going-into-prod#auth-rate-limits)
