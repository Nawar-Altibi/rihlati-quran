# رِحلتي مع القرآن

An Arabic, right-to-left Quran memorization and revision tracker. The app helps learners record memorized material, plan revisions, track recitation sessions, and follow an Ijazah journey.

## Features

- Dashboard with daily tasks, progress, streaks, and upcoming reviews.
- Memorization records by complete surah, ayah range, Mushaf pages, or a manual description.
- Spaced revision scheduling based on self-assessment.
- Baseline assessments for previously memorized material.
- Recitation session history and planned teacher sessions.
- Study goals, calendar, analytics, dark mode, and responsive Arabic RTL layouts.
- JSON export/import for backup and restore.
- Browser-local storage; no account or server database is required.

## Requirements

- Node.js 18 or newer.
- Wrangler for direct Cloudflare Pages deployments; `npx` can fetch it when needed.

## Development

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

Run the test suite:

```bash
npm test
```

## Build and deploy to Cloudflare Pages

The app is vanilla HTML, CSS, and JavaScript modules, so it has no framework compilation step. The Pages build script copies only the web app into `dist/`; it excludes tests, the local Node server, and documentation from the public asset bundle.

For a direct production deployment, authenticate Wrangler once with `npx wrangler login`, then run:

```bash
npm run deploy:pages
```

