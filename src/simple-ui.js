import { SIMPLE_STAGES, getCurrentStage, getSurahUnit, surahName, dueSurahReviews, recordDailyReviews, createGroupRecitation, completeGroupRecitation, advanceSimpleStage, surahNumbers } from './simple-flow.js';
import { todayKey, addDays } from './logic.js';

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = day => day ? new Intl.DateTimeFormat('ar', { day:'numeric', month:'short' }).format(new Date(day + 'T12:00:00')) : 'غير محدد';
const weekNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const statusText = unit => !unit ? 'لم تبدأ مراجعتها' : unit.lastRating === 'متقن' ? 'مراجعة ممتازة' : unit.lastRating === 'أخطاء بسيطة' ? 'جيدة' : unit.lastRating === 'يحتاج مراجعة' || unit.lastRating === 'ضعيف' ? 'تحتاج تثبيت' : 'بانتظار أول تقييم';
const btn = (action, label, klass = 'primary', id = '') => '<button class="' + klass + '" type="button" data-action="' + action + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + '>' + label + '</button>';

export function createSimpleUI({ getData, persist, toast, openModal, navigate, render, openMemorizeModal }) {
  const d = () => getData();
  const savedReview = n => d().activities.some(a => a.type === 'revision' && a.date === todayKey() && d().units.some(u => u.id === a.unitId && Number(u.surah) === n));

  function currentSurahRows(stage = getCurrentStage(d())) {
    return stage.surahs.map(n => {
      const unit = getSurahUnit(d(), n);
      const due = d().revisions.filter(r => !r.done && unit && r.unitId === unit.id).sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0];
      return '<div class="simple-surah"><div class="simple-surah-name"><span class="simple-verse-mark">۞</span><div><strong>سورة ' + esc(surahName(n)) + '</strong><small>' + esc(statusText(unit)) + (unit?.lastReviewed ? ' · آخر مراجعة ' + fmt(unit.lastReviewed) : '') + '</small></div></div><div class="simple-surah-meta">' + (due ? '<small>القادمة: ' + fmt(due.dueDate) + '</small>' : '') + (savedReview(n) ? '<span class="simple-done">✓ راجعتها اليوم</span>' : '') + btn('simple-review-one', 'راجعها', 'secondary small-btn', String(n)) + '</div></div>';
    }).join('');
  }

  function todayView() {
    const data = d(), stage = getCurrentStage(data);
    const due = dueSurahReviews(data), activities = data.activities.filter(a => a.completed && a.date === todayKey());
    const reviewed = new Set(activities.filter(a => a.type === 'revision').map(a => a.unitId));
    const next = data.scheduledSessions.filter(s => s.date >= todayKey()).sort((a,b) => a.date.localeCompare(b.date))[0];
    const activeSurahs = stage.surahs.filter(n => !getSurahUnit(data, n)?.lastReviewed);
    const suggested = activeSurahs[0] || stage.surahs[0];
    const dueHtml = due.length ? due.slice(0,5).map(r => '<div class="simple-due-row"><div><b>' + esc(r.title) + '</b><small>' + (r.dueDate < todayKey() ? 'متأخرة منذ ' : 'مستحقة ') + fmt(r.dueDate) + '</small></div>' + btn('simple-review-one', 'سجّل مراجعتها', 'secondary small-btn', String(data.units.find(u => u.id === r.unitId)?.surah || '')) + '</div>').join('') : '<p class="simple-muted">ما عندك مراجعات مجدولة مستحقة الآن. فيك تراجع أي سورة بدك ياها وتسجلها.</p>';
    return '<section class="simple-hero"><div><div class="simple-kicker">وردك اليوم · ' + fmt(todayKey()) + '</div><h1>السلام عليكم ورحمة الله وبركاته</h1><p>خطوة صغيرة كل يوم، وحفظ أثبت بإذن الله.</p><span class="simple-phase-tag">' + esc(stage.title) + '</span></div><div class="simple-hero-flower" aria-hidden="true">۞</div></section>' +
    '<section class="simple-main-actions"><div class="simple-primary-card"><div class="simple-kicker">سجّل إنجازك بخطوة واحدة</div><h2>شو عملت اليوم؟</h2><p>اختار السور اللي راجعتها واحفظها سوا، حتى لو كانت مراجعة إضافية قبل موعدها.</p><div class="simple-actions">' + btn('simple-review-open', '✓ راجعت', 'primary') + btn('simple-memorize', '＋ حفظت', 'secondary') + btn('simple-teacher-now', '◉ سمّعت', 'secondary') + '</div></div><div class="simple-side-card"><div class="simple-kicker">المرحلة الحالية</div><h3>' + esc(stage.title) + '</h3><p>' + esc(stage.description) + '</p>' + (suggested ? '<div class="simple-tip">مقترح للبدء: سورة ' + esc(surahName(suggested)) + '</div>' : '') + btn('simple-plan-link', 'افتح خطة القرآن', 'secondary small-btn') + '</div></section>' +
    '<section class="simple-overview"><div class="simple-panel"><h2>مراجعاتك المستحقة <span class="simple-count">' + due.length + '</span></h2>' + dueHtml + '</div><div class="simple-panel"><h2>تسميعك القادم</h2>' + (next ? '<p>موعد ' + fmt(next.date) + ' · ' + (next.surahs || [next.surah]).filter(Boolean).map(surahName).join('، ') + '</p>' : '<p class="simple-muted">لسه ما حددت جلسة تسميع. اختار يوم يناسبك وصاحبك.</p>') + btn('simple-teacher-schedule', 'جدولة تسميع', 'secondary small-btn') + '<div class="simple-today-count">أنشطة اليوم المسجلة: <b>' + activities.length + '</b></div></div></section>';
  }

  function quranView() {
    const data = d(), stage = getCurrentStage(data), index = SIMPLE_STAGES.findIndex(s => s.id === stage.id);
    const visited = stage.surahs.filter(n => Boolean(getSurahUnit(data,n)?.lastReviewed)).length;
    const phases = SIMPLE_STAGES.map((s,i) => '<div class="simple-phase-item ' + (i === index ? 'is-current' : '') + '"><span class="simple-phase-number">' + (i+1) + '</span><div><b>' + esc(s.title) + '</b><small>' + esc(s.description) + '</small></div><span>' + (i < index ? 'تم الانتقال' : i === index ? 'الحالية' : 'لاحقًا') + '</span></div>').join('');
    return '<header class="simple-page-heading"><div><div class="simple-kicker">رحلتك مع القرآن</div><h1>خطة القرآن</h1><p>المرحلة الحالية فقط، من غير تشتيت ببقية الأجزاء.</p></div></header>' +
    '<section class="simple-main-actions"><div class="simple-panel"><div class="simple-kicker">المرحلة الحالية</div><h2>' + esc(stage.title) + '</h2><p>' + esc(stage.description) + '</p><div class="simple-track"><span style="width:' + Math.round(visited/Math.max(stage.surahs.length,1)*100) + '%"></span></div><small>' + visited + ' من ' + stage.surahs.length + ' سور لها مراجعة مقيّمة (لا يعني إتقانها جميعًا)</small><div class="simple-actions">' + btn('simple-review-open', 'سجّل مراجعة', 'primary') + (stage.newMemorization ? btn('simple-memorize', 'سجّل حفظًا جديدًا', 'secondary') : '') + '</div></div><div class="simple-panel"><h2>مراحل الرحلة</h2>' + phases + (index < SIMPLE_STAGES.length-1 ? btn('simple-stage-next', 'أنهيت المرحلة، انتقل للتالية', 'secondary small-btn') : '') + '</div></section>' +
    '<section class="simple-panel simple-surah-panel"><div class="simple-panel-heading"><h2>سور ' + esc(stage.title) + '</h2><span>راجع كل سورة عندما يناسبك</span></div><div class="simple-surah-grid">' + currentSurahRows(stage) + '</div></section>';
  }

  function sessionsView() {
    const data = d(), next = [...data.scheduledSessions].filter(s => s.date >= todayKey()).sort((a,b) => a.date.localeCompare(b.date));
    const history = [...data.sessions].filter(s => s.date || s.factual).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
    return '<header class="simple-page-heading"><div><div class="simple-kicker">مع الشيخ أو صاحبك المجيز</div><h1>التسميع</h1><p>موعد واحد، وممكن تسمّع فيه عدة سور.</p></div><div class="simple-actions">' + btn('simple-teacher-schedule', '＋ جدولة تسميع', 'primary') + btn('simple-teacher-now', 'سجّل تسميع اليوم', 'secondary') + '</div></header>' +
      '<div class="simple-panel"><h2>يوم التسميع المعتاد</h2><p>المحدد في الإعدادات: <b>' + weekNames[Number(data.settings.recitationDay)||0] + '</b>. اليوم المعتاد للتذكير فقط؛ سجل الموعد الفعلي لما تتفق عليه.</p>' + btn('simple-settings', 'تعديل اليوم', 'secondary small-btn') + '</div>' +
      '<div class="simple-panel"><h2>الجلسات القادمة</h2>' + (next.length ? next.map(s => '<div class="simple-due-row"><div><b>' + fmt(s.date) + '</b><small>' + esc((s.surahs || [s.surah]).filter(Boolean).map(surahName).join('، ') || 'السور غير محددة') + '</small></div>' + btn('simple-teacher-complete', 'سجّل النتيجة', 'primary small-btn', s.id) + '</div>').join('') : '<p class="simple-muted">لا يوجد تسميع مخطط بعد.</p>') + '</div>' +
      '<div class="simple-panel"><h2>التسميع السابق</h2>' + (history.length ? history.slice(0,20).map(s => '<div class="simple-due-row"><div><b>' + esc((s.surahs || [s.surah]).filter(Boolean).map(surahName).join('، ') || s.title) + '</b><small>' + (s.date ? fmt(s.date) : 'سجل قديم بدون تاريخ') + ' · ' + esc(s.result || 'غير محدد') + '</small></div></div>').join('') : '<p class="simple-muted">سجّل أول جلسة تسميع لعرضها هنا.</p>') + '</div>';
  }

  function progressView() {
    const data = d(), active = data.activities.filter(a=>a.completed), uniqueDays = new Set(active.map(a=>a.date)), reviews = active.filter(a=>a.type==='revision'), sessions = data.sessions.filter(s=>s.date), weak = data.units.filter(u=>u.lastRating === 'ضعيف' || u.lastRating === 'يحتاج مراجعة');
    const recent = [...active].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15);
    return '<header class="simple-page-heading"><div><div class="simple-kicker">نتيجة الاستمرار</div><h1>تقدمي</h1><p>إنجازات سجلتها بالفعل، وليس تخمينًا عن المحفوظ السابق.</p></div></header>' +
    '<div class="simple-metrics"><div><strong>' + uniqueDays.size + '</strong><span>يوم نشاط</span></div><div><strong>' + reviews.length + '</strong><span>مراجعة مسجلة</span></div><div><strong>' + sessions.length + '</strong><span>جلسة تسميع</span></div><div><strong>' + weak.length + '</strong><span>سورة تحتاج تثبيت</span></div></div>' +
    '<div class="simple-panel"><h2>آخر أنشطتك</h2>' + (recent.length ? recent.map(a=>'<div class="simple-due-row"><div><b>' + (a.type==='revision' ? 'مراجعة ' + esc(surahName(data.units.find(u=>u.id===a.unitId)?.surah)) : a.type==='session' ? 'تسميع' : a.type==='memorization' ? 'حفظ' : 'نشاط') + '</b><small>' + fmt(a.date) + (a.rating ? ' · ' + esc(a.rating) : '') + '</small></div></div>').join('') : '<p class="simple-muted">لسه ما سجلت نشاطات. أول مراجعة رح تظهر هون.</p>') + '</div>' +
    '<div class="simple-panel"><h2>تفاصيل إضافية</h2><p class="simple-muted">التقويم والإحصائيات التفصيلية متاحة في الخيارات المتقدمة.</p><div class="simple-actions">' + btn('simple-calendar-link', 'التقويم', 'secondary small-btn') + btn('simple-analytics-link', 'الإحصائيات', 'secondary small-btn') + '</div></div>';
  }

  function surahCheckboxes(numbers, selected = []) {
    return '<div class="simple-picker-list">' + numbers.map(n => '<div class="simple-picker-row" data-search-name="' + esc(surahName(n)) + '"><label><input type="checkbox" name="surahs" value="' + n + '" ' + (selected.includes(n) ? 'checked' : '') + '><span>سورة ' + esc(surahName(n)) + '</span></label><select class="select simple-rating" name="rating-' + n + '" aria-label="تقييم سورة ' + esc(surahName(n)) + '"><option value="">راجعتها فقط (دون تقييم)</option><option value="متقن">متقن</option><option value="أخطاء بسيطة">جيد</option><option value="يحتاج مراجعة">يحتاج تثبيت</option><option value="ضعيف">ضعيف</option></select></div>').join('') + '</div>';
  }

  function openReview(preselected = []) {
    const stage = getCurrentStage(d());
    const previous = SIMPLE_STAGES.filter(s => SIMPLE_STAGES.indexOf(s) < SIMPLE_STAGES.indexOf(stage)).flatMap(s=>s.surahs);
    const extra = (stage.id === 'baqarah' ? [2] : stage.surahs);
    const all = [...new Set([...extra,...previous])];
    const select = preselected.length ? [...new Set([...preselected,...all])] : all;
    openModal('سجّل مراجعتك', '<input type="hidden" name="simpleDailyReview" value="1"><div class="simple-modal-intro">اختار السور اللي راجعتها اليوم، ولو بس سورة واحدة. التقييم اختياري لكل سورة.</div><label class="field"><span>تاريخ المراجعة</span><input class="input" type="date" name="date" value="' + todayKey() + '" required></label><label class="field"><span>ابحث عن سورة</span><input class="input" type="search" id="simple-surah-search" placeholder="اسم السورة..."></label>' + surahCheckboxes(select, preselected) + '<label class="field"><span>ملاحظاتك (اختياري)</span><textarea class="textarea" name="notes" rows="2" placeholder="مواضع تحتاج إعادة أو تصحيح..."></textarea></label><div class="simple-modal-hint">إذا تركت التقييم فارغًا، رح نحفظ المراجعة من دون اعتبار السورة متقنة أو تغيير موعدها.</div>');
  }

  function openGroupPlan(immediate = false) {
    const stage = getCurrentStage(d()), selected = stage.surahs;
    const previous = SIMPLE_STAGES.filter(s => SIMPLE_STAGES.indexOf(s) < SIMPLE_STAGES.indexOf(stage)).flatMap(s=>s.surahs);
    const numbers = [...new Set([...selected,...previous])];
    const labels = numbers.map(n=>'<label class="simple-select-chip"><input type="checkbox" name="surahs" value="' + n + '"> سورة ' + esc(surahName(n)) + '</label>').join('');
    openModal(immediate ? 'تسجيل تسميع اليوم' : 'جدولة تسميع', '<input type="hidden" name="simpleGroupPlan" value="1"><input type="hidden" name="doneNow" value="' + (immediate ? '1' : '0') + '"><div class="simple-modal-intro">حدد السور اللي رح تسمّعها ضمن جلسة واحدة.</div><label class="field"><span>التاريخ</span><input class="input" type="date" name="date" value="' + todayKey() + '" required></label><label class="field"><span>المعلّم أو صاحبك (اختياري)</span><input class="input" name="teacher" placeholder="الاسم"></label><div class="field"><span>السور</span><div class="simple-chip-list">' + labels + '</div></div>' + (immediate ? '<label class="field"><span>النتيجة</span><select class="select" name="result"><option>غير محدد</option><option>اجتاز</option><option>يحتاج تكرار</option></select></label>' : '') + '<label class="field"><span>ملاحظات (اختياري)</span><textarea class="textarea" name="notes"></textarea></label>');
  }

  function openGroupDone(id) {
    const session = d().scheduledSessions.find(s=>s.id===id);
    if(!session) return toast('لم نعثر على هذا الموعد.');
    openModal('نتيجة جلسة التسميع', '<input type="hidden" name="simpleGroupDone" value="' + esc(id) + '"><p>السور: ' + esc((session.surahs || [session.surah]).filter(Boolean).map(surahName).join('، ')) + '</p><label class="field"><span>تاريخ التسميع الفعلي</span><input class="input" type="date" name="date" value="' + todayKey() + '" required></label><label class="field"><span>النتيجة</span><select class="select" name="result"><option>غير محدد</option><option>اجتاز</option><option>يحتاج تكرار</option></select></label><label class="field"><span>أخطاء التجويد وملاحظات المعلّم (اختياري)</span><textarea class="textarea" name="notes" rows="3"></textarea></label>');
  }

  function handleAction(action, id) {
    switch(action) {
      case 'simple-review-open': openReview(); return true;
      case 'simple-review-one': openReview([Number(id)]); return true;
      case 'simple-memorize': openMemorizeModal(); return true;
      case 'simple-teacher-schedule': openGroupPlan(); return true;
      case 'simple-teacher-now': openGroupPlan(true); return true;
      case 'simple-teacher-complete': openGroupDone(id); return true;
      case 'simple-stage-next': if(confirm('هل أنهيت هذه المرحلة فعلًا؟ ستبقى مراجعات المراحل السابقة مستحقة عند موعدها.')) { if(advanceSimpleStage(d())) { persist(); render(); toast('مبارك! انتقلت للمرحلة التالية.'); } } return true;
      case 'simple-plan-link': navigate('quran'); return true;
      case 'simple-calendar-link': navigate('calendar'); return true;
      case 'simple-analytics-link': navigate('analytics'); return true;
      case 'simple-settings': navigate('settings'); return true;
    }
    return false;
  }

  function submit(form, fd) {
    if(fd.has('simpleDailyReview')) {
      const nums = fd.getAll('surahs').map(Number), ratings={}, notes={};
      for (const n of nums) { ratings[n]=String(fd.get('rating-'+n)||''); notes[n]=String(fd.get('notes')||''); }
      try {
        const result = recordDailyReviews(d(), { surahs: nums, date: String(fd.get('date')), ratings, notes });
        if (!result.created) return toast('سجلت هذه السور اليوم مسبقًا؛ ما أضفنا سجلات مكررة.'), true;
        if(!persist()) return true;
        document.querySelector('#modal-root').innerHTML = '';
        render();
        toast('سُجلت ' + result.created + ' مراجعة' + (result.duplicates ? ' · وتجاهلنا المكرر' : '') + '.');
      } catch(err) { toast(err.message); }
      return true;
    }
    if(fd.has('simpleGroupPlan')) {
      try {
        const date=String(fd.get('date')), doneNow=fd.get('doneNow')==='1';
        if(doneNow && date>todayKey()) throw new Error('تاريخ التسميع لا يمكن أن يكون في المستقبل.');
        if(!doneNow && date<todayKey()) throw new Error('اختر تاريخًا اليوم أو بعده للجدولة.');
        const session=createGroupRecitation(d(), {date,surahs:fd.getAll('surahs'),teacher:String(fd.get('teacher')||''),notes:String(fd.get('notes')||'')});
        if(doneNow) completeGroupRecitation(d(),session.id,{date,result:String(fd.get('result')),notes:String(fd.get('notes')||'')});
        if(!persist()) return true;
        document.querySelector('#modal-root').innerHTML='';
        render();toast(doneNow?'سُجّل التسميع بنجاح.':'تمت جدولة التسميع.');
      } catch(err) {toast(err.message);}
      return true;
    }
    if(fd.has('simpleGroupDone')) {
      try {
        completeGroupRecitation(d(),String(fd.get('simpleGroupDone')),{date:String(fd.get('date')),result:String(fd.get('result')),notes:String(fd.get('notes')||'')});
        if(!persist()) return true;
        document.querySelector('#modal-root').innerHTML='';render();toast('حُفظت نتيجة التسميع.');
      } catch(err){toast(err.message);}
      return true;
    }
    return false;
  }

  function modalInput(e) {
    if(e.target.id === 'simple-surah-search') {
      const q = e.target.value.trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
      document.querySelectorAll('.simple-picker-row').forEach(row => {row.hidden = !row.dataset.searchName.replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').includes(q);});
    }
  }

  return { page: view => ({today:todayView, quran:quranView, sessions:sessionsView, progress:progressView}[view] || todayView)(), handleAction, submit, modalInput, openReview };
}
