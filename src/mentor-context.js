// Privacy-scoped read-only adapter for the full on-device Quran journey.
// It reads *all* local records to compute totals/insights, then packs recent
// items in a bounded prompt; no entire localStorage, secrets, or identifiers.
import { SURAH_NAMES } from './data.js';
import { todayKey, addDays } from './logic.js';

const name=n=>SURAH_NAMES.find(x=>x.number===Number(n))?.name||'';
const day=x=>String(x||'').slice(0,10);
const clip=(x,max=130)=>String(x??'').slice(0,max);
const allowedRating=x=>clip(x,45);
const reference=(raw,units)=>{const u=units.get(raw.unitId);return name(raw.surah||u?.surah);};
const last=(items,key)=>[...(Array.isArray(items)?items:[])].sort((a,b)=>day(b?.[key]||b?.date).localeCompare(day(a?.[key]||a?.date)));
const note=(obj,includeNotes)=>includeNotes?{note:clip(obj?.note||obj?.notes||obj?.feedback||'',180)}:{};
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const safeSurahs=arr=>(Array.isArray(arr)?arr:[]).map(Number).filter(x=>Number.isInteger(x)&&x>=1&&x<=114).map(name);
const getSafeSettings=s=>({stage:clip(s?.simpleStage,45),dailyMinutes:n(s?.dailyMinutes),targetPages:n(s?.targetPages),reviewIntervals:Array.isArray(s?.reviewIntervals)?s.reviewIntervals.slice(0,8).map(n):[]});
const types=['units','activities','revisions','sessions','scheduledSessions','quizAttempts','tasks','weeklyGoals','attempts'];
const LIST_CAPS={units:100,activities:95,revisions:95,sessions:30,scheduledSessions:30,quizAttempts:70,tasks:50,weeklyGoals:20,attempts:30};
export const MAX_MENTOR_STUDY_CHARS=17000;

export function buildDetailedMentorContext(data,{includeNotes=false,maxChars=MAX_MENTOR_STUDY_CHARS,date=todayKey()}={}){
  const userUnits=new Map((data.units||[]).map(u=>[u.id,u]));
  const categories={
    units: last(data.units,'memorizedAt').map(u=>({surah:name(u.surah),juz:n(u.juz)||null,method:clip(u.method,15),startAyah:n(u.startAyah)||null,endAyah:n(u.endAyah)||null,pages:n(u.pages),date:day(u.memorizedAt),status:clip(u.status,55),rating:allowedRating(u.lastRating),lastReviewed:day(u.lastReviewed),isGeneralPlaceholder:!u.surah||Boolean(u.legacy||u.simpleTrack),...note(u,includeNotes)})),
    activities:last(data.activities,'date').map(a=>({date:day(a.date),type:clip(a.type,30),surah:reference(a,userUnits),rating:allowedRating(a.rating),completed:Boolean(a.completed),pages:n(a.pages),...note(a,includeNotes)})),
    revisions:last(data.revisions,'dueDate').map(r=>({dueDate:day(r.dueDate),surah:reference(r,userUnits),done:Boolean(r.done),rating:allowedRating(r.rating),...note(r,includeNotes)})),
    sessions:last(data.sessions,'date').map(s=>({date:day(s.date),surahs:safeSurahs(s.surahs||[s.surah]),result:clip(s.result,65),type:clip(s.type,30),performance:clip(typeof s.performance==='string'?s.performance:'',65),mistakes:typeof s.mistakes==='object'?JSON.stringify(s.mistakes).slice(0,130):'',...note(s,includeNotes)})),
    scheduledSessions:last(data.scheduledSessions,'date').map(s=>({date:day(s.date),surahs:safeSurahs(s.surahs||[s.surah]),status:clip(s.status,45),...note(s,includeNotes)})),
    quizAttempts:last(data.quizAttempts,'date').map(q=>({date:day(q.date),surah:name(q.surah),startAyah:n(q.startAyah),endAyah:n(q.endAyah),mistakeAyahs:(Array.isArray(q.mistakeAyahs)?q.mistakeAyahs:[]).slice(0,30).map(n),mode:clip(q.mode,20)})),
    tasks:last(data.tasks,'date').map(t=>({date:day(t.date),type:clip(t.type,30),surah:reference(t,userUnits),done:Boolean(t.done),title:clip(t.title,80)})),
    weeklyGoals:last(data.weeklyGoals,'date').map(g=>({date:day(g.date||g.weekStart),title:clip(g.title,90),done:Boolean(g.done),surah:name(g.surah),target:n(g.target)})),
    attempts:last(data.attempts,'date').map(a=>({date:day(a.date),surah:reference(a,userUnits),rating:allowedRating(a.rating),result:clip(a.result,55)}))
  };
  const totalCounts=Object.fromEntries(types.map(t=>[t,categories[t].length]));
  const reviewCounts=Object.fromEntries(['متقن','أخطاء بسيطة','يحتاج مراجعة','ضعيف'].map(k=>[k,(data.activities||[]).filter(a=>a.type==='revision'&&a.rating===k).length]));
  const since=addDays(date,-29);
  const activityDates=new Set((data.activities||[]).filter(a=>a.completed&&day(a.date)>=since&&day(a.date)<=date).map(a=>day(a.date)));
  const allMistakes=new Map();
  for(const q of data.quizAttempts||[]) for(const a of q.mistakeAyahs||[]){
    const s=name(q.surah);if(!s||!Number.isInteger(Number(a)))continue;
    const key=s+':'+a;allMistakes.set(key,(allMistakes.get(key)||0)+1);
  }
  const topMistakes=[...allMistakes.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,count])=>({place:k,count}));
  const context={
    asOf:date,coverageNote:'إحصاءات كل السجلات، والتفاصيل مقيدة بالحجم والحداثة. بيانات الأجزاء العامة ليست إثباتًا بإتقان كل سورها.',
    settings:getSafeSettings(data.settings),totalCounts,reviewRatings:reviewCounts,
    activeDays30:activityDates.size,topMistakes,
    details:{},omitted:{}
  };
  let remaining=Math.max(2000,Math.min(19000,Math.floor(maxChars)));
  for(const type of types){
    let included=0,entries=categories[type].slice(0,LIST_CAPS[type]);
    context.details[type]=[];
    for(const entry of entries){
      context.details[type].push(entry);
      if(JSON.stringify(context).length>remaining){context.details[type].pop();break;}
      included++;
    }
    context.omitted[type]=Math.max(0,totalCounts[type]-included);
  }
  // User can inspect the exact JSON their browser would share before enabling.
  context.shareNotes=Boolean(includeNotes);
  return context;
}

export function mentorChatHistory(messages,limit=8){
  return (Array.isArray(messages)?messages:[])
    .filter(m=>['user','assistant'].includes(m?.role)&&typeof m?.text==='string'&&m.text.trim())
    .slice(-Math.min(Math.max(limit,1),10))
    .map(m=>({role:m.role,content:m.text.slice(0,1100)}));
}
