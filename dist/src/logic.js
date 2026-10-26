export const todayKey = (date = new Date()) => {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
};
export const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate()+n); return todayKey(d); };
export const dayDiff = (from, to) => Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`))/86400000);
export const isValidDateKey = key => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key||'')) return false;
  const d=new Date(`${key}T12:00:00`);
  return Number.isFinite(d.getTime())&&todayKey(d)===key;
};
export const calcProgress = units => ({
  memorized: uniquePageTotal(units, u => u.status !== 'لم أبدأ'),
  mastered: uniquePageTotal(units, u => u.status === 'متقن'),
  reviewed: uniquePageTotal(units, u => Boolean(u.lastReviewed)),
  total: uniquePageTotal(units, () => true)
});
function uniquePageTotal(units, include) {
  const seen = new Set(); let manual = 0;
  for (const u of units) {
    if (!include(u)) continue;
    if (u.method === 'pages' && Number(u.startPage) > 0 && Number(u.endPage) >= Number(u.startPage)) {
      for (let page=Number(u.startPage); page<=Number(u.endPage); page++) {
        const key=`${u.edition||''}:${page}`;
        if (!seen.has(key)) { seen.add(key); manual++; }
      }
    } else manual += Number(u.pages)||0;
  }
  return manual;
}
export function unitsOverlap(a,b) {
  if (a.id && a.id===b.id) return false;
  if (a.method==='pages'&&b.method==='pages'&&(a.edition||'')===(b.edition||'')) return Number(a.startPage)<=Number(b.endPage)&&Number(b.startPage)<=Number(a.endPage);
  if (a.surah&&b.surah&&Number(a.surah)===Number(b.surah)) {
    const aStart=Number(a.startAyah)||1,aEnd=Number(a.endAyah)||Infinity,bStart=Number(b.startAyah)||1,bEnd=Number(b.endAyah)||Infinity;
    return aStart<=bEnd&&bStart<=aEnd;
  }
  return false;
}
export function validateUnit(unit, existingUnits, surahs) {
  if (!unit || !['surah','ayah','pages','manual'].includes(unit.method)) return 'اختر طريقة تتبع صالحة.';
  if (!isValidDateKey(unit.memorizedAt)) return 'أدخل تاريخًا صالحًا.';
  if (unit.method==='surah' && !surahs.some(s=>s.number===Number(unit.surah))) return 'اختر سورة صحيحة.';
  if (unit.method==='ayah') {
    const meta=surahs.find(s=>s.number===Number(unit.surah));
    if (!meta || !Number.isInteger(Number(unit.startAyah)) || !Number.isInteger(Number(unit.endAyah)) || Number(unit.startAyah)<1 || Number(unit.endAyah)<Number(unit.startAyah) || Number(unit.endAyah)>meta.ayahs) return 'تحقق من نطاق الآيات وعدد آيات السورة.';
  }
  if (unit.method==='pages') {
    const max=String(unit.edition||'').includes('٦٠٤')?604:Infinity;
    if (!Number.isInteger(Number(unit.startPage)) || !Number.isInteger(Number(unit.endPage)) || Number(unit.startPage)<1 || Number(unit.endPage)<Number(unit.startPage) || Number(unit.endPage)>max) return 'تحقق من نطاق الصفحات وطبعة المصحف.';
  } else if (!Number.isFinite(Number(unit.pages)) || Number(unit.pages)<=0) return 'أدخل تقدير صفحات موجبًا.';
  if (unit.method==='manual'&&!String(unit.detail||'').trim()) return 'اكتب وصفًا للمادة.';
  if (existingUnits.some(existing=>existing.id!==unit.id&&unitsOverlap(unit,existing))) return 'هذه المادة تتداخل مع مادة مسجلة؛ راجع النطاقات لتجنب التكرار.';
  return null;
}
export const nextReview = (unit, rating, date, intervals) => {
  const current = Math.max(0, Number(unit.stage)||0);
  if (rating === 'ضعيف') return { dueDate:addDays(date,1), stage:0 };
  if (rating === 'يحتاج مراجعة') return { dueDate:addDays(date,2), stage:Math.max(0,current-1) };
  if (rating === 'أخطاء بسيطة') return { dueDate:addDays(date,Math.max(2, intervals[Math.min(current,intervals.length-1)] || 3)), stage:Math.min(current+1, intervals.length-1) };
  const stage = Math.min(current+1, intervals.length-1);
  return { dueDate:addDays(date,intervals[stage] || 30), stage };
};
export const completionEstimate = (remainingPages, target, daysPerWeek) => {
  const weekly = Number(target) * Number(daysPerWeek);
  if (!weekly || !Number.isFinite(weekly) || remainingPages <= 0) return null;
  const weeks = Math.ceil(remainingPages / weekly);
  return { weeks, date:addDays(todayKey(),weeks*7) };
};
export const streaks = (activities, today = todayKey()) => {
  const days = new Set(activities.filter(a => a.completed).map(a => a.date));
  let current = 0, check = days.has(today) ? today : addDays(today,-1);
  while (days.has(check)) { current++; check = addDays(check,-1); }
  let longest = 0, run = 0, prev = null;
  [...days].sort().forEach(k => { run = prev && dayDiff(prev,k) === 1 ? run+1 : 1; longest = Math.max(longest,run); prev = k; });
  return { current, longest };
};
