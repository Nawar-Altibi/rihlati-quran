// Read-only personal mentor: summaries are computed from facts the user logged,
// never from seed Juz placeholders or guessed mastery.
import { SIMPLE_STAGES, getCurrentStage, surahName } from './simple-flow.js';
import { SURAH_NAMES } from './data.js';
import { todayKey, addDays, dayDiff } from './logic.js';
import { quizSummary } from './quiz-core.js';

const validSurah=n=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=114;
const unique=values=>[...new Set(values)];
const weight=r=>r==='ضعيف'?4:r==='يحتاج مراجعة'?3:r==='أخطاء بسيطة'?1:0;
export const MENTOR_MODES=['today','weak','recitation','progress'];
export const MENTOR_SUGGESTIONS=[
  'شو لازم راجع اليوم؟','وين عم تتكرر أخطائي؟','حضّرلي للتسميع','كيف عم يتقدم حفظي؟'
];

export function buildMentorSnapshot(data,date=todayKey()){
  const stage=getCurrentStage(data);
  const units=(data.units||[]).filter(u=>validSurah(u.surah) && ['surah','ayah'].includes(u.method));
  const activityUnitIds=new Set((data.activities||[]).filter(a=>a.type==='revision'&&a.completed).map(a=>a.unitId));
  const recorded=units.filter(u=>!u.simpleTrack||activityUnitIds.has(u.id));
  const recordedSurahs=unique(recorded.map(u=>Number(u.surah)));
  const reviewHistory=(data.activities||[]).filter(a=>a.type==='revision'&&a.completed);
  const reviewsLast7=reviewHistory.filter(a=>a.date>=addDays(date,-6)&&a.date<=date);
  const scheduled=(data.scheduledSessions||[]).filter(s=>s.date>=date).sort((a,b)=>a.date.localeCompare(b.date));
  const pending=(data.revisions||[]).filter(r=>!r.done&&r.dueDate<=date);
  const due=[];
  for(const r of pending) {
    const unit=(data.units||[]).find(u=>u.id===r.unitId);
    if(!unit||!validSurah(unit.surah))continue;
    const n=Number(unit.surah);
    if(!recordedSurahs.includes(n))continue;
    if(!due.some(d=>d.surah===n))due.push({surah:n,name:surahName(n),date:r.dueDate,rating:unit.lastRating||null});
  }
  due.sort((a,b)=>weight(b.rating)-weight(a.rating)||a.date.localeCompare(b.date));
  const weakSurahs=unique(recorded.filter(u=>weight(u.lastRating)>=3||u.status==='يحتاج تثبيت').map(u=>Number(u.surah)))
    .map(n=>({surah:n,name:surahName(n),rating:recorded.find(u=>Number(u.surah)===n)?.lastRating||null}));
  const quizzes=quizSummary(data);
  const weakAyahs=quizzes.weakLocations.slice(0,6).map(x=>({...x,name:surahName(x.surah)}));
  const recentTeacherSessions=(data.sessions||[]).filter(s=>s.date&&s.date<=date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)
    .map(s=>({date:s.date,surahs:unique((s.surahs||[s.surah]).map(Number).filter(validSurah)),result:s.result||null}));
  const nextSession=scheduled[0]?{date:scheduled[0].date,surahs:unique((scheduled[0].surahs||[scheduled[0].surah]).map(Number).filter(validSurah))}:null;
  const activeStageSurahs=stage.surahs;
  const unreviewed=activeStageSurahs.filter(s=>!reviewHistory.some(a=>recorded.some(u=>u.id===a.unitId && Number(u.surah)===s)));
  return {
    date,stage:{id:stage.id,title:stage.title,newMemorization:stage.newMemorization},
    trackedSurahs:recordedSurahs.length,trackedSurahNumbers:recordedSurahs.slice(0,114),
    currentStageSurahs:activeStageSurahs.length,
    unreviewedStageSurahs:unreviewed.slice(0,8),
    reviewsLast7:reviewsLast7.length,due:due.slice(0,12),
    weakSurahs:weakSurahs.slice(0,8),weakAyahs,
    quizAttempts:quizzes.attempts,nextSession,recentTeacherSessions,
    note:'هذه المعلومات مبنية فقط على التسجيلات الفعلية، ولا تعني أن كل سورة مسجلة متقنة.'
  };
}

export function generateMentorPlan(snapshot) {
  const tasks=[],ids=new Set();
  const push=(type,surah,title,reason)=>{
    const key=type+':'+surah;
    if(ids.has(key))return;
    ids.add(key);tasks.push({type,surah,title,reason});
  };
  const weakPriority=snapshot.weakAyahs.slice(0,2);
  for(const x of weakPriority)push('weak',x.surah,'ثبّت سورة '+x.name+' — الآية '+x.ayah,'سجّلت خطأً في هذا الموضع '+x.count+' مرة');
  for(const x of snapshot.due.slice(0,3))push('review',x.surah,'راجع سورة '+x.name,x.rating?'مستحقة ومصنفة: '+x.rating:'مراجعتها مستحقة الآن');
  if(tasks.length<3){
    for(const x of snapshot.weakSurahs.slice(0,2))push('review',x.surah,'راجع سورة '+x.name,'تقييم سابق بحاجة تثبيت');
  }
  if(tasks.length<3 && snapshot.unreviewedStageSurahs.length) {
    const n=snapshot.unreviewedStageSurahs[0];
    push('suggest',n,'ابدأ بتثبيت سورة '+surahName(n),'اقتراح من المرحلة الحالية، وليس إثباتًا أنها محفوظة');
  }
  if(snapshot.nextSession){
    const names=snapshot.nextSession.surahs.slice(0,3).map(surahName).join('، ');
    tasks.push({type:'session',surah:snapshot.nextSession.surahs[0]||null,
      title:'استعد للتسميع'+(names?' — '+names:''),reason:'الموعد المسجل: '+snapshot.nextSession.date});
  }
  return tasks.slice(0,5);
}

