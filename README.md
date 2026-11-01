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
