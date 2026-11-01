// Smart *self-assessed* recitation quizzes. Never expand historical Juz-only
// records into fictitious Surah mastery; choose from explicitly recorded
// Surah/Ayah memorization or completed voluntary Surah reviews only.
import { SURAH_NAMES } from './data.js';
import { todayKey } from './logic.js';
import { getMushafPageSegments, mushafPageFor } from './mushaf-core.js';

const validSurah=n=>Number.isInteger(Number(n)) && Number(n)>=1 && Number(n)<=114;
const clampRandom=r=>Math.max(0,Math.min(0.999999999,Number.isFinite(r)?r:0));
const randomIndex=(count,rng)=>Math.floor(clampRandom(rng())*count);
const rangeContains=(span,ayah)=>span.startAyah<=ayah&&ayah<=span.endAyah;
export const QUIZ_LENGTH=6;

export function trackedQuizSurahs(data) {
  const reviewedUnits=new Set((data.activities||[]).filter(a=>a.type==='revision'&&a.completed).map(a=>a.unitId));
  const result=[];
  for(const u of data.units||[]) {
    const surah=Number(u.surah);
    if(!validSurah(surah) || !['surah','ayah'].includes(u.method)) continue;
    if(['لم أبدأ','قيد الحفظ','planned','مخطط'].includes(u.status))continue;
    // simpleTrack Surah placeholders only count if a user explicitly logged a review.
    if(u.simpleTrack&&!reviewedUnits.has(u.id))continue;
    const end=Number(u.endAyah||SURAH_NAMES[surah-1].ayahs);
    const start=Number(u.startAyah||1);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>SURAH_NAMES[surah-1].ayahs)continue;
    result.push({surah,startAyah:start,endAyah:end,unitId:u.id,
      weak:['ضعيف','يحتاج مراجعة'].includes(u.lastRating||''),
      status:u.status});
  }
  return result;
}

export function getQuizMistakeCounts(data) {
  const counts=new Map();
  for(const attempt of data.quizAttempts||[]) {
    if(!validSurah(attempt.surah)) continue;
    const surah=Number(attempt.surah),start=Number(attempt.startAyah),end=Number(attempt.endAyah);
    for(const v of attempt.mistakeAyahs||[]) {
      const ayah=Number(v);
      if(!Number.isInteger(ayah)||ayah<start||ayah>end)continue;
      const key=surah+':'+ayah;
      counts.set(key,(counts.get(key)||0)+1);
    }
  }
  return counts;
}

export function buildQuizSpans(data, date=todayKey()) {
  // Merge coverage per page, Surah, and Ayah so partially overlapping
  // saved materials do not bias the same verse twice.
  const coverage=new Map(),unitsById=new Map((data.units||[]).map(u=>[u.id,u]));
  const dueIds=new Set((data.revisions||[]).filter(r=>!r.done&&r.dueDate<=date).map(r=>r.unitId));
  const mistakeCounts=getQuizMistakeCounts(data);
  for(const u of trackedQuizSurahs(data)) {
    for(let ayah=u.startAyah;ayah<=u.endAyah;ayah++) {
      const page=mushafPageFor(u.surah,ayah),key=u.surah+':'+page;
      if(!coverage.has(key))coverage.set(key,{surah:u.surah,page,verses:new Map()});
      const record=coverage.get(key);
      if(!record.verses.has(ayah))record.verses.set(ayah,{weak:false,due:false,mistakes:0});
      const v=record.verses.get(ayah);
      v.weak ||= u.weak || ['ضعيف','يحتاج تثبيت'].includes(unitsById.get(u.unitId)?.status);
      v.due ||= dueIds.has(u.unitId);
      v.mistakes=mistakeCounts.get(u.surah+':'+ayah)||0;
    }
  }
  const spans=[];
  for(const entry of coverage.values()) {
    const verseNumbers=[...entry.verses.keys()].sort((a,b)=>a-b);
    let contiguous=[];
    const finish=()=>{
      if(!contiguous.length)return;
      const first=contiguous[0],last=contiguous.at(-1);
      const v=contiguous.map(n=>entry.verses.get(n));
      spans.push({
        surah:entry.surah,page:entry.page,startAyah:first,endAyah:last,
        due:v.some(x=>x.due),weak:v.some(x=>x.weak)||v.some(x=>x.mistakes>0),
        mistakeAyahs:contiguous.filter(n=>entry.verses.get(n).mistakes>0),
        weight:1+(v.some(x=>x.due)?3:0)+(v.some(x=>x.weak)?2:0)+Math.min(7,v.reduce((sum,x)=>sum+x.mistakes,0))
      });
      contiguous=[];
    };
    for(const n of verseNumbers){
      if(contiguous.length&&n!==contiguous.at(-1)+1)finish();
      contiguous.push(n);
    }
    finish();
  }
  return spans.sort((a,b)=>a.surah-b.surah||a.startAyah-b.startAyah);
}