export function answerMentorLocally(snapshot,question){
  const q=String(question||'').trim();
  const plan=generateMentorPlan(snapshot);
  if(/خطا|اخطا|غلط|ضعف|ضعيف|تثبيت|اغلاط|أخطا/.test(q)){
    if(snapshot.weakAyahs.length) return 'أكثر المواضع اللي علّمتها كأخطاء: '+snapshot.weakAyahs.slice(0,4).map(x=>'سورة '+x.name+'، الآية '+x.ayah+' ('+x.count+' مرّة)').join('؛ ')+'. افتح وضع «مواضع تحتاج تثبيت» لتختبرها من جديد. هاي أخطاء سجلتها بنفسك، مو تحليل صوت آلي.';
    if(snapshot.weakSurahs.length)return 'عندك سور تحتاج تثبيت بحسب تقييمك: '+snapshot.weakSurahs.slice(0,4).map(x=>x.name).join('، ')+'. جرّب اختبارها، وحدد الآيات التي تخطئ فيها.';
    return 'لسه ما في مواضع أخطاء موثّقة في اختباراتك. جرّب «اختبر حفظي» وسجّل أخطاء الآيات بعد الكشف.';
  }
  if(/تسميع|شيخ|معلم|معلّم|جلسة|موعد/.test(q)){
    if(snapshot.nextSession)return 'موعد التسميع القادم مسجّل بتاريخ '+snapshot.nextSession.date+'. السور: '+snapshot.nextSession.surahs.map(surahName).join('، ')+'. راجعها على دفعتين، وركّز على الآيات اللي سبق وعلّمتها أخطاء. هذا تحضير مقترح، مش تقييم للتجويد.';
    return 'ما في موعد تسميع قادم مسجّل عندك. حدد جلسة من صفحة «التسميع»، وبعدين بساعدك ترتّب المراجعات قبلها.';
  }
  if(/تقدم|قديش|انجاز|إحصاء|احصاء|مستوى/.test(q))
    return 'حسب سجلك: '+snapshot.trackedSurahs+' سور لها حفظ أو مراجعات صريحة، '+snapshot.reviewsLast7+' مراجعات خلال آخر ٧ أيام، و'+snapshot.quizAttempts+' اختبارات ذاتية محفوظة. المرحلة الحالية: '+snapshot.stage.title+'. هالأرقام ما بتعني إتقانًا تلقائيًا.';
  if(/احفظ|حفظ جديد|مرحلة|بكرا|غدا|غداً/.test(q)){
    const suggested=snapshot.unreviewedStageSurahs[0];
    return 'مرحلتك الحالية: '+snapshot.stage.title+'. '+(snapshot.due.length?'عندك '+snapshot.due.length+' مراجعات مستحقة؛ أعطي التثبيت أولوية قبل حفظ جديد. ':'')+
      (snapshot.stage.newMemorization?'إذا أنهيت مراجعاتك، سجّل مقطع الحفظ الجديد فقط بعد ما تحفظه فعلًا. ':'هالمرحلة مخصصة لتثبيت المحفوظ السابق، مو لإضافة حفظ جديد إجباري. ')+
      (suggested?'سورة مقترحة للبدء: '+surahName(suggested)+'.':'');
  }
  if(plan.length)return 'اقتراحي لوردك اليوم: '+plan.slice(0,3).map((t,i)=>(i+1)+') '+t.title+' — '+t.reason).join('؛ ')+'. سجّل فقط اللي أنجزته فعلًا.';
  return 'اليوم ما في مراجعات مستحقة موثقة. سجّل السور اللي حافظها أو راجعتها فعلًا، حتى أقدر أعمل لك وردًا أدق. ما رح أفترض إتقان أي جزء من السجلات العامة.';
}

export function mentorModelPayload(snapshot,question){
  // Only a compact, whitelisted aggregate: no notes, activity IDs, chat history,
  // teacher names, raw localStorage, or secrets travel to Cloudflare Workers AI.
  const prompt=String(question||'').trim().slice(0,320);
  return {
    question:prompt,
    context:{
      date:snapshot.date,stage:snapshot.stage.title,
      trackedSurahs:snapshot.trackedSurahs,reviewsLast7:snapshot.reviewsLast7,
      due:snapshot.due.slice(0,6).map(x=>({name:x.name,date:x.date,rating:x.rating})),
      weakSurahs:snapshot.weakSurahs.slice(0,6).map(x=>({name:x.name,rating:x.rating})),
      weakAyahs:snapshot.weakAyahs.slice(0,6).map(x=>({name:x.name,ayah:x.ayah,count:x.count})),
      quizAttempts:snapshot.quizAttempts,
      nextSession:snapshot.nextSession?{date:snapshot.nextSession.date,surahs:snapshot.nextSession.surahs.map(surahName)}:null
    }
  };
}
