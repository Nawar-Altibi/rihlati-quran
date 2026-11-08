import {SURAH_NAMES} from './data.js';
import {ONBOARDING_STAGES,ONBOARDING_LEVELS,ONBOARDING_GOALS,WEEK_DAYS} from './onboarding.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();
const sel=(value,text,selected)=>'<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(text)+'</option>';
const field=(title,child)=>'<label class="account-field"><span>'+title+'</span>'+child+'</label>';
const button=(action,label,cls='secondary')=>'<button type="button" class="'+cls+'" data-account-action="'+action+'">'+label+'</button>';
const link=(action,label,desc,icon)=>'<button type="button" class="account-center-tile" data-account-action="'+action+'"><span class="account-center-icon" aria-hidden="true">'+icon+'</span><span><b>'+label+'</b><small>'+desc+'</small></span><span aria-hidden="true">‹</span></button>';

export function createSettingsDraft(doc){
  const s=doc?.settings||{},p=s.onboardingProfile||{};
  const stage=ONBOARDING_STAGES.some(v=>v[0]===s.simpleStage)?s.simpleStage:'amma';
  return {
    stage,level:ONBOARDING_LEVELS.some(v=>v[0]===p.level)?p.level:'review',
    goal:ONBOARDING_GOALS.some(v=>v[0]===p.goal)?p.goal:'mixed',
    dailyMinutes:Number.isInteger(s.dailyMinutes)?s.dailyMinutes:30,
    days:Array.isArray(s.memorizationDays)?[...s.memorizationDays]:[0,1,2,3,4,5],
    revisionDays:Array.isArray(s.revisionDays)?[...s.revisionDays]:[0,1,2,3,4,5,6],
    recitationDay:Number.isInteger(s.recitationDay)?s.recitationDay:5,
    knownSurahs:Array.isArray(p.knownSurahs)?p.knownSurahs.map(v=>({...v})):[],query:''
  };
}
export function validateSettingsDraft(d){
  if(!ONBOARDING_STAGES.some(v=>v[0]===d.stage)||!ONBOARDING_LEVELS.some(v=>v[0]===d.level)||
    !ONBOARDING_GOALS.some(v=>v[0]===d.goal))throw Error('راجع مستوى الحفظ والمرحلة والهدف.');
  if(!Number.isInteger(d.dailyMinutes)||d.dailyMinutes<10||d.dailyMinutes>180)
    throw Error('اختار مدة يومية بين 10 و180 دقيقة.');
  for(const k of ['days','revisionDays']){
    const values=d[k];
    if(!Array.isArray(values)||!values.length||new Set(values).size!==values.length||
       values.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error('اختار يومًا واحدًا على الأقل للحفظ والمراجعة.');
  }
  if(!Number.isInteger(d.recitationDay)||d.recitationDay<0||d.recitationDay>6)
    throw Error('اختار يوم تسميع صحيح.');
  if(!Array.isArray(d.knownSurahs)||d.knownSurahs.length>114)throw Error('قائمة السور غير صالحة.');
  const seen=new Set();
  for(const item of d.knownSurahs){
    const surah=SURAH_NAMES[Number(item.surah)-1];
    if(!surah||seen.has(surah.number)||!Number.isInteger(item.fromAyah)||
       !Number.isInteger(item.toAyah)||item.fromAyah<1||item.toAyah>surah.ayahs||
       item.fromAyah>item.toAyah)throw Error('راجع نطاق الآيات في السور المحفوظة.');
    seen.add(surah.number);
  }
  return true;
}
export function buildSettingsUpdate(doc,draft){
  validateSettingsDraft(draft);
  if(!doc||!doc.settings)throw Error('تعذر العثور على إعدادات الحساب.');
  const next=structuredClone(doc);
  const s=next.settings;
  s.simpleStage=draft.stage;
  s.dailyMinutes=draft.dailyMinutes;
  s.memorizationDays=[...draft.days].sort((a,b)=>a-b);
  s.revisionDays=[...draft.revisionDays].sort((a,b)=>a-b);
  s.recitationDay=draft.recitationDay;
  s.onboardingProfile={
    ...(s.onboardingProfile||{}),version:1,
    level:draft.level,goal:draft.goal,
    knownSurahs:draft.knownSurahs.map(v=>({...v})),
    studyDays:[...s.memorizationDays]
  };
  // Never touch recorded Quran progress, calendar tasks, or study plan.
  return next;
}
export function toggleAccountSurah(d,n){
  const surah=SURAH_NAMES[Number(n)-1];
  if(!surah)throw Error('السورة غير صالحة.');
  const idx=d.knownSurahs.findIndex(v=>v.surah===surah.number);
  if(idx>=0)d.knownSurahs.splice(idx,1);
  else d.knownSurahs.push({surah:surah.number,fromAyah:1,toAyah:surah.ayahs});
}
export function searchAccountSurahs(d){
  const q=norm(d.query);
  if(!q)return SURAH_NAMES.filter(s=>s.number>=78).slice(0,12);
  return SURAH_NAMES.filter(s=>norm(s.name).includes(q)||String(s.number).includes(q)||
    String(s.number.toLocaleString('ar')).includes(q)).slice(0,16);
}
export function renderAccountSurahMatches(d){
  const matches=searchAccountSurahs(d);
  if(!matches.length)return '<p class="account-center-muted">ما لقينا سورة مطابقة.</p>';
  return matches.map(s=>{
    const active=d.knownSurahs.some(v=>v.surah===s.number);
    return '<button type="button" class="account-known-match'+(active?' selected':'')+
      '" data-account-surah="'+s.number+'" aria-pressed="'+active+'"><span>سورة '+esc(s.name)+'</span><small>'+
      (active?'✓ محددة':'+ أضف')+'</small></button>';
  }).join('');
}
function renderKnown(d){
  const chosen=d.knownSurahs.map(v=>{
    const s=SURAH_NAMES[v.surah-1];
    if(!s)return '';
    return '<div class="account-known-row"><div class="account-known-heading"><b>سورة '+esc(s.name)+
      '</b><button type="button" data-account-surah="'+s.number+'" class="account-known-remove">إزالة</button></div>'+
      '<div class="account-known-range">'+
      field('من الآية','<input class="input" type="number" min="1" max="'+s.ayahs+'" inputmode="numeric" value="'+v.fromAyah+'" data-account-range="fromAyah" data-surah="'+s.number+'">')+
      field('إلى الآية','<input class="input" type="number" min="1" max="'+s.ayahs+'" inputmode="numeric" value="'+v.toAyah+'" data-account-range="toAyah" data-surah="'+s.number+'">')+
      '</div></div>';
  }).join('');
  return '<details class="account-known-editor"><summary>المحفوظ السابق ('+d.knownSurahs.length+' سور) — اختياري</summary>'+
    '<p class="account-center-muted">معلومات شخصية فقط؛ ما بتتحول لإنجازات أو تسميعات متقنة.</p>'+
    field('ابحث عن سورة','<input type="search" class="input" data-account-surah-search value="'+esc(d.query)+'" placeholder="اسم أو رقم السورة" autocomplete="off">')+
    '<div class="account-known-results" data-account-surah-results>'+renderAccountSurahMatches(d)+'</div>'+
    '<div class="account-known-selected">'+chosen+'</div></details>';
}
const days=(name,selected)=>'<div class="account-center-days" role="group" aria-label="'+(name==='memoDays'?'أيام الحفظ':'أيام المراجعة')+'">'+
  WEEK_DAYS.map((day,i)=>'<label class="account-day"><input type="checkbox" name="'+name+'" value="'+i+
   '"'+(selected.includes(i)?' checked':'')+'><span>'+esc(day)+'</span></label>').join('')+'</div>';
export function renderPreferences(d){
  return '<div class="account-center-panel">'+
    '<p class="account-center-muted">تقدر تغيّر اتجاه رحلتك بأي وقت، من دون حذف الحفظ أو المراجعات والأوراد الموجودة.</p>'+
    '<form class="account-center-form" data-account-form="preferences">'+
    '<div class="account-center-two">'+
    field('مرحلة تركيزك الحالية','<select class="select" name="stage">'+ONBOARDING_STAGES.map(v=>sel(v[0],v[1],d.stage)).join('')+'</select>')+
    field('مستواك','<select class="select" name="level">'+ONBOARDING_LEVELS.map(v=>sel(v[0],v[1],d.level)).join('')+'</select>')+
    field('هدف رحلتك','<select class="select" name="goal">'+ONBOARDING_GOALS.map(v=>sel(v[0],v[1],d.goal)).join('')+'</select>')+
    field('وقت يومي بالدقائق','<input class="input" name="dailyMinutes" type="number" min="10" max="180" step="5" value="'+esc(d.dailyMinutes)+'" required>')+
    '</div><div class="account-center-label">أيام الحفظ</div>'+days('memoDays',d.days)+
    '<div class="account-center-label">أيام المراجعة</div>'+days('reviewDays',d.revisionDays)+
    field('يوم التسميع المعتاد','<select class="select" name="recitationDay">'+WEEK_DAYS.map((name,i)=>sel(i,name,d.recitationDay)).join('')+'</select>')+
    renderKnown(d)+'<p class="account-center-muted">تغيير مرحلة البداية ما بيمسح سجلاتك ولا بيولّد أوراد جديدة تلقائيًا. بتقدر تعدّل الأوراد الموجودة من «خطة القرآن».</p>'+
    '<button class="primary account-submit" type="submit">حفظ التفضيلات</button></form></div>';
}
export function formatSavedAt(value){
  if(!value||!Number.isFinite(Date.parse(value)))return 'لم يتوفر وقت الحفظ بعد';
  return new Intl.DateTimeFormat('ar',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
}
export function renderAccountCenter(view,{user,status,lastSavedAt,revision,blocked,pending,busy}){
  const display=esc(user?.displayName||user?.email||'حسابي');
  const email=esc(user?.email||'');
  const profile='<div class="account-user account-center-profile"><span class="account-avatar">'+
    esc((user?.displayName||user?.email||'ق').trim()[0])+'</span><div><b>'+display+
    '</b><small dir="ltr">'+email+'</small><span class="account-center-provider">متصل بحساب Google</span></div></div>';
  const bar='<div class="account-center-nav">'+(view==='dashboard'?'':button('center-home','← العودة إلى حسابي'))+
    '<span class="account-center-status">'+esc(status)+'</span></div>';
  if(view==='dashboard')return '<div class="account-dashboard account-center">'+profile+
    '<div class="account-cloud-state">'+esc(status)+'</div>'+
    '<p class="account-center-muted">آخر حفظ مؤكد: '+esc(formatSavedAt(lastSavedAt))+'</p>'+
    '<div class="account-center-menu">'+
    link('center-plan','إدارة خطتي','الأهداف، المدة، أيام الحفظ والمراجعة','✎')+
    link('center-sync','المزامنة والنسخ الاحتياطي','آخر حفظ، حالة التقدم، وتصدير نسخة','☁')+
    link('center-privacy','الخصوصية والبيانات','تصدير سجلاتك ومعرفة حدود الحذف','♙')+
    '</div><div class="account-center-footer">'+
    button('switch-account','الخروج والدخول بحساب آخر','secondary')+
    button(pending||blocked?'export-and-logout':'logout',pending||blocked?'تنزيل نسخة احتياطية ثم الخروج':'تسجيل الخروج','account-logout')+
    '</div></div>';
  if(view==='sync')return '<div class="account-dashboard account-center">'+bar+
    '<h3>المزامنة والنسخ الاحتياطي</h3>'+
    '<div class="account-cloud-state">'+esc(status)+'</div>'+
    '<dl class="account-center-facts"><div><dt>آخر حفظ مؤكد في السحابة</dt><dd>'+esc(formatSavedAt(lastSavedAt))+'</dd></div>'+
    '<div><dt>مراجعة بيانات الحساب</dt><dd>#'+Number(revision||0)+'</dd></div></dl>'+
    (blocked?'<p class="account-notice account-notice-error">في تعارض مع جهاز آخر. لن نستبدل بياناته. صدّر نسخة احتياطية أولًا.</p>':'')+
    '<p class="account-center-muted">المزامنة التلقائية بتشتغل وقت تغير بيانات حسابك. تقدر تتحقق من نسختك بالسحابة يدويًا.</p>'+
    '<div class="account-center-actions">'+button('sync','تحقق من المزامنة الآن')+
    button('export','تنزيل نسخة احتياطية JSON')+'</div>'+
    '<p class="account-center-muted">النسخة الاحتياطية تحتوي تقدم الحساب الحالي، وقد تحتوي تغييرات لم ترفع بعد إذا كانت المزامنة معلقة.</p></div>';
  if(view==='privacy')return '<div class="account-dashboard account-center">'+bar+
    '<h3>الخصوصية وبياناتي</h3><p>نحفظ خطتك وسجلات الحفظ والمراجعة والتسميع ضمن حسابك في Supabase. الوصول إلى بيانات الحساب محمي بسياسات RLS، ونسخة الضيف على جهازك مستقلة.</p>'+
    '<div class="account-center-actions">'+button('export','تصدير بيانات رحلتي')+'</div>'+
    '<section class="account-center-danger"><h4>حذف الحساب نهائيًا</h4>'+
    '<p>لسه ما فعّلنا حذف حساب Google وبياناته نهائيًا، لأن العملية تحتاج مسار خادم آمن واختبارًا قبل إطلاقها. تنزيل نسخة احتياطية أو تسجيل الخروج لا يحذف حسابك.</p>'+
    '<button type="button" disabled aria-disabled="true" title="غير متاح حتى اكتمال مسار الحذف الآمن">حذف الحساب — غير متاح حاليًا</button></section></div>';
  return profile;
}
