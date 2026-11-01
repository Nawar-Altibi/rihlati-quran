// Verified Madinah 604-page Hafs navigation.
// The page boundaries are from our MIT-licensed quran-meta index. Quran text is loaded
// without modification from Quran JSON (Tanzil Uthmani text, CC BY 3.0).
import { SURAH_NAMES } from './data.js';
import { PAGE_STARTS, locateAyah } from './quran-metadata.js';

export const MUSHAF_PAGE_COUNT = 604;
const cumulative = [];
let nextId = 1;
for (const s of SURAH_NAMES) {
  cumulative.push({ surah:s.number, start:nextId, end:nextId+s.ayahs-1, count:s.ayahs, name:s.name });
  nextId += s.ayahs;
}
if (nextId !== 6237) throw new Error('Incorrect Hafs Quran ayah count (6236 expected).');

export function clampMushafPage(value) {
  const page=Number(value);
  if (!Number.isInteger(page)) throw new RangeError('رقم الصفحة غير صالح.');
  return Math.max(1,Math.min(MUSHAF_PAGE_COUNT,page));
}

export function mushafPageFor(surah, ayah = 1) {
  return locateAyah(Number(surah),Number(ayah)).page;
}

export function getMushafPageSegments(page) {
  const n=clampMushafPage(page);
  const first=PAGE_STARTS[n], last=PAGE_STARTS[n+1]-1;
  return cumulative.filter(s=>s.start<=last&&s.end>=first).map(s=>({
    surah:s.surah, name:s.name, totalAyahs:s.count,
    fromAyah:Math.max(1,first-s.start+1),
    toAyah:Math.min(s.count,last-s.start+1)
  }));
}

export function validateMushafChapter(chapter, surah) {
  const meta=SURAH_NAMES[Number(surah)-1];
  if (!meta || Number(chapter?.id)!==meta.number || !Array.isArray(chapter.verses) || chapter.verses.length!==meta.ayahs)
    throw new Error('لم نتمكن من التحقق من بيانات السورة.');
  for(let i=0;i<chapter.verses.length;i++){
    if(Number(chapter.verses[i]?.id)!==i+1 || typeof chapter.verses[i].text!=='string' || !chapter.verses[i].text.trim())
      throw new Error('بيانات آيات السورة غير مكتملة.');
  }
  return true;
}

export function mushafPageVerses(page, chapterMap) {
  const segments=getMushafPageSegments(page);
  return segments.map(s=>{
    const ch=chapterMap.get(s.surah);
    validateMushafChapter(ch,s.surah);
    return {
      ...s,
      verses:ch.verses.slice(s.fromAyah-1,s.toAyah).map(v=>({surah:s.surah, ayah:v.id, text:v.text}))
    };
  });
}

export const defaultMushafStart = () => mushafPageFor(78,1); // Initial journey: Juz Amma.
