import { uiIcon } from './ui-icons.js';

const days=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const phaseOptions=['جارٍ العمل','قادم','اختياري','لاحقًا','مكتمل'];
function label(text,icon,description=''){
  return '<div class="settings-card-heading"><span class="settings-section-icon">'+uiIcon(icon,20)+'</span><div><h2>'+text+'</h2>'+(description?'<p>'+description+'</p>':'')+'</div></div>';
}
const row=(id,title,control,hint='')=>'<div class="settings-field"><label for="'+id+'">'+title+'</label>'+control+(hint?'<small>'+hint+'</small>':'')+'</div>';
const input=(id,value,attributes='')=>'<input class="input" id="'+id+'" '+attributes+' value="'+value+'">';
const select=(id,options)=>'<select class="select" id="'+id+'">'+options+'</select>';
const opt=(value,text,selected)=>'<option value="'+value+'"'+(selected?' selected':'')+'>'+text+'</option>';
function weekdayChips(name,selected=[]){
  return '<div class="settings-day-chips" role="group" aria-label="'+(name==='memo-days'?'أيام الحفظ':'أيام المراجعة')+'">'+
    days.map((day,i)=>'<label class="settings-day-chip"><input type="checkbox" name="'+name+'" value="'+i+'"'+(selected?.includes(i)?' checked':'')+'><span>'+day+'</span></label>').join('')+'</div>';
}
function ornament(){
  return '<svg class="settings-hero-illustration" viewBox="0 0 270 195" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" focusable="false">'+
    '<circle cx="137" cy="97" r="82" stroke="#D8D4AC" opacity=".28" stroke-width="1.5"/>'+
    '<circle cx="137" cy="97" r="64" stroke="#D8D4AC" opacity=".36" stroke-dasharray="4 6"/>'+
    '<path d="M137 16 150 48 182 34 177 68 209 80 181 100 200 127 167 130 165 163 137 146 108 163 106 130 74 127 94 100 65 80 98 68 93 34 125 48Z" stroke="#D8D4AC" stroke-opacity=".18"/>'+
    '<rect x="94" y="64" width="85" height="70" rx="16" fill="#F6E6C2" fill-opacity=".12" stroke="#E4D3AD" stroke-opacity=".58"/>'+
    '<path d="M137 79v41M137 87c-11-8-24-9-32-6v33c10-3 22-2 32 6 10-8 22-9 32-6V81c-8-3-21-2-32 6Z" stroke="#FAEDC9" stroke-width="3" stroke-linejoin="round"/>'+
    '<path d="m120 95 11 3M144 98l11-3M120 105l11 3M144 108l11-3" stroke="#E7CF9C" stroke-width="2" stroke-linecap="round"/>'+
    '<circle cx="213" cy="45" r="4" fill="#E4D3AD" opacity=".6"/><circle cx="58" cy="137" r="3" fill="#E4D3AD" opacity=".6"/>'+
    '</svg>';
}
function section(inner,klass=''){
  return '<section class="card settings-module '+klass+'">'+inner+'</section>';
}
export function renderSettingsUI(s,{esc,SURAH_NAMES}){
  const target=Number(s.targetPages);
  const edition=esc(s.mushafEdition||'');
  const recDay=Number(s.recitationDay)||0;
  const inputs=section(
    label('الهدف والوقت','target','اضبط مقدارًا واقعيًا تقدر تلتزم فيه يوميًا.')+
    '<div class="settings-fields settings-fields-two">'+
    row('set-target','هدف الحفظ اليومي',select('set-target',
      opt('0.5','نصف صفحة',target===.5)+opt('1','صفحة',target===1)+opt('2','صفحتان',target===2)+opt('custom','مخصص',![.5,1,2].includes(target))))+
    row('set-minutes','وقت الدراسة (دقيقة)',input('set-minutes',Number(s.dailyMinutes)||30,'type="number" min="5" max="300" step="5"'))+
    row('set-custom','هدفي المخصص بالصفحات',input('set-custom',Number(s.customTarget)||.5,'type="number" min="0.1" max="50" step="0.1"'),
      'يُطبّق إذا اخترت «مخصص» أعلاه.')+
    row('set-recitation','يوم التسميع المعتاد',select('set-recitation',days.map((d,i)=>opt(i,d,recDay===i)).join('')))+
    '</div>','settings-module-target');
  const weekly=section(
    label('أيام الحفظ والمراجعة','calendar','اختر أيامك، وخلّي جدولك مرن مع الدراسة والجامعة.')+
    '<div class="settings-weekly"><div class="settings-week-item"><b>'+uiIcon('book',17)+' أيام الحفظ</b>'+
    weekdayChips('memo-days',s.memorizationDays)+'</div>'+
    '<div class="settings-week-item"><b>'+uiIcon('refresh',17)+' أيام المراجعة</b>'+
    weekdayChips('review-days',s.revisionDays)+'</div></div>','settings-module-weekly');
  const quran=section(
    label('التتبع والمصحف','book','خيارات التسجيل وطريقة قراءة تقدمك.')+
    '<div class="settings-fields settings-fields-two">'+
    row('set-tracking','طريقة متابعة الحفظ',select('set-tracking',
      opt('surah','حسب السورة',s.tracking==='surah')+opt('page','حسب الصفحات',s.tracking==='page')))+
    row('set-start','ابدأ حفظًا جديدًا من',select('set-start',
      SURAH_NAMES.map(x=>opt(x.number,esc(x.number.toLocaleString('ar')+' · '+x.name),Number(s.startSurah)===x.number)).join('')))+
    row('set-edition','طبعة المصحف',input('set-edition',edition,'type="text" autocomplete="off"'))+
    row('set-intervals','فواصل المراجعة (بالأيام)',input('set-intervals',esc((s.reviewIntervals||[]).join(', ')),'type="text" dir="ltr" inputmode="text"'),
      'مثال: 1, 3, 7, 14, 30')+
    '</div>','settings-module-quran');
  const data=section(
    label('المظهر والنسخ الاحتياطي','shield','بياناتك محفوظة بهذا المتصفح فقط.')+
    '<label class="settings-theme-row" for="set-dark"><span class="settings-theme-mark">'+uiIcon('moon',20)+'</span>'+
    '<span class="settings-theme-copy"><b>المظهر الداكن</b><small>اختر الوضع المريح لعينيك</small></span>'+
    '<input class="toggle" type="checkbox" id="set-dark"'+(s.theme==='dark'?' checked':'')+'></label>'+
    '<div class="settings-backup-actions">'+
    '<button type="button" class="secondary" data-action="export">'+uiIcon('download',18)+' تصدير نسخة JSON</button>'+
    '<button type="button" class="secondary" data-action="import">'+uiIcon('upload',18)+' استيراد نسخة</button>'+
    '<input id="import-file" class="hidden" type="file" accept="application/json" aria-label="استيراد ملف نسخة احتياطية JSON"></div>'+
    '<p class="settings-privacy">'+uiIcon('info',16)+' احتفظ بنسخة احتياطية، خصوصًا قبل تغيير الجهاز أو المتصفح.</p>',
    'settings-module-backup');
  const phases=s.phases.map((p,i)=>
    '<div class="settings-phase-item"><span class="settings-phase-number">'+(i+1)+'</span>'+
    '<div class="settings-phase-fields"><label class="settings-field"><span>اسم المرحلة</span>'+
    '<input class="input phase-title" data-phase-title="'+i+'" value="'+esc(p.title)+'" aria-label="اسم المرحلة '+(i+1)+'"></label>'+
    '<label class="settings-field"><span>وصف المرحلة</span><textarea class="textarea phase-detail" data-phase-detail="'+i+'" rows="2" aria-label="وصف المرحلة '+(i+1)+'">'+esc(p.detail)+'</textarea></label></div>'+
    '<label class="settings-field settings-phase-state"><span>الحالة</span><select class="select phase-status" data-phase-status="'+i+'" aria-label="حالة المرحلة '+(i+1)+'">'+phaseOptions.map(x=>'<option'+(p.status===x?' selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
    '</div>').join('');
  const month=s.monthlyPlan.map((w,i)=>
    '<div class="settings-month-item"><label class="settings-field"><span>'+esc(w.week)+'</span>'+
    '<input class="input month-title" data-month-title="'+i+'" value="'+esc(w.title)+'" aria-label="عنوان '+esc(w.week)+'"></label>'+
    '<label class="settings-field"><span>التفاصيل</span><textarea rows="2" class="textarea month-detail" data-month-detail="'+i+'" aria-label="تفاصيل '+esc(w.week)+'">'+esc(w.detail)+'</textarea></label></div>').join('');
  const advanced='<section class="settings-advanced"><div class="settings-advanced-head"><span class="settings-overline">خيارات إضافية</span>'+
      '<h2>تخصيص مراحل رحلتك</h2><p>الخيارات التفصيلية صارت مطوية حتى تظل صفحة الإعدادات خفيفة. افتح اللي تحتاجه فقط.</p></div>'+
    '<details class="settings-disclosure"><summary><span class="settings-disclosure-icon">'+uiIcon('layers',19)+'</span>'+
      '<span class="settings-disclosure-label"><b>مراحل الرحلة</b><small>تغيير أسماء المراحل ووصفها وحالتها</small></span>'+
      '<span class="settings-chevron">'+uiIcon('chevron',18)+'</span></summary><div class="settings-disclosure-content settings-phase-grid">'+phases+'</div></details>'+
    '<details class="settings-disclosure"><summary><span class="settings-disclosure-icon">'+uiIcon('calendar',19)+'</span>'+
      '<span class="settings-disclosure-label"><b>الخطة الشهرية التفصيلية</b><small>عدّل الأسابيع ومهام كل مرحلة</small></span>'+
      '<span class="settings-chevron">'+uiIcon('chevron',18)+'</span></summary><div class="settings-disclosure-content settings-month-grid">'+month+'</div></details>'+
    '<div class="settings-advanced-save"><p>'+uiIcon('info',16)+' تغييرات المراحل والخطة التفصيلية تحتاج حفظًا يدويًا.</p>'+
      '<button type="button" class="primary" data-action="save-plans">'+uiIcon('check',18)+' حفظ المراحل والخطة</button></div>'+
    '<details class="settings-disclosure settings-danger-area"><summary><span class="settings-disclosure-icon">'+uiIcon('trash',18)+'</span>'+
      '<span class="settings-disclosure-label"><b>إعادة ضبط البيانات</b><small>إجراء نهائي، افتحه فقط عند الحاجة</small></span>'+
      '<span class="settings-chevron">'+uiIcon('chevron',18)+'</span></summary>'+
      '<div class="settings-disclosure-content"><p>حذف جميع السجلات والإنجازات من هذا المتصفح وإعادة البيانات الأولية. لا يمكن التراجع بدون نسخة احتياطية.</p>'+
      '<button type="button" class="danger small-btn" data-action="reset">'+uiIcon('trash',16)+' إعادة ضبط جميع البيانات</button></div></details>'+
    '</section>';
  return '<div class="settings-page"><header class="settings-hero"><div class="settings-hero-content">'+
    '<div class="settings-overline">'+uiIcon('sparkle',17)+' مساحة التخصيص</div>'+
    '<h1>الإعدادات على راحتك</h1><p>كل ما تحتاجه لتنظيم الحفظ والمراجعة، بدون قوائم طويلة أو فراغات مزعجة.</p>'+
    '<div class="settings-hero-chips"><span>'+uiIcon('checkcircle',15)+' الخيارات اليومية تُحفظ تلقائيًا</span>'+
    '<span>'+uiIcon('shield',15)+' بياناتك على جهازك</span></div></div>'+ornament()+'</header>'+
    '<div class="settings-layout"><div class="settings-column">'+inputs+weekly+'</div>'+
      '<div class="settings-column">'+quran+data+'</div></div>'+advanced+'</div>';
}
