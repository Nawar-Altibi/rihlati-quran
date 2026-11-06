import { SURAH_NAMES } from './data.js';
import { addDays, isValidDateKey, todayKey } from './logic.js';

export const PLAN_KINDS = Object.freeze({
  review:'مراجعة وتثبيت',
  memorize:'حفظ جديد',
  recitation:'تحضير للتسميع'
});

const boundedMinutes = n => Number.isInteger(Number(n)) && Number(n)>=5 && Number(n)<=180;
const knownSurah = n => SURAH_NAMES.find(s=>s.number===Number(n));

export function planEntries(data) {
  return Array.isArray(data.studyPlan) ? data.studyPlan : [];
}

export function validatePlanInput(input) {
  const surah=knownSurah(input?.surah);
  if (!isValidDateKey(input?.date)) throw new Error('اختار يوم صحيح للخطة.');
  if (!surah) throw new Error('اختار سورة صحيحة من القائمة.');
  if (!Object.hasOwn(PLAN_KINDS,input?.kind)) throw new Error('اختار نوع ورد صحيح.');
  if (!boundedMinutes(input?.minutes)) throw new Error('مدة الورد لازم تكون بين 5 و180 دقيقة.');
  const start=Number(input?.fromAyah)||1;
  const end=Number(input?.toAyah)||surah.ayahs;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>surah.ayahs)
    throw new Error('نطاق الآيات غير صحيح.');
  return {
    date:input.date,kind:input.kind,surah:surah.number,fromAyah:start,toAyah:end,
    minutes:Number(input.minutes),notes:String(input.notes||'').trim().slice(0,500)
  };
}

export function savePlanEntry(data,input,id=()=>crypto.randomUUID()) {
  const item=validatePlanInput(input);
  const entries=planEntries(data);
  const existing=entries.find(x=>x.id===input.id);
  if(input.id && !existing)throw new Error('ما قدرنا نلاقي الورد المراد تعديله.');
  if(entries.some(x=>x.id!==input.id&&x.date===item.date&&x.surah===item.surah&&x.kind===item.kind&&
    Number(x.fromAyah||1)===item.fromAyah&&Number(x.toAyah||knownSurah(x.surah)?.ayahs)===item.toAyah))
    throw new Error('هذا الورد مسجّل بنفس اليوم. عدّل الورد الموجود بدل ما تكرره.');
  if(existing){
    Object.assign(existing,item,{status:'planned'});
    return existing;
  }
  const created={...item,id:id(),status:'planned',createdAt:todayKey()};
  data.studyPlan ??= [];
  data.studyPlan.push(created);
  return created;
}

export function movePlanEntry(data,id,date) {
  if(!isValidDateKey(date))throw new Error('التاريخ الجديد غير صالح.');
  const entry=planEntries(data).find(x=>x.id===id);
  if(!entry)throw new Error('الورد مو موجود.');
  if(entry.status==='archived')throw new Error('هذا الورد مؤرشف.');
  return savePlanEntry(data,{...entry,date,id});
}

export function removePlanEntry(data,id) {
  const entries=planEntries(data),index=entries.findIndex(x=>x.id===id);
  if(index<0)throw new Error('الورد مو موجود.');
  entries.splice(index,1);
  return true;
}

export function startSuggestedPlan(data,start=addDays(todayKey(),1),id=()=>crypto.randomUUID()) {
  if(planEntries(data).length)throw new Error('عندك خطة موجودة؛ عدّلها بدل استبدالها تلقائيًا.');
  if(!isValidDateKey(start))throw new Error('تاريخ البداية غير صالح.');
  // This template records intentions, never past memorization or a completed task.
  const template=[
    {date:start,surah:78,kind:'review',minutes:12,notes:'ابدأ بسماع نفسك قبل فتح المصحف.'},
    {date:start,surah:79,kind:'review',minutes:12,notes:'ركّز على الآيات التي نسيتها.'},
    {date:start,surah:80,kind:'review',minutes:12,notes:'مراجعة تمهيدية، بلا افتراض إتقان.'},
    {date:addDays(start,1),surah:81,kind:'review',minutes:20,notes:'سورة التكوير؛ عدّل الموعد إذا احتجت وقتًا للتثبيت.'}
  ];
  return template.map(item=>savePlanEntry(data,item,id));
}

export function completedEvidence(data,item) {
  const units=new Map((data.units||[]).map(u=>[u.id,u]));
  const matchesUnit=a=>Number(units.get(a.unitId)?.surah)===item.surah;
  if(item.kind==='review')return (data.activities||[]).some(a=>a.completed&&a.type==='revision'&&a.date===item.date&&matchesUnit(a));
  if(item.kind==='memorize')return (data.activities||[]).some(a=>a.completed&&a.type==='memorization'&&a.date===item.date&&matchesUnit(a));
  return (data.sessions||[]).some(s=>s.date===item.date&&(s.surahs||[s.surah]).map(Number).includes(item.surah));
}

export function planItemState(data,item,date=todayKey()) {
  if(completedEvidence(data,item))return 'done';
  if(item.date<date)return 'missed';
  if(item.date===date)return 'today';
  return 'upcoming';
}

export function listPlan(data,{start=todayKey(),days=14,includeMissed=true}={}) {
  const end=addDays(start,Math.max(1,days)-1);
  return planEntries(data).filter(x=>x.date>=start&&x.date<=end||
    includeMissed&&x.date<start&&!completedEvidence(data,x))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind)||a.surah-b.surah);
}

export function dailyPlanStats(data,date=todayKey()) {
  const items=planEntries(data).filter(x=>x.date===date);
  return {
    total:items.length,
    done:items.filter(x=>completedEvidence(data,x)).length,
    minutes:items.reduce((sum,x)=>sum+(Number(x.minutes)||0),0),
    missed:planEntries(data).filter(x=>x.date<date&&!completedEvidence(data,x)).length
  };
}

export const surahLabel=n=>knownSurah(n)?.name||'سورة غير محددة';