This builds the static bundle and deploys it to the `rihlati-quran` Cloudflare Pages project on the `main` production branch. The production build command for a Git-integrated Pages project is `npm run build:pages`, with `dist` as the output directory. Cloudflare Pages is connected to the private GitHub repository [`Nawar-Altibi/rihlati-quran`](https://github.com/Nawar-Altibi/rihlati-quran). Pushes to `main` automatically deploy to production; other branches and pull requests receive preview deployments.

Production URL: <https://rihlati-quran.pages.dev>

## Data and backups

Progress is stored in browser `localStorage` for the current origin and device. It does not sync across browsers or devices. Moving from localhost or another domain does not move localStorage automatically. Export a JSON backup from the existing app, open the deployed site, then import that backup there. Keep personal backup files out of Git; the repository `.gitignore` excludes common backup names.

## Project structure

- `index.html` — RTL app shell and metadata.
- `styles.css` — responsive visual system and theme styles.
- `src/app.js` — application views, forms, and interactions.
- `src/data.js` — surah metadata and initial data.
- `src/logic.js` — progress, validation, scheduling, and date calculations.
- `src/storage.js` — local persistence and data migration.
- `scripts/build-pages.mjs` — creates the clean static `dist/` bundle.
- `test/logic.test.js` — logic and storage migration tests.
- `server.js` — local development server.


## استخدام مبسّط: حفظ جديد بضغطة
في النسخة الجديدة التجريبية، افتح **اليوم → حفظت** ثم:
1. ابحث عن السورة بالاسم (حتى دون تشكيل) أو بالرقم، أو اخترها يدويًا من القائمة الكاملة (114 سورة).
2. اختر **السورة كاملة** أو **نطاق آيات** وحدد بدايته ونهايته من القوائم.
3. سيُحسب الجزء (أو نطاق الأجزاء)، والصفحة/الصفحات، وعدد الآيات تلقائيًا.
4. سجّل الحفظ الذي أنجزته فعلًا، وليس هدفًا مستقبليًا؛ تُنشأ مراجعة أولية بعد الحفظ.
5. للمحفوظ السابق (مثل جزء عمّ وتبارك) استخدم **راجعت**، لا **حفظت**. يمكنك اختيار عدة سور بنفس الوقت.

### دقة الصفحات
تعتمد الفهارس المدمجة على **مصحف المدينة 604 صفحات برواية حفص**. *نطاق الصفحات* مطابق لحدود الآيات في هذا المصحف. أما **«مقدار الحفظ التقريبي»** فيقدّر الكسر من الصفحة بنسبة عدد الآيات المحددة إلى عدد آيات الصفحة، وليس قياسًا للأحرف أو الأسطر؛ لذلك لا يُستخدم كدليل على عدد الأسطر المحفوظة. تغيير طبعة المصحف يتطلب فهرسًا خاصًا بها.

المصدر: [quran-center/quran-meta](https://github.com/quran-center/quran-meta) بموجب ترخيص MIT. نص الرخصة في [licenses/quran-meta-MIT.txt](licenses/quran-meta-MIT.txt). البيانات ثابتة محليًا ولا تتطلب API أو إرسال تقدم المستخدم لطرف ثالث.

### الخصوصية والنشر
السجلات في **localStorage** الخاص بكل نطاق/متصفح؛ الموقع الإنتاجي والمعاينات التجريبية لا يتشاركان البيانات. التعديلات على فرع التطوير لا تؤثر في الإنتاج حتى الدمج إلى `main`. صدّر نسخة JSON قبل استيراد أو نقل بياناتك.


## المصحف المدمج (نسخة تجريبية)

يمكن فتح **المصحف** من القائمة الرئيسية، أو فتح سورة محددة من صفحة **خطة القرآن**. يدعم القارئ:

- التنقل بين **604 صفحات** مصحف المدينة، بما فيها الانتقال إلى صفحة محددة.
- البحث عن سورة بالاسم/الرقم والانتقال إليها، والانتقال إلى آية معينة.
- حفظ الموضع الأخير تلقائيًا في بيانات المستخدم المحلية، مع علامة مرجعية اختيارية.
- تحديد الآية بالنقر عليها، ثم «أنهيت المراجعة — سجّلها» لفتح نموذج تقييم المراجعة للسورة المحددة. مجرد القراءة **لا** يحتسب مراجعة مكتملة.
- تحميل آيات الرسم العثماني وفق رواية حفص من [Quran JSON](https://quran-json.risanb.com/) (مصدر النص [Tanzil](https://tanzil.net/)) مع التحقق من ترتيب الآيات وعددها قبل عرضها؛ النص نفسه لا يغيَّر. تطلب الآيات اتصالًا بالإنترنت وتُخزّن مؤقتًا في ذاكرة الصفحة خلال الجلسة. إذا تعطل مصدر النص تظهر رسالة واضحة بدل آيات غير مؤكدة.
- عرض الآيات **ضمن حدود صفحات مصحف المدينة**، وليس نسخة فوتوغرافية من تخطيط أسطر المصحف الورقي.

### ترخيص النص
Tanzil Quran Text (Uthmani, Version 1.1), Copyright (C) 2007-2021 Tanzil Project, CC BY 3.0؛ يُستخدم النص دون تعديل، مع ذكر مصدره ورابط رخصته في واجهة القراءة. النص الكامل لإشعار الحقوق [licenses/tanzil-text-notice.txt](licenses/tanzil-text-notice.txt). توزيع حدود الصفحات MIT من [quran-center/quran-meta](https://github.com/quran-center/quran-meta).

### الخصوصية
بيانات تقدم المستخدم وآخر موضع القراءة والعلامة المرجعية تظل في localStorage لهذا النطاق. يتم جلب نص الآيات من CDN خارجي عند القراءة فقط؛ لا يُرسل التطبيق له سجل الحفظ أو بيانات المستخدم الشخصية.


## اختبار الحفظ الذاتي: كشف الآيات بالتدريج

**اختصار لوحة المفاتيح:** أثناء اختبار الحفظ، اضغط على أي آية مخفية لتحديدها، ثم اضغط **Enter** لكشفها والانتقال تلقائيًا للآية التالية (وتنقل التركيز معها). يمكن تكرار Enter دون استخدام الماوس. يعمل فقط عند التركيز على آية مخفية؛ حقول رقم الصفحة والآية تظل تستجيب لـ Enter كالمعتاد، والضغط المطوّل لا يتجاوز آيات متعددة. عند آخر آية لا ينتقل لصفحة جديدة تلقائيًا.


من **المصحف** اضغط **◉ ابدأ اختبار الحفظ**. تظهر آيات الصفحة الحالية مخفية، بحيث تستطيع تسميع كل آية من الذاكرة قبل كشفها:

1. **اكشف الآية** للمقارنة بالنص الأصلي؛ ينتقل التحديد **تلقائيًا إلى الآية التالية** وهي مخفية، وتظل الآية التي كشفتها ظاهرة للمقارنة. عند آخر آية يتوقف داخل الصفحة، ولا ينتقل لصفحة جديدة دون اختيارك.
2. **الآية السابقة** للتراجع، أو انقر آية محددة (يُحدد رقمها من دون كشف نصها).
3. **عرض جميع الآيات** لفحص الصفحة، و**إخفاء الكشف الكامل** للعودة إلى ما كشفته سابقًا فقط.
4. **ابدأ من جديد** لإخفاء الآيات مجددًا. عند الانتقال لصفحة أخرى يبدأ اختبار جديد للصفحة مع بقاء وضع الاختبار مفعلًا.
5. **إنهاء وضع الاختبار والعودة للقراءة** لإعادة عرض نص المصحف كاملًا.
6. بعد الانتهاء الفعلي، اضغط **أنهيت المراجعة — سجّلها** واختر تقييمك؛ **الاختبار بحد ذاته لا يسجّل إتقانًا ولا ينشئ أنشطة أو مواعيد مراجعة تلقائيًا**.

هذا اختبار بصري ذاتي، **وليس تسميعًا صوتيًا ولا تحققًا آليًا من صحة التلاوة أو التجويد**. الآيات الأصلية لا تُعدّل؛ الإخفاء إجراء عرض مؤقت. البيانات القديمة محفوظة دون تغيير، ولا يوجد نقل للمراجعات إلى السحابة.


## اختبارات عشوائية للحفظ

افتح **اليوم ← ⚡ اختبر حفظي**، أو من صفحة المصحف اختر **اختبار عشوائي**، **مواضع تحتاج تثبيت** أو **مراجعات مستحقة**. يختار التطبيق مقطعًا من سورة مسجلة صراحةً في سجل الحفظ أو جرى تسجيل مراجعتها فعلًا، ويُظهر **حتى ٦ آيات ضمن الصفحة نفسها** مخفية لاختبارك. يظل زر Enter يكشف آية وينتقل تلقائيًا للتالية.

- **المحفوظ المعروف فقط:** السجلات العامة القديمة (مثل «جزء عمّ محفوظ سابقًا») لا تُحوَّل إلى إتقان مزعوم لكل سورة. لو لم يكن لديك سجل سورة صريح، اضغط «راجعت» أولًا وسجل السورة التي راجعتها فعلًا، أو استخدم «حفظت» لمقطع جديد أنجزته.
- **تسجيل مواضع الخطأ:** اكشف الآية ثم اضغط «أخطأت في الآية…» إذا احتجت تصحيحًا. يمكن التراجع بالزر نفسه.
- **حفظ النتيجة:** بعد كشف الآيات واحدة واحدة، اضغط «إنهاء الاختبار وحفظ الأخطاء». يُحفظ *سجل اختبار ذاتي* مستقل في `quizAttempts`، ويظهر عدد الاختبارات والمواضع التي احتجت تثبيتها في صفحة «تقدمي».
- **اختبارات لاحقة:** وضع «مواضع تحتاج تثبيت» يفضّل الآيات التي سبق وعلّمتها خطأً أو السور ضعيفة التقييم، ووضع «المستحقة» يختار من المراجعات المستحقة فعلًا. الاختبار العشوائي يعطي وزنًا إضافيًا للسور أو الآيات الضعيفة.
- **لا إتقان آلي:** لا تُحتسب الآية متقنة بمجرد كشفها، ولا يُنشئ اختبار الحفظ نشاط مراجعة مكتملًا أو يعدّل تقديرات الإتقان دون تسجيل مراجعتك من النموذج المعتاد.
- **الخصوصية:** سجل الاختبارات يبقى محليًا ضمن نسخة المتصفح، ويشمله تصدير بيانات JSON. النسخ التجريبية لها `localStorage` منفصل عن الموقع الرسمي.

**حدود النسخة:** الاختبار الحالي لآيات من صفحة واحدة في كل محاولة، ولا يقيّم التجويد أو الصوت تلقائيًا. الاقتصار على السور/المقاطع المسجلة صراحةً يحميك من الافتراضات الخاطئة عن محفوظك.


## مساعد رحلتي — الخطط اليومية والمحادثة

افتح **مساعد رحلتي** من القائمة (أو من «اليوم»). تجد:

- وردًا يوميًا مقترحًا من سجلاتك الفعلية، موزعًا على وقت المراجعة المحدد في إعداداتك.
- أولوية للآيات التي سجلتها أخطاء في الاختبار الذاتي، ثم المراجعات المستحقة، ثم السور ضعيفة التقييم.
- زر **افتح السورة** للوصول مباشرة إلى المصحف، و**سجّل مراجعة** للتوثيق بإرادتك.
- سؤال وجواب محلي باللغة العربية للسؤال عن الورد، الأخطاء، تقدمك، ومواعيد التسميع المسجلة. **الإجابات المحلية قواعد تنظيمية ذكية وليست نموذج AI لغويًا.** لا تحتاج اتصالًا بخدمة AI مدفوعة ولا ترسل سجلاتك لطرف ثالث.

### نموذج AI السحابي (اختياري ومغلق افتراضيًا)
يضم المشروع Cloudflare Pages Function في `functions/api/mentor.js`، لكنها تفشل بأمان ولا تستدعي أي نموذج إلى حين تجهيز ثلاثة إعدادات **بنفسك** عبر Cloudflare:

1. **Workers AI binding** باسم `AI` في Pages > مشروع `rihlati-quran` > Settings > Bindings، للـ Preview ثم Production بحسب رغبتك.
2. أنشئ D1 database جديدًا مخصصًا للحد اليومي (مثل `rihlati-mentor-quota`) واربطه باسم `MENTOR_QUOTA_DB`. لا يُستخدم لتخزين سجلات الحفظ أو الأسئلة، فقط عدّاد يومي عالمي. يتم إنشاء جدول `mentor_daily_quota` عند أول استدعاء موثّق.
3. عيّن متغيرًا سريًا `MENTOR_ACCESS_TOKEN` بقيمة عشوائية طويلة لا تقل عن **24 رمزًا** من خلال **Variables and Secrets**، ولا تضع الرمز داخل GitHub أو المتصفح العام. خزّنه في مدير كلمات مرور، وأدخله على صفحة المساعد عندما تريد استخدام نموذج AI.

**بعد حفظ bindings أعد النشر**. لا تُفعّل أي حساب مدفوع تلقائيًا. الموديل المستخدم حاليًا هو `@cf/meta/llama-3.2-3b-instruct`، مع حد أقصى **12 استدعاء سحابي لكل يوم UTC عبر قاعدة D1**، ويُوقف الاستدعاء في حال فقدان القاعدة أو الرمز. قد تُطبّق رسوم Cloudflare حسب حسابك واستهلاكك، لذا افحص تسعير Workers AI وحدود حسابك قبل تفعيله.

عندما تختار «استخدم نموذج AI السحابي» لسؤال معين فقط، يُرسَل **السؤال وملخص محدود**: المرحلة، عدد المراجعات، السور الضعيفة، أرقام الآيات التي سجّلتها أخطاء، وموعد التسميع القادم (بدون اسم المعلّم). **لا تُرسل** الملاحظات النصية، معرفات الأنشطة، النص الكامل للمحفوظ، نسخة localStorage، أو سجل المحادثات السابق. الرمز لا يُخزن في localStorage بل في sessionStorage للجلسة الحالية، وتُعرض إجابة محلية إن تعطّل النموذج.

**الأمان والدقة:** المساعد للقراءة والاقتراح فقط، ولا يمكنه حذف البيانات أو تغيير مستوى الحفظ أو إصدار أحكام تجويد أو تأكيد إجازة. المستخدم وحده يسجّل المراجعات. الإتقان لا يُستنتج من ملخص جزء عام أو عدد اختبارات ذاتية.

توثيق Cloudflare: [Pages Functions Bindings](https://developers.cloudflare.com/pages/functions/bindings/) · [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
