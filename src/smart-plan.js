import {SURAH_NAMES} from './data.js';
import {addDays,isValidDateKey,todayKey} from './logic.js';
import {planEntries,planItemState,movePlanEntry,savePlanEntry} from './flexible-plan.js';

// Rule-based guidance based only on real due dates, assessments, existing planned
// work and the owner's preferred schedule. Generating suggestions NEVER writes.
const weakRatings=new Map([['ضعيف',0],['يحتاج مراجعة',1],['أخطاء بسيطة',2],['متقن',3]]);
const validDay=d=>Number.isInteger(d)&&d>=0&&d<=6;
const safeDays=(value,fallback)=>Array.isArray(value)&&value.some(validDay)?
  [...new Set(value.filter(validDay))]:fallback;
const safeMinutes=n=>Number.isInteger(n)&&n>=10&&n<=180?n:30;
const hasSurah=n=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=114;
const score=u=>weakRatings.get(u?.lastRating)??4;
const itemTime=i=>Number.isFinite(Number(i.minutes))&&Number(i.minutes)>0?Number(i.minutes):15;

export function smartPlanSuggestions(data,{today=todayKey(),horizonDays=14,limit=5}={}){
  if(!isValidDateKey(today))throw Error('تاريخ الخطة غير صالح.');
  if(!Number.isInteger(horizonDays)||horizonDays<1||horizonDays>28)throw Error('مدة الاقتراحات غير صالحة.');
  if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('عدد الاقتراحات غير صالح.');
  const settings=data?.settings||{},items=planEntries(data),budget=safeMinutes(settings.dailyMinutes);
  const units=new Map((data?.units||[]).filter(u=>u?.id).map(u=>[u.id,u]));
  const unitFor=surah=>(data?.units||[]).filter(u=>Number(u.surah)===Number(surah))
    .sort((a,b)=>score(a)-score(b))[0];
  const revisionDays=safeDays(settings.revisionDays,[0,1,2,3,4,5,6]);
  const memoDays=safeDays(settings.memorizationDays,[0,1,2,3,4,5,6]);
  const recitationDays=validDay(settings.recitationDay)?[settings.recitationDay]:revisionDays;
  const daysFor=kind=>kind==='memorize'?memoDays:kind==='recitation'?recitationDays:revisionDays;
  // Reserve capacity already committed to existing scheduled items and to
  // earlier proposals; never silently overload a day.
  const load=new Map();
  for(const item of items){
    if(isValidDateKey(item.date)&&item.date>=today&&planItemState(data,item,today)!=='done')
      load.set(item.date,(load.get(item.date)||0)+itemTime(item));
  }
  function findSlot(kind,minutes){
    for(let i=0;i<horizonDays;i++){
      const date=addDays(today,i);
      if(!daysFor(kind).includes(new Date(date+'T12:00:00').getDay()))continue;
      const used=load.get(date)||0;
      // An existing long item may occupy one day by itself even if its
      // original estimate exceeds the user's newly selected daily target.
      if(used+minutes<=Math.max(budget,minutes)){
        load.set(date,used+minutes);
        return date;
      }
    }
    return null;
  }
  const suggestions=[];
  const overdue=items.filter(item=>item?.id&&isValidDateKey(item.date)&&item.date<today&&
    hasSurah(item.surah)&&['review','memorize','recitation'].includes(item.kind)&&
    planItemState(data,item,today)==='missed')
    .sort((a,b)=>score(unitFor(a.surah))-score(unitFor(b.surah))||
      a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  for(const item of overdue){
    if(suggestions.length>=limit)break;
    const date=findSlot(item.kind,itemTime(item));
    if(!date)continue;
    const last=unitFor(item.surah)?.lastRating;
    const rated=weakRatings.has(last)&&score(unitFor(item.surah))<=2?
      'آخر تقييم مسجّل: '+last+'؛ ':'';
    suggestions.push({
      id:'carry:'+item.id,action:'carry',sourceId:item.id,
      expectedDate:item.date,date,kind:item.kind,surah:Number(item.surah),
      minutes:itemTime(item),
      reason:rated+'الورد فات موعده ولم يُسجل إنجازه. نقترح ترحيله ليوم مناسب دون تغيير الحفظ.'
    });
  }
  // Only genuine revisions with a real unit/due date qualify. A self-reported
  // "previously memorized" surah is NOT sufficient evidence for this action.
  const due=(data?.revisions||[]).filter(r=>r?.id&&!r.done&&isValidDateKey(r.dueDate)&&
    r.dueDate<=today&&units.has(r.unitId)&&hasSurah(units.get(r.unitId).surah))
    .sort((a,b)=>score(units.get(a.unitId))-score(units.get(b.unitId))||
      a.dueDate.localeCompare(b.dueDate)||String(a.id).localeCompare(String(b.id)));
  const alreadyPlanned=new Set(items.filter(i=>i.kind==='review'&&hasSurah(i.surah)&&
    planItemState(data,i,today)!=='done').map(i=>Number(i.surah)));
  for(const item of due){
    if(suggestions.length>=limit)break;
    const unit=units.get(item.unitId),surah=Number(unit.surah),meta=SURAH_NAMES[surah-1];
    if(alreadyPlanned.has(surah))continue;
    const date=findSlot('review',Math.min(15,budget));
    if(!date)continue;
    alreadyPlanned.add(surah);
    const hasRange=unit.method==='ayah'&&Number.isInteger(Number(unit.startAyah))&&
      Number.isInteger(Number(unit.endAyah))&&Number(unit.startAyah)>=1&&
      Number(unit.endAyah)<=meta.ayahs&&Number(unit.endAyah)>=Number(unit.startAyah);
    suggestions.push({
      id:'due:'+item.id,action:'due',sourceId:item.id,unitId:item.unitId,
      expectedDate:item.dueDate,date,kind:'review',surah,minutes:Math.min(15,budget),
      fromAyah:hasRange?Number(unit.startAyah):1,
      toAyah:hasRange?Number(unit.endAyah):meta.ayahs,
      reason:(weakRatings.has(unit.lastRating)?'آخر تقييم مسجّل: '+unit.lastRating+'؛ ':'')+
        'عندك موعد مراجعة مستحق بسجلك ولم نلقَ ورد مراجعة مخططًا لهذه السورة.'
    });
  }
  return suggestions;
}

export function applySmartSuggestion(data,proposal,{today=todayKey(),id=()=>crypto.randomUUID()}={}){
  if(!proposal||typeof proposal.id!=='string')throw Error('الاقتراح غير صالح.');
  // Recompute from the current snapshot. Any stale suggestion (including a
  // changed target date) is rejected rather than overwriting a newer plan.
  const current=smartPlanSuggestions(data,{today}).find(s=>s.id===proposal.id);
  if(!current||current.expectedDate!==proposal.expectedDate||current.date!==proposal.date||
    current.action!==proposal.action||current.sourceId!==proposal.sourceId)
    throw Error('تغيّرت الخطة منذ عرض الاقتراح. حدّث الاقتراحات وحاول من جديد.');
  if(current.action==='carry'){
    const item=planEntries(data).find(i=>i.id===current.sourceId);
    if(!item||item.date!==current.expectedDate||planItemState(data,item,today)!=='missed')
      throw Error('الورد تغير أو صار منجزًا؛ لا يمكن ترحيله.');
    movePlanEntry(data,item.id,current.date);
  }else if(current.action==='due'){
    const rev=(data.revisions||[]).find(r=>r.id===current.sourceId);
    if(!rev||rev.done||rev.dueDate!==current.expectedDate)
      throw Error('موعد المراجعة تغيّر أو تم إنجازه بالفعل.');
    savePlanEntry(data,{date:current.date,kind:'review',surah:current.surah,
      minutes:current.minutes,fromAyah:current.fromAyah,toAyah:current.toAyah,
      notes:'مراجعة مقترحة من موعد حقيقي مستحق؛ لا تُحسب منجزة حتى تسجلها.'},id);
  }else throw Error('نوع الاقتراح غير معروف.');
  return current;
}
