import { SURAH_NAMES } from './data.js';
import { todayKey, addDays, nextReview } from './logic.js';

export const SIMPLE_STAGES = [
  { id: 'amma', title: 'تثبيت جزء عمّ', description: 'مراجعة المحفوظ السابق وتحسين التجويد', surahs: Array.from({ length: 37 }, (_, i) => 78 + i), newMemorization: false },
  { id: 'tabarak', title: 'تثبيت جزء تبارك', description: 'تقوية المحفوظ مع استمرار مراجعة عمّ', surahs: Array.from({ length: 11 }, (_, i) => 67 + i), newMemorization: false },
  { id: 'qad', title: 'حفظ جزء قد سمع', description: 'حفظ جديد مع مراجعة عمّ وتبارك', surahs: Array.from({ length: 9 }, (_, i) => 58 + i), newMemorization: true },
  { id: 'baqarah', title: 'الحفظ من سورة البقرة', description: 'الحفظ من البقرة ومتابعة بقية القرآن', surahs: [2], newMemorization: true }
];

export const surahName = num => SURAH_NAMES.find(s => s.number === Number(num))?.name || 'غير معروفة';
export const getCurrentStage = data => SIMPLE_STAGES.find(s => s.id === data.settings.simpleStage) || SIMPLE_STAGES[0];
export const getSurahJuz = num => Number(num) >= 78 ? 30 : Number(num) >= 67 && Number(num) <= 77 ? 29 : Number(num) >= 58 && Number(num) <= 66 ? 28 : null;
export const surahNumbers = values => [...new Set((values || []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 114))];

export function getSurahUnit(data, number) {
  return data.units.find(u => Number(u.surah) === Number(number) && u.method === 'surah') || null;
}
export function getOrCreateSurahUnit(data, number, date, id = () => crypto.randomUUID()) {
  const existing = getSurahUnit(data, number);
  if (existing) return existing;
  const stage = getCurrentStage(data);
  const unit = {
    id: id(), method: 'surah', surah: number, juz: getSurahJuz(number),
    title: 'سورة ' + surahName(number), pages: 0, memorizedAt: date,
    status: stage.newMemorization && stage.surahs.includes(number) ? 'قيد الحفظ' : 'محفوظ سابقًا ويحتاج مراجعة',
    simpleTrack: true, stage: 0
  };
  data.units.push(unit);
  return unit;
}

export function dueSurahReviews(data, date = todayKey()) {
  return data.revisions.filter(r => !r.done && r.dueDate <= date && data.units.some(u => u.id === r.unitId && u.surah))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function recordDailyReviews(data, { surahs, date = todayKey(), ratings = {}, notes = {} }, id = () => crypto.randomUUID()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T12:00:00').getTime())) throw new Error('تاريخ المراجعة غير صالح.');
  const numbers = surahNumbers(surahs);
  if (!numbers.length) throw new Error('اختر سورة واحدة على الأقل.');
  let created = 0, rated = 0, duplicates = 0;
  for (const number of numbers) {
    const unit = getOrCreateSurahUnit(data, number, date, id);
    // One daily record per Surah prevents accidental duplicate saves.
    const existingActivity = data.activities.find(a => a.type === 'revision' && a.date === date && a.unitId === unit.id && a.simpleReview);
    if (existingActivity) { duplicates++; continue; }
    const rating = ratings[number] || ratings[String(number)] || '';
    if (rating && !['متقن', 'أخطاء بسيطة', 'يحتاج مراجعة', 'ضعيف'].includes(rating)) throw new Error('تقييم غير صالح.');
    const note = String(notes[number] || notes[String(number)] || '').trim();
    data.activities.push({ id: id(), type: 'revision', date, completed: true, unitId: unit.id, pages: 0, simpleReview: true, rating: rating || null, note });
    created++;
    if (!rating) continue; // A logged review is not evidence of mastery without evaluation.
    rated++;
    let pending = data.revisions.find(r => r.unitId === unit.id && !r.done);
    if (!pending) {
      pending = { id: id(), unitId: unit.id, title: unit.title, pages: 0, dueDate: date, stage: Number(unit.stage || 0), done: false };
      data.revisions.push(pending);
    }
    pending.done = true;
    pending.rating = rating;
    pending.completedAt = date;
    pending.note = note;
    const next = nextReview(pending, rating, date, data.settings.reviewIntervals || [1,3,7,14,30]);
    data.revisions.push({ id: id(), unitId: unit.id, title: unit.title, pages: 0, dueDate: next.dueDate, stage: next.stage, done: false });
    data.attempts.push({ id: id(), revisionId: pending.id, unitId: unit.id, date, rating, note });
    unit.lastReviewed = date;
    unit.lastRating = rating;
    unit.stage = next.stage;
    if (rating === 'ضعيف' || rating === 'يحتاج مراجعة') unit.status = 'يحتاج تثبيت';
    // A single perfect self-assessment must not automatically certify mastery.
    else if (unit.status === 'يحتاج تثبيت') unit.status = 'محفوظ سابقًا ويحتاج مراجعة';
    const dailyTask = data.tasks.find(t => t.date === date && t.type === 'revision' && t.unitId === unit.id);
    if (dailyTask) dailyTask.done = true;
  }
  return { created, rated, duplicates };
}

export function createGroupRecitation(data, { date, surahs, teacher = '', notes = '' }, id = () => crypto.randomUUID()) {
  const nums = surahNumbers(surahs);
  if (!nums.length) throw new Error('اختر سورة واحدة على الأقل للتسميع.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T12:00:00').getTime())) throw new Error('اختر تاريخًا صحيحًا.');
  const session = { id: id(), date, surahs: nums, surah: nums[0], type: 'مراجعة', teacher, notes, status: 'planned', simpleGroup: true };
  data.scheduledSessions.push(session);
  return session;
}

export function completeGroupRecitation(data, plannedId, { date = todayKey(), result = 'غير محدد', notes = '' }, id = () => crypto.randomUUID()) {
  const planned = data.scheduledSessions.find(s => s.id === plannedId);
  if (!planned) throw new Error('موعد التسميع غير موجود.');
  if (date > todayKey()) throw new Error('لا يمكن إتمام جلسة مستقبلية.');
  const nums = surahNumbers(planned.surahs || [planned.surah]);
  const session = { id: id(), date, surahs: nums, surah: nums[0] || null, type: planned.type || 'مراجعة', teacher: planned.teacher || '', notes, result, performance: null, mistakes: {}, factual: false, title: 'تسميع ' + nums.map(surahName).join('، '), plannedId };
  data.sessions.push(session);
  data.activities.push({ id: id(), type: 'session', date, completed: true, pages: 0, sessionId: session.id, simpleGroup: true });
  data.scheduledSessions = data.scheduledSessions.filter(s => s.id !== plannedId);
  for (const task of data.tasks.filter(t => t.plannedSessionId === plannedId)) { task.done = true; task.activityId = data.activities.at(-1).id; }
  return session;
}

export function advanceSimpleStage(data) {
  const current = getCurrentStage(data);
  const index = SIMPLE_STAGES.findIndex(s => s.id === current.id);
  if (index < 0 || index >= SIMPLE_STAGES.length - 1) return false;
  data.settings.simpleStage = SIMPLE_STAGES[index + 1].id;
  if (Array.isArray(data.settings.phases)) {
    if (data.settings.phases[index]) data.settings.phases[index].status = 'مكتمل';
    if (data.settings.phases[index + 1]) data.settings.phases[index + 1].status = 'جارٍ العمل';
  }
  return true;
}
