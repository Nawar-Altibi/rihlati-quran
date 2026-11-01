import { SURAH_NAMES } from './data.js';
import { todayKey, addDays, isValidDateKey, validateUnit } from './logic.js';
import { describeAyahRange } from './quran-metadata.js';

/**
 * Record newly memorized material after the user confirms it is already memorized.
 * Automatic metadata is derived from the verified Hafs 604-page Mushaf dataset.
 */
export function recordSimpleMemorization(data, { surah, fromAyah = 1, toAyah, date = todayKey(), note = '' }, id = () => crypto.randomUUID()) {
  if (!isValidDateKey(date) || date > todayKey()) throw new Error('اختر تاريخًا صالحًا غير مستقبلي');
  const selection = describeAyahRange(surah,fromAyah,toAyah);
  const entire = selection.fromAyah===1 && selection.toAyah===SURAH_NAMES[selection.surah-1].ayahs;
  const unit = {
    id:id(), method:entire?'surah':'ayah', surah:selection.surah,
    title:'سورة '+selection.name+(entire?' كاملة':' · الآيات '+selection.fromAyah+'–'+selection.toAyah),
    status:'محفوظ حديثًا', memorizedAt:date,
    startAyah:selection.fromAyah, endAyah:selection.toAyah,
    juz:selection.juz, juzStart:selection.juzStart, juzEnd:selection.juzEnd,
    pageStart:selection.pageStart, pageEnd:selection.pageEnd,
    pages:selection.approximatePages, pagesEstimated:true,
    edition:selection.edition, stage:0, note:String(note).trim(), autoMetadata:true
  };
  // Per-surah entries created just for review are *not* memorization records.
  // Preserve those review records and their schedules; do not double-count them.
  const recorded = data.units.filter(u=>!u.simpleTrack && !u.legacy);
  const reason=validateUnit(unit,recorded,SURAH_NAMES);
  if (reason) throw new Error(reason);
  data.units.push(unit);
  data.activities.push({
    id:id(), unitId:unit.id, date, type:'memorization',
    completed:true,pages:unit.pages,pagesEstimated:true, autoMetadata:true
  });
  data.revisions.push({
    id:id(), unitId:unit.id, title:unit.title, pages:unit.pages,
    dueDate:addDays(date,Number(data.settings.reviewIntervals?.[0])||1),
    stage:0,done:false
  });
  const task=data.tasks.find(t=>t.date===date&&t.type==='memorization'&&!t.done);
  if(task) {task.done=true;task.activityId=data.activities.at(-1).id;}
  return unit;
}
