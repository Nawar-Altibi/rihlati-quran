import {SURAH_NAMES, makeNewUserData} from './data.js';
import {todayKey, addDays} from './logic.js';
import {savePlanEntry} from './flexible-plan.js';

// Account setup is intentionally draft-only until the user confirms the preview.
// Self-reported prior memorization is never counted as completed work.
export const ONBOARDING_LEVELS = [
  ['beginner','لسه بدي أبدأ الحفظ','ابدأ بهدوء، حتى لو من أول آية.'],
  ['review','حافظ سابقًا وبدي أراجع','حدد السور اللي بتعرفها لنرتب مراجعتها.'],
  ['mixed','عم أحفظ وبراجع','وازن بين حفظ الجديد وتثبيت القديم.']
];
export const ONBOARDING_GOALS = [
  ['review','مراجعة وتثبيت'],
  ['memorize','حفظ جديد'],
  ['mixed','حفظ ومراجعة']
];
export const ONBOARDING_STAGES = [
  ['amma','جزء عمّ',78],
  ['tabarak','جزء تبارك',67],
  ['qad','جزء قد سمع',58],
  ['baqarah','سورة البقرة',2]
];
export const WEEK_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const STAGE_SUGGESTIONS = {
  amma:[78,79,80,81,82,83,84,85,86,87,88,89],
  tabarak:[67,68,69,70,71,72,73,74,75,76,77],
  qad:[58,59,60,61,62,63,64,65,66],
  baqarah:[2,3,4,5,6]
};
const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm = s => String(s??'').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();
const surah = n => SURAH_NAMES.find(s=>s.number===Number(n));

