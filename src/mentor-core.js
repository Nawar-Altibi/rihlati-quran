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
  // A selected stage or drafted Surah is not proof of memorization.
  // A simpleTrack Surah requires an actual completed revision to be eligible.
  const unconfirmed=new Set(['قيد الحفظ','لم أبدأ','مخطط','planned','لم يبدأ']);
  const recorded=units.filter(u=>!unconfirmed.has(u.status)&&(!u.simpleTrack||activityUnitIds.has(u.id)));
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
    dailyMinutes:Math.max(10,Math.min(120,Number(data.settings?.dailyMinutes)||30)),
    trackedSurahs:recordedSurahs.length,trackedSurahNumbers:recordedSurahs.slice(0,114),
    currentStageSurahs:activeStageSurahs.length,
    unreviewedStageSurahs:unreviewed.slice(0,8),
    reviewsLast7:reviewsLast7.length,due:due.slice(0,12),
    weakSurahs:weakSurahs.slice(0,8),weakAyahs,
    quizAttempts:quizzes.attempts,nextSession,recentTeacherSessions,
    verifiedSurahs:recordedSurahs.slice(0,114).map(n=>({surah:n,name:surahName(n),source:'سجل حفظ أو مراجعة صريح'})),
    note:'هذه المعلومات مبنية فقط على التسجيلات الفعلية، ولا تعني أن كل سورة مسجلة متقنة.'
  };
}

export function generateMentorPlan(snapshot) {
  // The visible daily plan is deterministic and evidence-gated. The AI may
  // explain or rearrange these items, not fabricate unrelated memorized Surahs.
  const tasks=[],ids=new Set(),eligible=new Set(snapshot.verifiedSurahs?.map(x=>x.surah)||snapshot.trackedSurahNumbers||[]);
  const push=(type,surah,title,reason)=>{
    if(surah && !eligible.has(Number(surah)))return;
    const key=type+':'+surah;
    if(ids.has(key))return;
    ids.add(key);tasks.push({type,surah,title,reason});
  };
  for(const x of snapshot.weakAyahs.slice(0,2))
    push('weak',x.surah,'ثبّت سورة '+x.name+' — الآية '+x.ayah,'خطأ مسجّل في اختبار ذاتي ('+x.count+' مرة)');
  for(const x of snapshot.due.slice(0,3))
    push('review',x.surah,'راجع سورة '+x.name,x.rating?'مراجعة مستحقة · آخر تقييم '+x.rating:'مراجعة مستحقة بتاريخ '+x.date);
  if(tasks.length<3)for(const x of snapshot.weakSurahs.slice(0,2))
    push('review',x.surah,'راجع سورة '+x.name,'مراجعة مع تصنيف يحتاج تثبيت');
  if(snapshot.nextSession){
    const names=snapshot.nextSession.surahs.slice(0,3).map(surahName).join('، ');
    tasks.push({type:'session',surah:null,
      title:'استعد لموعد التسميع'+(names?' — '+names:''),
      reason:'الموعد المسجّل: '+snapshot.nextSession.date+'؛ تأكّد من السور مع معلّمك'});
  }
  if(!tasks.length)tasks.push({
    type:'verify',surah:null,title:'حدّد محفوظك الفعلي أولًا',
    reason:'لا توجد مراجعات مستحقة أو آيات ضعيفة موثّقة؛ سجل سورة أو مقطعًا راجعته فعلًا. اختيار المرحلة ليس إثباتًا للحفظ.'
  });
  const selected=tasks.slice(0,4),weights=selected.map((_,i)=>[4,3,2,1][i]);
  const total=weights.reduce((sum,x)=>sum+x,0)||1;
  const daily=Math.max(10,Math.min(120,Number(snapshot.dailyMinutes)||30));
  let remaining=daily;
  return selected.map((task,i)=>{
    const minutes=i===selected.length-1?remaining:Math.min(remaining,Math.max(1,Math.floor(daily*weights[i]/total)));
    remaining-=minutes;
    return {...task,minutes};
  });
}

export function buildMentorEvidence(snapshot){
  const plan=generateMentorPlan(snapshot);
  return {
    date:snapshot.date,dailyMinutes:snapshot.dailyMinutes,
    stageLabelOnly:snapshot.stage.title,
    warning:'اختيار جزء عمّ أو تبارك في الخطة لا يثبت حفظ كل سوره. ممنوع اقتراح مراجعة جزء كامل أو حفظ جديد باعتبارهما مطلوبين دون دليل.',
    verifiedSurahs:(snapshot.verifiedSurahs||[]).map(x=>x.name),
    supportedPlan:plan.map(t=>({type:t.type,surah:t.surah?surahName(t.surah):null,title:t.title,reason:t.reason,minutes:t.minutes})),
    noConfirmedAssignments:plan.every(t=>t.type==='verify')
  };
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
  if(plan.length)return 'اقتراحي لوردك اليوم: '+plan.slice(0,3).map((t,i)=>(i+1)+') '+t.title+' ('+t.minutes+' دقيقة) — '+t.reason).join('؛ ')+'. لا تعتبر أجزاء المرحلة كاملة محفوظة من غير تسجيل صريح.';
  return 'اليوم ما في مراجعات مستحقة موثقة. سجّل السور اللي حافظها أو راجعتها فعلًا، حتى أقدر أعمل لك وردًا أدق. ما رح أفترض إتقان أي جزء من السجلات العامة.';
}

export function mentorModelPayload(snapshot,question){
  // Only a compact, whitelisted aggregate: no notes, activity IDs, chat history,
  // teacher names, raw localStorage, or secrets travel to Cloudflare Workers AI.
  const prompt=String(question||'').trim().slice(0,320);
  return {
    question:prompt,
    context:{
      date:snapshot.date,stage:snapshot.stage.title,dailyMinutes:snapshot.dailyMinutes,
      evidence:buildMentorEvidence(snapshot),
      trackedSurahs:snapshot.trackedSurahs,reviewsLast7:snapshot.reviewsLast7,
      due:snapshot.due.slice(0,6).map(x=>({name:x.name,date:x.date,rating:x.rating})),
      weakSurahs:snapshot.weakSurahs.slice(0,6).map(x=>({name:x.name,rating:x.rating})),
      weakAyahs:snapshot.weakAyahs.slice(0,6).map(x=>({name:x.name,ayah:x.ayah,count:x.count})),
      quizAttempts:snapshot.quizAttempts,
      nextSession:snapshot.nextSession?{date:snapshot.nextSession.date,surahs:snapshot.nextSession.surahs.map(surahName)}:null
    }
  };
}