export function chooseQuizPassage(data,{mode='random',date=todayKey(),rng=Math.random,length=QUIZ_LENGTH}={}) {
  if(!['random','weak','due'].includes(mode))throw new Error('نوع الاختبار غير معروف.');
  const all=buildQuizSpans(data,date);
  const candidates=mode==='weak'?all.filter(x=>x.weak):mode==='due'?all.filter(x=>x.due):all;
  if(!candidates.length)return null;
  const weights=candidates.map(c=>mode==='random'?c.weight:1+(mode==='weak'?c.mistakeAyahs.length:0));
  const total=weights.reduce((a,b)=>a+b,0),pick=clampRandom(rng())*total;
  let sum=0,span=candidates.at(-1);
  for(let i=0;i<candidates.length;i++){sum+=weights[i];if(pick<sum){span=candidates[i];break;}}
  const n=Math.min(Math.max(1,Math.floor(length)),span.endAyah-span.startAyah+1);
  const maxStart=span.endAyah-n+1;
  let start=span.startAyah+randomIndex(maxStart-span.startAyah+1,rng);
  if(mode==='weak'&&span.mistakeAyahs.length){
    const error=span.mistakeAyahs[randomIndex(span.mistakeAyahs.length,rng)];
    start=Math.min(maxStart,Math.max(span.startAyah,error-Math.floor((n-1)/2)));
  }
  const end=start+n-1;
  return {surah:span.surah,startAyah:start,endAyah:end,page:span.page,mode,
    hasDue:span.due,hasWeak:span.weak, length:n};
}

export function recordQuizAttempt(data,passage,mistakeAyahs=[],id=()=>crypto.randomUUID(),date=todayKey()) {
  const surah=Number(passage.surah),from=Number(passage.startAyah),to=Number(passage.endAyah);
  if(!validSurah(surah)||!Number.isInteger(from)||!Number.isInteger(to)||
    from<1||to<from||to>SURAH_NAMES[surah-1].ayahs||
    mushafPageFor(surah,from)!==mushafPageFor(surah,to))throw new Error('نطاق الاختبار غير صالح.');
  const errors=[...new Set(mistakeAyahs.map(Number))].sort((a,b)=>a-b);
  if(errors.some(v=>!Number.isInteger(v)||v<from||v>to))throw new Error('الآيات المحددة لا تنتمي للاختبار.');
  data.quizAttempts??=[];
  const result={id:id(),date,createdAt:new Date().toISOString(),surah,startAyah:from,endAyah:to,
    page:mushafPageFor(surah,from),mode:passage.mode||'random',mistakeAyahs:errors,
    kind:'self-assessed',verifiedByTeacher:false};
  data.quizAttempts.push(result);
  return result;
}

export function quizSummary(data){
  const attempts=data.quizAttempts||[],mistakes=getQuizMistakeCounts(data);
  const weakLocations=[...mistakes].map(([key,count])=>{
    const [surah,ayah]=key.split(':').map(Number);
    return {surah,ayah,count};
  }).sort((a,b)=>b.count-a.count||a.surah-b.surah||a.ayah-b.ayah);
  return {attempts:attempts.length, mistakeLocations:mistakes.size,
    weakLocations:weakLocations.slice(0,8),last:attempts.at(-1)||null};
}