export function createOnboardingDraft(){
  return {step:0,level:'review',stage:'amma',knownSurahs:[],query:'',goal:'mixed',dailyMinutes:20,days:[0,1,2,3,4]};
}
export function toggleKnownSurah(draft,n){
  const item=surah(n);
  if(!item)throw new Error('السورة غير معروفة.');
  const index=draft.knownSurahs.findIndex(v=>v.surah===item.number);
  if(index>=0)draft.knownSurahs.splice(index,1);
  else draft.knownSurahs.push({surah:item.number,fromAyah:1,toAyah:item.ayahs});
}
export function updateKnownRange(draft,n,field,value){
  if(!['fromAyah','toAyah'].includes(field))throw new Error('نطاق غير صالح.');
  const item=draft.knownSurahs.find(v=>v.surah===Number(n));
  if(!item)throw new Error('اختر السورة أولًا.');
  item[field]=Number(value);
}
export function searchOnboardingSurahs(draft){
  const query=norm(draft.query);
  if(!query)return (STAGE_SUGGESTIONS[draft.stage]||STAGE_SUGGESTIONS.amma)
    .map(surah).filter(Boolean);
  return SURAH_NAMES.filter(s=>norm(s.name).includes(query)||
    String(s.number).includes(query)||
    String(s.number.toLocaleString('ar')).includes(query)).slice(0,16);
}
export function validateOnboardingDraft(draft,step=3){
  if(!ONBOARDING_LEVELS.some(v=>v[0]===draft.level))throw new Error('اختر مستوى البداية.');
  if(!ONBOARDING_STAGES.some(v=>v[0]===draft.stage))throw new Error('اختر مرحلة البداية.');
  if(step>=1){
    if(!Array.isArray(draft.knownSurahs)||draft.knownSurahs.length>114)throw new Error('اختيار السور غير صالح.');
    const seen=new Set();
    for(const item of draft.knownSurahs){
      const s=surah(item.surah);
      if(!s||seen.has(s.number)||!Number.isInteger(item.fromAyah)||!Number.isInteger(item.toAyah)||
        item.fromAyah<1||item.toAyah> s.ayahs||item.fromAyah>item.toAyah)
        throw new Error('راجع نطاق الآيات في السور المحددة.');
      seen.add(s.number);
    }
  }
  if(step>=2){
    if(!ONBOARDING_GOALS.some(g=>g[0]===draft.goal))throw new Error('اختر هدفًا صحيحًا.');
    if(!Number.isInteger(draft.dailyMinutes)||draft.dailyMinutes<10||draft.dailyMinutes>180)
      throw new Error('حدد وقتًا يوميًا بين 10 و180 دقيقة.');
    if(!Array.isArray(draft.days)||draft.days.length===0||new Set(draft.days).size!==draft.days.length||
      draft.days.some(d=>!Number.isInteger(d)||d<0||d>6))
      throw new Error('اختر يومًا واحدًا على الأقل بالأسبوع.');
  }
  return true;
}
export function suggestedOnboardingPlan(draft,start=todayKey()){
  validateOnboardingDraft(draft,3);
  const selected=STAGE_SUGGESTIONS[draft.stage]||STAGE_SUGGESTIONS.amma;
  const stageFirst=ONBOARDING_STAGES.find(s=>s[0]===draft.stage)[2];
  const reviewSurahs=draft.knownSurahs.length?draft.knownSurahs:
    [{surah:selected[0],fromAyah:1,toAyah:Math.min(surah(selected[0]).ayahs,10)}];
  const ideas=[];
  for(let d=0;d<21&&ideas.length<3;d++){
    const date=addDays(start,d);
    if(!draft.days.includes(new Date(date+'T12:00:00').getDay()))continue;
    const position=ideas.length;
    const isReview=draft.goal==='review'||(draft.goal==='mixed'&&position%2===0);
    const current=isReview?reviewSurahs[Math.floor(position/(draft.goal==='review'?1:2))%reviewSurahs.length]:null;
    const mem=surah(stageFirst);
    const span=isReview?current:{surah:mem.number,fromAyah:1,toAyah:Math.min(mem.ayahs,5)};
    ideas.push({date,kind:isReview?'review':'memorize',surah:span.surah,
      fromAyah:span.fromAyah,toAyah:span.toAyah,minutes:draft.dailyMinutes,
      notes:isReview?'مراجعة مقترحة لتقييم الحفظ السابق؛ ليست إنجازًا مسجّلًا.':
        'ورد حفظ مقترح؛ عدّل الآيات والوقت بحسب قدرتك.'});
  }
  return ideas;
}
export function buildOnboardingPayload(draft,start=todayKey()){
  validateOnboardingDraft(draft,3);
  const data=makeNewUserData({stage:draft.stage,dailyMinutes:draft.dailyMinutes});
  data.settings.memorizationDays=[...draft.days].sort((a,b)=>a-b);
  data.settings.revisionDays=[...draft.days].sort((a,b)=>a-b);
  data.settings.startSurah=ONBOARDING_STAGES.find(s=>s[0]===draft.stage)[2];
  data.settings.onboardingProfile={
    version:1,level:draft.level,goal:draft.goal,
    knownSurahs:draft.knownSurahs.map(s=>({...s})),
    studyDays:[...data.settings.memorizationDays]
  };
  // Planned items only; never create units, reviews, sessions or completed activities.
  for(const idea of suggestedOnboardingPlan(draft,start))savePlanEntry(data,idea);
  return data;
}
const opt=(value,label,desc,checked,group)=>'<button type="button" class="onboard-choice'+(checked?' selected':'')+
  '" data-onboard-action="'+group+'" data-value="'+esc(value)+'" aria-pressed="'+(checked?'true':'false')+'">'+
  '<strong>'+esc(label)+'</strong>'+(desc?'<small>'+esc(desc)+'</small>':'')+'</button>';
const action=(name,label,cls)=>'<button type="button" data-onboard-action="'+name+'" class="'+cls+'">'+esc(label)+'</button>';
const currentName=draft=>ONBOARDING_STAGES.find(s=>s[0]===draft.stage)?.[1]||'جزء عمّ';

export function renderSurahSearchResults(draft){
  const items=searchOnboardingSurahs(draft);
  return items.length?items.map(s=>{
    const active=draft.knownSurahs.some(v=>v.surah===s.number);
    return '<button type="button" class="onboard-surah-option'+(active?' selected':'')+
      '" data-onboard-action="surah" data-value="'+s.number+'" aria-pressed="'+(active?'true':'false')+'">'+
      '<span>سورة '+esc(s.name)+'</span><small>'+(active?'✓ محددة':'اختيار')+'</small></button>';
  }).join(''):'<p class="onboard-hint">ما لقينا سورة بهالاسم. جرّب اسم تاني أو رقم السورة.</p>';
}
export function renderOnboardingWizard(draft,guestCounts){
  const step=Math.min(3,Math.max(0,draft.step));
  const names=['البداية','محفوظك السابق','نظامك اليومي','معاينة الخطة'];
  let body='';
  if(step===0){
    body='<h3>وين وصلت برحلتك مع القرآن؟</h3><p>اختار الأقرب لوضعك؛ فيك تغيّره لاحقًا.</p>'+
      '<div class="onboard-choice-stack" role="group" aria-label="مستوى الحفظ">'+
      ONBOARDING_LEVELS.map(v=>opt(v[0],v[1],v[2],draft.level===v[0],'level')).join('')+'</div>'+
      '<h3>من وين بتحب تبدأ؟</h3><div class="onboard-stage-grid" role="group" aria-label="مرحلة البداية">'+
      ONBOARDING_STAGES.map(v=>opt(v[0],v[1],null,draft.stage===v[0],'stage')).join('')+'</div>';
  }
  if(step===1){
    body='<h3>شو السور اللي حافظها من قبل؟</h3>'+
      '<p>اختيار اختياري، حتى للمبتدئين. ما رح نعتبر أي سورة متقنة أو مكتملة قبل ما تسجّل إنجازها بنفسك.</p>'+
      '<label class="account-field"><span>ابحث بين سور القرآن بالاسم أو الرقم</span>'+
      '<input class="input" type="search" data-onboard-search placeholder="مثلاً: النبأ، الملك أو 36" autocomplete="off" value="'+esc(draft.query)+'"></label>'+
      '<div class="onboard-surah-results" data-onboard-results>'+renderSurahSearchResults(draft)+'</div>'+
      '<div class="onboard-known"><h4>المحفوظ المحدد ('+draft.knownSurahs.length+')</h4>'+
      (draft.knownSurahs.length?draft.knownSurahs.map(v=>{
        const s=surah(v.surah);
        return '<div class="onboard-known-row"><div class="onboard-known-title"><strong>سورة '+esc(s.name)+'</strong>'+
          action('surah','إزالة','onboard-link') .replace('data-onboard-action="surah"','data-onboard-action="surah" data-value="'+s.number+'"')+'</div>'+
          '<div class="onboard-range"><label>من الآية<input type="number" class="input" inputmode="numeric" min="1" max="'+s.ayahs+
          '" data-onboard-range="fromAyah" data-surah="'+s.number+'" value="'+v.fromAyah+'"></label>'+
          '<label>إلى الآية<input type="number" class="input" inputmode="numeric" min="1" max="'+s.ayahs+
          '" data-onboard-range="toAyah" data-surah="'+s.number+'" value="'+v.toAyah+'"></label></div></div>';
      }).join(''):'<p class="onboard-hint">ما اخترت سور بعد؛ تقدر تكمل بدون تحديد محفوظ سابق.</p>')+'</div>';
  }
  if(step===2){
    body='<h3>خلينا نرتّب وقتك وهدفك</h3><p>اقتراح مرن بدون التزام إلزامي؛ بتقدر تعدّل الجدول بأي وقت.</p>'+
      '<div class="onboard-section-label">شو هدفك الأساسي؟</div><div class="onboard-stage-grid" role="group" aria-label="هدف الرحلة">'+
      ONBOARDING_GOALS.map(g=>opt(g[0],g[1],null,draft.goal===g[0],'goal')).join('')+'</div>'+
      '<div class="onboard-section-label">قديش وقتك باليوم؟</div><div class="onboard-presets">'+
      [10,20,30,45].map(n=>opt(n,n+' دقيقة',null,draft.dailyMinutes===n,'minutes')).join('')+'</div>'+
      '<label class="account-field">وقت مخصص (10–180 دقيقة)<input class="input" type="number" min="10" max="180" step="5" inputmode="numeric" data-onboard-minutes value="'+draft.dailyMinutes+'"></label>'+
      '<div class="onboard-section-label">شو الأيام المناسبة إلك؟</div><div class="onboard-day-grid" role="group" aria-label="أيام الدراسة">'+
      WEEK_DAYS.map((n,i)=>opt(i,n,null,draft.days.includes(i),'day')).join('')+'</div>';
  }
  if(step===3){
    const ideas=suggestedOnboardingPlan(draft);
    body='<h3>هاي خطتك الأولى المقترحة 🌿</h3>'+
      '<p>قبل الحفظ، راجع اختياراتك. كل الأوراد قابلة للتعديل والحذف، وما رح تُحسب إنجازًا إلا بعد تسجيلك الفعلي.</p>'+
      '<dl class="onboard-summary"><div><dt>مرحلة البداية</dt><dd>'+esc(currentName(draft))+'</dd></div>'+
      '<div><dt>طريقة الدراسة</dt><dd>'+esc(ONBOARDING_GOALS.find(g=>g[0]===draft.goal)[1])+'</dd></div>'+
      '<div><dt>الوقت والأيام</dt><dd>'+draft.dailyMinutes+' دقيقة · '+draft.days.length+' أيام أسبوعيًا</dd></div>'+
      '<div><dt>المحفوظ السابق (غير مؤكّد)</dt><dd>'+draft.knownSurahs.length+' سور</dd></div></dl>'+
      '<h4>أوراد مقترحة لأول أيامك</h4><div class="onboard-proposals">'+
      ideas.map(v=>'<div class="onboard-proposal"><strong>سورة '+esc(surah(v.surah).name)+'</strong>'+
        '<small>'+esc(v.kind==='review'?'مراجعة':'حفظ')+' · الآيات '+v.fromAyah+'–'+v.toAyah+
        ' · '+v.minutes+' دقيقة · '+esc(v.date)+'</small></div>').join('')+'</div>'+
      '<p class="onboard-hint">حفظ الخطة ينشئ أورادًا مخططة فقط، ولا ينشئ سجلات حفظ أو مراجعة أو تسميع.</p>';
  }
  const nav='<div class="onboard-nav">'+(step>0?action('back','السابق','secondary'): '<span></span>')+
    action(step===3?'finish':'next',step===3?'اعتمد خطتي وابدأ':'التالي','primary')+'</div>';
  const current=guestCounts||{memorize:0,reviews:0,planned:0,sessions:0};
  return '<div class="account-setup-actions onboard-wizard"><div class="onboard-progress"><div>'+
    '<small>الخطوة '+(step+1)+' من 4 · '+names[step]+'</small><div class="onboard-progress-bars">'+
    [0,1,2,3].map(i=>'<span class="'+(i<=step?'active':'')+'"></span>').join('')+'</div></div>'+
    '<p>لا نحفظ أي تغيير قبل التأكيد</p></div><section class="onboard-panel">'+body+nav+'</section>'+
    '<details class="account-import-option onboard-import"><summary>عندي تقدم قديم على هالجهاز</summary>'+
    '<p>'+current.memorize+' حفظ، '+current.reviews+' مراجعة، '+current.planned+' أوراد، '+current.sessions+' جلسات تسميع.</p>'+
    '<button type="button" class="secondary" data-account-action="import-guest">أنقل سجلات هالجهاز لحسابي</button>'+
    '<small>الاستيراد اختياري وبموافقتك، ولن نمزج هذه البيانات مع الخطة الجديدة تلقائيًا.</small></details>'+
    '<button type="button" class="account-logout" data-account-action="logout">أكمل كضيف · تسجيل الخروج</button></div>';
}
